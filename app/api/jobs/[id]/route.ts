export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string }> }

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function parseDateValue(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '' || value === 'null') return null

  if (typeof value === 'string') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }

  return undefined
}

function parsePositiveInt(value: unknown): number | undefined {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return undefined
  const rounded = Math.round(parsed)
  return rounded > 0 ? rounded : undefined
}

function parseNonNegativeInt(value: unknown): number | undefined {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return undefined
  const rounded = Math.round(parsed)
  return rounded >= 0 ? rounded : undefined
}

function parseAssignedWorkerIds(input: unknown): number[] {
  if (!Array.isArray(input)) return []

  const cleaned: number[] = input
    .map((value): number | null => {
      if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
        return value
      }

      if (typeof value === 'string') {
        const parsed = Number(value.trim())
        if (Number.isInteger(parsed) && parsed > 0) {
          return parsed
        }
      }

      return null
    })
    .filter((value): value is number => value !== null)

  return [...new Set(cleaned)]
}

function minutesBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000))
}

async function buildNotesLog(jobId: number) {
  const notes = await prisma.jobNote.findMany({
    where: { jobId },
    orderBy: { createdAt: 'asc' },
    include: {
      worker: {
        select: {
          id: true,
          firstName: true,
          lastName: true
        }
      }
    }
  })

  const notesLog = notes
    .map((note) => {
      const author = note.worker
        ? `${note.worker.firstName} ${note.worker.lastName}`.trim()
        : 'Unknown'

      return `[${note.createdAt.toLocaleString('en-GB')}] ${author}: ${note.note}`
    })
    .join('\n')

  return { notes, notesLog }
}

