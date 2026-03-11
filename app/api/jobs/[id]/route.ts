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

    let nextStatus = existing.status

    const requestedStatus = clean((body as any).status).toLowerCase()

    if (requestedStatus === 'todo' || requestedStatus === 'done') {
      nextStatus = requestedStatus
    } else if ((body as any).toggleStatus === true) {
      nextStatus = String(existing.status).toLowerCase() === 'done' ? 'todo' : 'done'
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
      if ((body as any).durationMinutes === null || (body as any).durationMinutes === '') {
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

    if (typeof (body as any).appendNote === 'string' && (body as any).appendNote.trim()) {
      const currentNotes = existing.notes ? `${existing.notes}\n` : ''
      notesUpdate = `${currentNotes}${(body as any).appendNote.trim()}`
    }

    const updated = await prisma.job.update({
      where: { id: jobId },
      data: {
        title: typeof (body as any).title === 'string' ? (body as any).title : undefined,
        address:
          typeof (body as any).address === 'string' ? (body as any).address : undefined,
        notes: notesUpdate,
        status: nextStatus,
        visitDate: visitDateUpdate,
        startTime: startTimeUpdate,
        durationMinutes: durationMinutesUpdate
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