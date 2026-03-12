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

function hhmmToMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

function minutesToHHMM(totalMinutes: number) {
  const safeMinutes = Math.max(0, totalMinutes)
  const hours = Math.floor(safeMinutes / 60)
  const mins = safeMinutes % 60

  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
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
      where: { id: jobId },
      include: {
        assignments: true
      }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const action = clean((body as any).action).toLowerCase()

    let statusUpdate: string | undefined = undefined
    let arrivedAtUpdate: Date | null | undefined = undefined
    let finishedAtUpdate: Date | null | undefined = undefined
    let pausedAtUpdate: Date | null | undefined = undefined
    let pausedMinutesUpdate: number | undefined = undefined

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

    if ('pausedAt' in (body as any)) {
      try {
        pausedAtUpdate = parseOptionalDateTime((body as any).pausedAt)
      } catch {
        return NextResponse.json(
          { error: 'Invalid pausedAt value' },
          { status: 400 }
        )
      }
    }

    if ('pausedMinutes' in (body as any)) {
      const pausedMinutesValue = Number((body as any).pausedMinutes)

      if (!Number.isFinite(pausedMinutesValue) || pausedMinutesValue < 0) {
        return NextResponse.json(
          { error: 'pausedMinutes must be zero or a positive number' },
          { status: 400 }
        )
      }

      pausedMinutesUpdate = Math.round(pausedMinutesValue)
    }

    if (action === 'start') {
      arrivedAtUpdate = existing.arrivedAt ?? new Date()
      finishedAtUpdate = null
      pausedAtUpdate = null
      statusUpdate = 'in_progress'
    }

    if (action === 'finish') {
      arrivedAtUpdate = existing.arrivedAt ?? new Date()
      finishedAtUpdate = new Date()
      pausedAtUpdate = null
      statusUpdate = 'done'
    }

    if (action === 'pause') {
      if (!existing.arrivedAt || existing.finishedAt) {
        return NextResponse.json(
          { error: 'Only active jobs can be paused' },
          { status: 400 }
        )
      }

      if (existing.pausedAt) {
        return NextResponse.json(
          { error: 'Job is already paused' },
          { status: 400 }
        )
      }

      pausedAtUpdate = new Date()
      statusUpdate = 'paused'
    }

    if (action === 'resume') {
      if (!existing.arrivedAt || existing.finishedAt) {
        return NextResponse.json(
          { error: 'Only active jobs can be resumed' },
          { status: 400 }
        )
      }

      if (!existing.pausedAt) {
        return NextResponse.json(
          { error: 'Job is not currently paused' },
          { status: 400 }
        )
      }

      const now = new Date()
      const pausedDiffMs = now.getTime() - new Date(existing.pausedAt).getTime()
      const pausedDiffMinutes = Math.max(0, Math.round(pausedDiffMs / 60000))

      pausedMinutesUpdate = (existing.pausedMinutes ?? 0) + pausedDiffMinutes
      pausedAtUpdate = null
      statusUpdate = 'in_progress'
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
        pausedAtUpdate = null
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

    if (
      typeof (body as any).appendNote === 'string' &&
      (body as any).appendNote.trim()
    ) {
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

    let overrunUpdate: number | undefined = undefined

    if (extendMinsUpdate !== undefined) {
      const currentOverrun = existing.overrunMins ?? 0
      overrunUpdate = currentOverrun + extendMinsUpdate

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
    }

    if (action === 'pause') {
      const pauseLine = `Work paused at ${new Date().toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit'
      })}`

      const currentNotes =
        notesUpdate !== undefined
          ? notesUpdate
            ? `${notesUpdate}\n`
            : ''
          : existing.notes
            ? `${existing.notes}\n`
            : ''

      notesUpdate = `${currentNotes}${pauseLine}`
    }

    if (action === 'resume' && existing.pausedAt) {
      const now = new Date()
      const pausedDiffMs = now.getTime() - new Date(existing.pausedAt).getTime()
      const pausedDiffMinutes = Math.max(0, Math.round(pausedDiffMs / 60000))

      const resumeLine = `Work resumed after ${pausedDiffMinutes} minutes paused`

      const currentNotes =
        notesUpdate !== undefined
          ? notesUpdate
            ? `${notesUpdate}\n`
            : ''
          : existing.notes
            ? `${existing.notes}\n`
            : ''

      notesUpdate = `${currentNotes}${resumeLine}`
    }

    const updated = await prisma.job.update({
      where: { id: jobId },
      data: {
        title:
          typeof (body as any).title === 'string'
            ? (body as any).title
            : undefined,
        address:
          typeof (body as any).address === 'string'
            ? (body as any).address
            : undefined,
        notes: notesUpdate,
        status: statusUpdate,
        visitDate: visitDateUpdate,
        startTime: startTimeUpdate,
        durationMinutes: durationMinutesUpdate,
        arrivedAt: arrivedAtUpdate,
        finishedAt: finishedAtUpdate,
        pausedAt: pausedAtUpdate,
        pausedMinutes: pausedMinutesUpdate,
        overrunMins: overrunUpdate
      }
    })

    if (
      extendMinsUpdate !== undefined &&
      existing.visitDate &&
      existing.startTime &&
      existing.assignments.length > 0
    ) {
      const sharedWorkerIds = existing.assignments.map((assignment) => assignment.workerId)
      const currentJobStartMinutes = hhmmToMinutes(existing.startTime)
      const visitDateStart = new Date(existing.visitDate)
      const visitDateEnd = new Date(existing.visitDate)
      visitDateEnd.setDate(visitDateEnd.getDate() + 1)

      const laterJobs = await prisma.job.findMany({
        where: {
          id: { not: jobId },
          visitDate: {
            gte: visitDateStart,
            lt: visitDateEnd
          },
          startTime: {
            not: null
          },
          arrivedAt: null,
          finishedAt: null,
          assignments: {
            some: {
              workerId: {
                in: sharedWorkerIds
              }
            }
          }
        },
        orderBy: [{ visitDate: 'asc' }, { startTime: 'asc' }]
      })

      const jobsToPush = laterJobs.filter((job) => {
        if (!job.startTime) return false
        return hhmmToMinutes(job.startTime) > currentJobStartMinutes
      })

      if (jobsToPush.length > 0) {
        await prisma.$transaction(
          jobsToPush.map((job) => {
            const oldStartMinutes = hhmmToMinutes(job.startTime as string)
            const newStartTime = minutesToHHMM(oldStartMinutes + extendMinsUpdate)
            const currentNotes = job.notes ? `${job.notes}\n` : ''
            const pushNote = `Start time pushed back by ${extendMinsUpdate} minutes due to earlier overrun`

            return prisma.job.update({
              where: { id: job.id },
              data: {
                startTime: newStartTime,
                notes: `${currentNotes}${pushNote}`
              }
            })
          })
        )
      }
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