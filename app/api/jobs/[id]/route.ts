export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

type Ctx = {
  params: Promise<{ id: string }>
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

function parseOptionalDateTime(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null

  const date = new Date(String(value))

  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid datetime value')
  }

  return date
}

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const jobId = Number(id)

    if (!Number.isInteger(jobId) || jobId <= 0) {
      return NextResponse.json({ error: 'Invalid job id' }, { status: 400 })
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
    const jobId = Number(id)

    if (!Number.isInteger(jobId) || jobId <= 0) {
      return NextResponse.json({ error: 'Invalid job id' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))

    const existing = await prisma.job.findUnique({
      where: { id: jobId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const action = clean((body as any).action).toLowerCase()

    let statusUpdate: string | undefined = undefined
    let arrivedAtUpdate: Date | null | undefined = undefined
    let finishedAtUpdate: Date | null | undefined = undefined

    if ('status' in (body as any)) {
      const requestedStatus = clean((body as any).status).toLowerCase()

      if (requestedStatus) {
        statusUpdate = requestedStatus
      }
    }

    if ('arrivedAt' in (body as any)) {
      try {
        arrivedAtUpdate = parseOptionalDateTime((body as any).arrivedAt)
      } catch {
        return NextResponse.json(
          { error: 'Invalid arrivedAt value' },
          { status: 400 }
        )
      }
    }

    if ('finishedAt' in (body as any)) {
      try {
        finishedAtUpdate = parseOptionalDateTime((body as any).finishedAt)
      } catch {
        return NextResponse.json(
          { error: 'Invalid finishedAt value' },
          { status: 400 }
        )
      }
    }

    if (action === 'start') {
      arrivedAtUpdate = existing.arrivedAt ?? new Date()
      finishedAtUpdate = null
      statusUpdate = 'in_progress'
    }

    if (action === 'finish') {
      arrivedAtUpdate = existing.arrivedAt ?? new Date()
      finishedAtUpdate = new Date()
      statusUpdate = 'done'
    }

    if ((body as any).toggleStatus === true) {
      const isDone = String(existing.status).toLowerCase() === 'done'

      if (isDone) {
        statusUpdate = 'todo'
        finishedAtUpdate = null
      } else {
        statusUpdate = 'done'
        finishedAtUpdate = new Date()
        arrivedAtUpdate = existing.arrivedAt ?? new Date()
      }
    }

    let visitDateUpdate: Date | null | undefined = undefined
    let startTimeUpdate: string | null | undefined = undefined
    let durationMinutesUpdate: number | null | undefined = undefined

    if ('visitDate' in (body as any)) {
      const visitDateRaw = clean((body as any).visitDate)

      if ((body as any).visitDate === null || visitDateRaw === '') {
        visitDateUpdate = null
      } else {
        if (!isValidISODateOnly(visitDateRaw)) {
          return NextResponse.json(
            { error: 'visitDate must be YYYY-MM-DD' },
            { status: 400 }
          )
        }

        visitDateUpdate = new Date(visitDateRaw)
      }
    }

    if ('startTime' in (body as any)) {
      const startTimeRaw = clean((body as any).startTime)

      if ((body as any).startTime === null || startTimeRaw === '') {
        startTimeUpdate = null
      } else {
        if (!isValidHHMM(startTimeRaw)) {
          return NextResponse.json(
            { error: 'startTime must be HH:MM' },
            { status: 400 }
          )
        }

        startTimeUpdate = startTimeRaw
      }
    }

    if ('durationMinutes' in (body as any)) {
      if (
        (body as any).durationMinutes === null ||
        (body as any).durationMinutes === ''
      ) {
        durationMinutesUpdate = null
      } else {
        const durationValue = Number((body as any).durationMinutes)

        if (!Number.isFinite(durationValue) || durationValue <= 0) {
          return NextResponse.json(
            { error: 'durationMinutes must be a positive number' },
            { status: 400 }
          )
        }

        durationMinutesUpdate = Math.round(durationValue)
      }
    }

    let notesUpdate: string | null | undefined = undefined

    if ('notes' in (body as any)) {
      notesUpdate =
        typeof (body as any).notes === 'string' ? (body as any).notes : null
    }

    let extendMinsUpdate: number | undefined = undefined

    if ('extendMins' in (body as any)) {
      const extendValue = Number((body as any).extendMins)

      if (!Number.isFinite(extendValue) || extendValue <= 0) {
        return NextResponse.json(
          { error: 'extendMins must be a positive number' },
          { status: 400 }
        )
      }

      extendMinsUpdate = Math.round(extendValue)
    }

    if (typeof (body as any).appendNote === 'string' && (body as any).appendNote.trim()) {
      const currentNotes =
        notesUpdate !== undefined
          ? notesUpdate
            ? `${notesUpdate}\n`
            : ''
          : existing.notes
            ? `${existing.notes}\n`
            : ''

      notesUpdate = `${currentNotes}${(body as any).appendNote.trim()}`
    }

    if (extendMinsUpdate !== undefined) {
      const overrunLine = `Running over by ${extendMinsUpdate} minutes`

      const currentNotes =
        notesUpdate !== undefined
          ? notesUpdate
            ? `${notesUpdate}\n`
            : ''
          : existing.notes
            ? `${existing.notes}\n`
            : ''

      notesUpdate = `${currentNotes}${overrunLine}`

      const currentOverrun =
        typeof (existing as any).overrunMins === 'number'
          ? (existing as any).overrunMins
          : 0

      const updated = await prisma.job.update({
        where: { id: jobId },
        data: {
          title: typeof (body as any).title === 'string' ? (body as any).title : undefined,
          address:
            typeof (body as any).address === 'string' ? (body as any).address : undefined,
          notes: notesUpdate,
          status: statusUpdate,
          visitDate: visitDateUpdate,
          startTime: startTimeUpdate,
          durationMinutes: durationMinutesUpdate,
          arrivedAt: arrivedAtUpdate,
          finishedAt: finishedAtUpdate,
          overrunMins: currentOverrun + extendMinsUpdate
        }
      })

      return NextResponse.json(updated)
    }

    const updated = await prisma.job.update({
      where: { id: jobId },
      data: {
        title: typeof (body as any).title === 'string' ? (body as any).title : undefined,
        address:
          typeof (body as any).address === 'string' ? (body as any).address : undefined,
        notes: notesUpdate,
        status: statusUpdate,
        visitDate: visitDateUpdate,
        startTime: startTimeUpdate,
        durationMinutes: durationMinutesUpdate,
        arrivedAt: arrivedAtUpdate,
        finishedAt: finishedAtUpdate
      }
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH /api/jobs/[id] failed:', error)

    return NextResponse.json(
      { error: 'Failed to update job' },
      { status: 500 }
    )
  }
}