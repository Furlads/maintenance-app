export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string }> }

function nowGB() {
  return new Date().toLocaleString('en-GB')
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function isValidISODateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function isValidHHMM(value: string) {
  return /^\d{2}:\d{2}$/.test(value)
}

function outwardPostcode(address: string) {
  const upper = (address || '').toUpperCase()
  const match = upper.match(/\b([A-Z]{1,2}\d{1,2}[A-Z]?)\s*(\d[A-Z]{2})\b/)
  if (!match) return ''
  return match[1]
}

function addWeeks(d: Date, weeks: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + weeks * 7)
  return x
}

function adjustToDOWOnOrAfter(d: Date, dow: number) {
  const x = new Date(d)

  for (let i = 0; i < 7; i++) {
    if (x.getDay() === dow) return x
    x.setDate(x.getDate() + 1)
  }

  return x
}

async function rebuild(worker: string, fromDate: string) {
  await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'}/api/schedule/rebuild`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ worker, fromDate, includeToday: true })
    }
  ).catch(() => null)
}

export async function GET(_: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const jobId = parseInt(id, 10)

    if (!jobId) {
      return NextResponse.json(
        { error: 'Invalid job id', received: id },
        { status: 400 }
      )
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId }
    })

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    return NextResponse.json(job)
  } catch (error) {
    console.error('GET /api/jobs/[id] failed:', error)

    return NextResponse.json(
      { error: 'Failed to load job' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const jobId = parseInt(id, 10)

    if (!jobId) {
      return NextResponse.json(
        { error: 'Invalid job id', received: id },
        { status: 400 }
      )
    }

    const body = await req.json().catch(() => ({} as any))

    const existing = await prisma.job.findUnique({
      where: { id: jobId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const action = clean(body.action).toLowerCase()

    // ===== Status logic =====
    let newStatus = existing.status

    const requestedStatus = clean(body.status).toLowerCase()

    if (
      requestedStatus === 'todo' ||
      requestedStatus === 'done' ||
      requestedStatus === 'unscheduled'
    ) {
      newStatus = requestedStatus as any
    } else if (body.toggleStatus === true) {
      newStatus = existing.status === 'done' ? ('todo' as any) : ('done' as any)
    }

    // ===== Append notes =====
    const appendNote = clean(body.appendNote)
    const noteAuthor = clean(body.noteAuthor) || 'unknown'
    let newNotesLog: string | undefined = undefined

    if (appendNote) {
      const line = `[${nowGB()}] ${noteAuthor}: ${appendNote}`
      newNotesLog = existing.notesLog ? `${existing.notesLog}\n${line}` : line
    }

    // ===== Scheduling inputs =====
    const fixedRequested = body.fixed === true
    const visitDateRaw = clean(body.visitDate)
    const startTimeRaw = clean(body.startTime)

    let visitDateUpdate: Date | null | undefined = undefined
    let startTimeUpdate: string | null | undefined = undefined
    let fixedUpdate: boolean | undefined = undefined

    if (visitDateRaw === 'null') visitDateUpdate = null

    if (visitDateRaw && visitDateRaw !== 'null') {
      if (!isValidISODateOnly(visitDateRaw)) {
        return NextResponse.json(
          { error: 'visitDate must be YYYY-MM-DD if provided' },
          { status: 400 }
        )
      }

      visitDateUpdate = new Date(visitDateRaw)
    }

    if (startTimeRaw) {
      if (!isValidHHMM(startTimeRaw)) {
        return NextResponse.json(
          { error: 'startTime must be HH:MM if provided' },
          { status: 400 }
        )
      }

      startTimeUpdate = startTimeRaw
    } else if ('startTime' in body && !startTimeRaw) {
      startTimeUpdate = null
    }

    if ('fixed' in body) {
      fixedUpdate = fixedRequested
    }

    // ===== Extend time (overrun) =====
    const extendMins =
      Number.isFinite(Number(body.extendMins)) && Number(body.extendMins) > 0
        ? Math.round(Number(body.extendMins))
        : 0

    let overrunUpdate: number | undefined = undefined

    if (extendMins > 0) {
      overrunUpdate = (existing.overrunMins ?? 0) + extendMins
    }

    // ===== Address update => postcode =====
    let postcodeUpdate: string | undefined = undefined

    if (typeof body.address === 'string') {
      postcodeUpdate = outwardPostcode(body.address)
    }

    // ===== Duration update =====
    let durationUpdate: number | undefined = undefined

    if (
      Number.isFinite(Number(body.durationMins)) &&
      Number(body.durationMins) > 0
    ) {
      durationUpdate = Math.round(Number(body.durationMins))
    }

    // ===== Worker timing actions =====
    let arrivedAtUpdate: Date | null | undefined = undefined
    let finishedAtUpdate: Date | null | undefined = undefined

    if (action === 'arrived') {
      arrivedAtUpdate = existing.arrivedAt ?? new Date()
      finishedAtUpdate = null
    }

    if (action === 'finished') {
      finishedAtUpdate = new Date()
    }

    // If undoing from done back to todo, clear finishedAt so the job becomes live again.
    if (body.toggleStatus === true && existing.status === 'done' && newStatus === 'todo') {
      finishedAtUpdate = null
    }

    const updated = await prisma.job.update({
      where: { id: jobId },
      data: {
        status: newStatus as any,
        title: typeof body.title === 'string' ? body.title : undefined,
        address: typeof body.address === 'string' ? body.address : undefined,
        postcode: postcodeUpdate,
        assignedTo:
          typeof body.assignedTo === 'string'
            ? body.assignedTo.toLowerCase()
            : body.assignedTo === null
              ? null
              : undefined,
        visitDate: visitDateUpdate,
        fixed: fixedUpdate,
        startTime: startTimeUpdate,
        notesLog: typeof newNotesLog === 'string' ? newNotesLog : undefined,
        durationMins: durationUpdate,
        overrunMins: overrunUpdate,
        arrivedAt: arrivedAtUpdate,
        finishedAt: finishedAtUpdate,

        recurrenceActive:
          typeof body.recurrenceActive === 'boolean'
            ? body.recurrenceActive
            : undefined,
        recurrenceEveryWeeks:
          Number.isFinite(Number(body.recurrenceEveryWeeks))
            ? Number(body.recurrenceEveryWeeks)
            : undefined,
        recurrenceDurationMins:
          Number.isFinite(Number(body.recurrenceDurationMins))
            ? Number(body.recurrenceDurationMins)
            : undefined,
        recurrencePreferredDOW:
          Number.isFinite(Number(body.recurrencePreferredDOW))
            ? Number(body.recurrencePreferredDOW)
            : undefined,
        recurrencePreferredTime:
          typeof body.recurrencePreferredTime === 'string'
            ? body.recurrencePreferredTime
            : undefined
      }
    })

    if (
      body.toggleStatus === true &&
      updated.status === 'done' &&
      updated.recurrenceActive &&
      updated.recurrenceEveryWeeks
    ) {
      const base = updated.visitDate ? new Date(updated.visitDate) : new Date()
      let next = addWeeks(base, updated.recurrenceEveryWeeks)

      if (Number.isFinite(Number(updated.recurrencePreferredDOW))) {
        next = adjustToDOWOnOrAfter(next, Number(updated.recurrencePreferredDOW))
      }

      const nextDuration =
        updated.recurrenceDurationMins ?? updated.durationMins ?? 60

      const prefTime = updated.recurrencePreferredTime
        ? clean(updated.recurrencePreferredTime)
        : ''

      const nextFixed = !!prefTime

      await prisma.job.create({
        data: {
          title: updated.title,
          address: updated.address,
          postcode: updated.postcode || outwardPostcode(updated.address),
          notes: updated.notes ?? '',
          notesLog: '',
          status: nextFixed ? 'todo' : 'unscheduled',
          visitDate: nextFixed ? next : null,
          assignedTo: updated.assignedTo,
          durationMins: nextDuration,
          overrunMins: 0,
          fixed: nextFixed,
          startTime: nextFixed ? prefTime : null,

          recurrenceActive: updated.recurrenceActive,
          recurrenceEveryWeeks: updated.recurrenceEveryWeeks,
          recurrenceDurationMins: updated.recurrenceDurationMins,
          recurrencePreferredDOW: updated.recurrencePreferredDOW,
          recurrencePreferredTime: updated.recurrencePreferredTime
        }
      })
    }

    const worker = (updated.assignedTo ?? '').toLowerCase()
    const rebuildFrom = updated.visitDate ? new Date(updated.visitDate) : new Date()
    const fromDate = rebuildFrom.toISOString().slice(0, 10)

    const shouldRebuild =
      !!worker &&
      (
        body.toggleStatus === true ||
        action === 'arrived' ||
        action === 'finished' ||
        extendMins > 0 ||
        typeof body.assignedTo === 'string' ||
        typeof body.address === 'string' ||
        'visitDate' in body ||
        'startTime' in body ||
        'fixed' in body ||
        Number.isFinite(Number(body.durationMins))
      )

    if (shouldRebuild) {
      await rebuild(worker, fromDate)
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH /api/jobs/[id] failed:', error)

    return NextResponse.json(
      { error: 'Failed to update job' },
      { status: 500 }
    )
  }
}