export async function GET(_: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const jobId = parseInt(id, 10)

    if (!jobId || Number.isNaN(jobId)) {
      return NextResponse.json(
        { error: 'Invalid job id', received: id },
        { status: 400 }
      )
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        customer: true,
        assignments: {
          include: {
            worker: true
          }
        },
        photos: true,
        chasMessages: true
      }
    })

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const { notes, notesLog } = await buildNotesLog(jobId)

    return NextResponse.json({
      ...job,
      jobNotes: notes,
      notesLog,
      assignedWorkerIds: job.assignments.map((assignment) => assignment.workerId)
    })
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

    if (!jobId || Number.isNaN(jobId)) {
      return NextResponse.json(
        { error: 'Invalid job id', received: id },
        { status: 400 }
      )
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>))

    const existing = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        assignments: true
      }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const action = clean(body.action).toLowerCase()
    const requestedStatus = clean(body.status).toLowerCase()
    const appendNote = clean(body.appendNote)
    const noteAuthor = clean(body.noteAuthor)

    const now = new Date()

    let statusUpdate: string | undefined = undefined
    let arrivedAtUpdate: Date | null | undefined = undefined
    let finishedAtUpdate: Date | null | undefined = undefined
    let pausedAtUpdate: Date | null | undefined = undefined
    let pausedMinutesUpdate: number | undefined = undefined

    if (requestedStatus) {
      statusUpdate = requestedStatus
    }

    if (body.toggleStatus === true) {
      statusUpdate = existing.status === 'done' ? 'unscheduled' : 'done'

      if (statusUpdate === 'done') {
        finishedAtUpdate = now
      } else {
        finishedAtUpdate = null
      }
    }

    if (action === 'start') {
      arrivedAtUpdate = existing.arrivedAt ?? now
      finishedAtUpdate = null
      pausedAtUpdate = null

      statusUpdate = statusUpdate ?? 'in_progress'
    }

    if (action === 'pause') {
      if (existing.arrivedAt && !existing.finishedAt && !existing.pausedAt) {
        pausedAtUpdate = now
        statusUpdate = statusUpdate ?? 'paused'
      }
    }

    if (action === 'resume') {
      if (existing.pausedAt) {
        const additionalPausedMinutes = minutesBetween(existing.pausedAt, now)
        pausedMinutesUpdate =
          (existing.pausedMinutes ?? 0) + additionalPausedMinutes
      }

      if (!existing.arrivedAt) {
        arrivedAtUpdate = now
      }

      pausedAtUpdate = null
      statusUpdate = statusUpdate ?? 'in_progress'
    }

    if (action === 'finish') {
      let finalPausedMinutes = existing.pausedMinutes ?? 0

      if (existing.pausedAt) {
        finalPausedMinutes += minutesBetween(existing.pausedAt, now)
        pausedAtUpdate = null
      }

      pausedMinutesUpdate = finalPausedMinutes
      finishedAtUpdate = now
      statusUpdate = statusUpdate ?? 'done'
    }

    const visitDateUpdate = parseDateValue(body.visitDate)

    let startTimeUpdate: string | null | undefined = undefined
    if ('startTime' in body) {
      if (body.startTime === null || clean(body.startTime) === '') {
        startTimeUpdate = null
      } else if (typeof body.startTime === 'string') {
        startTimeUpdate = body.startTime
      }
    }

    const durationMinutesUpdate = parsePositiveInt(
      body.durationMinutes ?? body.durationMins
    )

    const overrunMinsUpdate = parseNonNegativeInt(body.overrunMins)

    const customerIdUpdate =
      body.customerId === null
        ? undefined
        : parsePositiveInt(body.customerId)

    let assignedWorkerIdsForResponse: number[] | undefined = undefined

    if (body.assignedTo !== undefined) {
      const cleanedWorkerIds = parseAssignedWorkerIds(body.assignedTo)

      const existingWorkers = cleanedWorkerIds.length
        ? await prisma.worker.findMany({
            where: {
              id: {
                in: cleanedWorkerIds
              }
            },
            select: { id: true }
          })
        : []

      const existingWorkerIds = new Set(existingWorkers.map((worker) => worker.id))

      const missingWorkerIds = cleanedWorkerIds.filter(
        (workerId) => !existingWorkerIds.has(workerId)
      )

      if (missingWorkerIds.length > 0) {
        return NextResponse.json(
          {
            error: 'Some assigned workers do not exist',
            missingWorkerIds
          },
          { status: 400 }
        )
      }

      await prisma.$transaction([
        prisma.jobAssignment.deleteMany({
          where: { jobId }
        }),
        ...(cleanedWorkerIds.length > 0
          ? [
              prisma.jobAssignment.createMany({
                data: cleanedWorkerIds.map((workerId) => ({
                  jobId,
                  workerId
                })),
                skipDuplicates: true
              })
            ]
          : [])
      ])

      assignedWorkerIdsForResponse = cleanedWorkerIds
    }

    const updated = await prisma.job.update({
      where: { id: jobId },
      data: {
        title: typeof body.title === 'string' ? body.title : undefined,
        address: typeof body.address === 'string' ? body.address : undefined,
        notes:
          body.notes === null
            ? null
            : typeof body.notes === 'string'
              ? body.notes
              : undefined,
        jobType: typeof body.jobType === 'string' ? body.jobType : undefined,
        customerId: customerIdUpdate,
        visitDate: visitDateUpdate,
        startTime: startTimeUpdate,
        durationMinutes: durationMinutesUpdate,
        overrunMins: overrunMinsUpdate,
        status: statusUpdate,
        arrivedAt: arrivedAtUpdate,
        finishedAt: finishedAtUpdate,
        pausedAt: pausedAtUpdate,
        pausedMinutes: pausedMinutesUpdate
      },
      include: {
        customer: true,
        assignments: {
          include: {
            worker: true
          }
        },
        photos: true,
        chasMessages: true
      }
    })

    if (appendNote) {
      let createdByWorkerId: number | null = null

      if (noteAuthor) {
        const authorParts = noteAuthor.trim().split(/\s+/).filter(Boolean)

        if (authorParts.length > 0) {
          const possibleWorkers = await prisma.worker.findMany({
            where: {
              OR: [
                { firstName: { equals: noteAuthor, mode: 'insensitive' } },
                { lastName: { equals: noteAuthor, mode: 'insensitive' } },
                authorParts.length >= 2
                  ? {
                      AND: [
                        {
                          firstName: {
                            equals: authorParts[0],
                            mode: 'insensitive'
                          }
                        },
                        {
                          lastName: {
                            equals: authorParts.slice(1).join(' '),
                            mode: 'insensitive'
                          }
                        }
                      ]
                    }
                  : { id: -1 }
              ]
            },
            select: { id: true },
            take: 1
          })

          if (possibleWorkers.length > 0) {
            createdByWorkerId = possibleWorkers[0].id
          }
        }
      }

      await prisma.jobNote.create({
        data: {
          jobId,
          note: appendNote,
          createdByWorkerId
        }
      })
    }

    const { notes, notesLog } = await buildNotesLog(jobId)

    return NextResponse.json({
      ...updated,
      jobNotes: notes,
      notesLog,
      assignedWorkerIds:
        assignedWorkerIdsForResponse ??
        updated.assignments.map((assignment) => assignment.workerId)
    })
  } catch (error) {
    console.error('PATCH /api/jobs/[id] failed:', error)

    return NextResponse.json(
      { error: 'Failed to update job' },
      { status: 500 }
    )
  }
}