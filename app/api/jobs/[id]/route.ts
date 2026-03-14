export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string }> }

const DAY_START_MINUTES = 9 * 60 // 09:00
const DAY_END_MINUTES = 16 * 60 + 30 // 16:30
const BREAK_THRESHOLD_MINUTES = 6 * 60
const BREAK_DURATION_MINUTES = 20
const DEFAULT_JOB_DURATION_MINUTES = 60
const FARM_POSTCODE = 'TF9 4BQ'

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

function parseTimeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null

  const trimmed = value.trim()
  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed)

  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null
  }

  return hours * 60 + minutes
}

function formatMinutesAsTime(totalMinutes: number): string {
  const safe = Math.max(0, totalMinutes)
  const hours = Math.floor(safe / 60)
  const minutes = safe % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function getLondonTimeParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date)

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute')
  }
}

function getLondonMinutes(date: Date): number {
  const parts = getLondonTimeParts(date)
  const hours = Number(parts.hour)
  const minutes = Number(parts.minute)

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return DAY_START_MINUTES
  }

  return hours * 60 + minutes
}

function getLondonDateKey(date: Date): string {
  const parts = getLondonTimeParts(date)
  return `${parts.year}-${parts.month}-${parts.day}`
}

function getUtcDayRange(date: Date) {
  const start = new Date(date)
  start.setUTCHours(0, 0, 0, 0)

  const end = new Date(date)
  end.setUTCHours(23, 59, 59, 999)

  return { start, end }
}

function getPostcodeArea(postcode: string | null | undefined): string {
  if (!postcode) return ''

  const trimmed = postcode.trim().toUpperCase()
  if (!trimmed) return ''

  return trimmed.split(/\s+/)[0] ?? ''
}

function estimateTravelMinutes(
  fromPostcode: string | null | undefined,
  toPostcode: string | null | undefined
): number {
  const fromArea = getPostcodeArea(fromPostcode)
  const toArea = getPostcodeArea(toPostcode)

  if (!fromArea || !toArea) {
    return 20
  }

  if (fromArea === toArea) {
    return 10
  }

  const fromPrefix = fromArea.replace(/\d.*$/, '')
  const toPrefix = toArea.replace(/\d.*$/, '')

  if (fromPrefix && toPrefix && fromPrefix === toPrefix) {
    return 20
  }

  return 35
}

function getEffectiveJobMinutes(job: {
  durationMinutes: number | null
  overrunMins?: number | null
  pausedMinutes?: number | null
}) {
  return (
    (job.durationMinutes ?? DEFAULT_JOB_DURATION_MINUTES) +
    (job.overrunMins ?? 0) +
    (job.pausedMinutes ?? 0)
  )
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

function shouldTriggerRebuild(args: {
  action: string
  statusUpdate: string | undefined
  visitDateUpdate: Date | null | undefined
  startTimeUpdate: string | null | undefined
  durationMinutesUpdate: number | undefined
  overrunMinsUpdate: number | undefined
  assignedWorkersChanged: boolean
  existingVisitDate: Date | null
  updatedVisitDate: Date | null
  updatedStartTime: string | null
  updatedWorkerIds: number[]
}) {
  const timingActions = new Set([
    'start',
    'pause',
    'resume',
    'finish',
    'extend',
    'couldntcomplete',
    'couldnt_complete',
    'cannotcomplete',
    'cannot_complete',
    'weather',
    'cancel',
    'cancelled',
    'postpone',
    'postponed',
    'move',
    'move_later'
  ])

  const timingStatuses = new Set([
    'in_progress',
    'paused',
    'done',
    'unscheduled',
    'cancelled',
    'weather',
    'weather_postponed',
    'postponed',
    'todo'
  ])

  if (!args.updatedVisitDate) return false
  if (!args.updatedStartTime) return false
  if (args.updatedWorkerIds.length === 0) return false

  if (timingActions.has(args.action)) return true
  if (args.statusUpdate && timingStatuses.has(args.statusUpdate)) return true
  if (args.visitDateUpdate !== undefined) return true
  if (args.startTimeUpdate !== undefined) return true
  if (args.durationMinutesUpdate !== undefined) return true
  if (args.overrunMinsUpdate !== undefined) return true
  if (args.assignedWorkersChanged) return true
  if (!args.existingVisitDate && args.updatedVisitDate) return true

  return false
}

async function calculateWorkedMinutesBeforeCursor(args: {
  visitDate: Date
  cursorMinutes: number
  workerIds: number[]
  excludeJobId: number
}) {
  const { start, end } = getUtcDayRange(args.visitDate)

  const earlierJobs = await prisma.job.findMany({
    where: {
      id: { not: args.excludeJobId },
      visitDate: {
        gte: start,
        lte: end
      },
      assignments: {
        some: {
          workerId: {
            in: args.workerIds
          }
        }
      },
      startTime: {
        not: null
      },
      status: {
        notIn: ['cancelled', 'unscheduled']
      }
    },
    select: {
      id: true,
      startTime: true,
      durationMinutes: true,
      overrunMins: true,
      pausedMinutes: true
    }
  })

  let workedMinutes = 0

  for (const job of earlierJobs) {
    const startMinutes = parseTimeToMinutes(job.startTime)
    if (startMinutes === null) continue
    if (startMinutes >= args.cursorMinutes) continue

    workedMinutes += getEffectiveJobMinutes(job)
  }

  return workedMinutes
}

async function rebuildRemainingDay(args: {
  anchorJobId: number
  visitDate: Date
  anchorCursorMinutes: number
  anchorPostcode: string | null
  workerIds: number[]
}) {
  if (args.workerIds.length === 0) return

  const { start, end } = getUtcDayRange(args.visitDate)

  const downstreamJobs = await prisma.job.findMany({
    where: {
      id: { not: args.anchorJobId },
      visitDate: {
        gte: start,
        lte: end
      },
      assignments: {
        some: {
          workerId: {
            in: args.workerIds
          }
        }
      },
      arrivedAt: null,
      finishedAt: null,
      startTime: {
        not: null
      },
      status: {
        notIn: ['done', 'cancelled', 'unscheduled']
      }
    },
    orderBy: [{ createdAt: 'asc' }],
    include: {
      customer: {
        select: {
          postcode: true
        }
      },
      assignments: {
        select: {
          workerId: true
        }
      }
    }
  })

  const laterJobs = downstreamJobs
    .map((job) => ({
      job,
      startMinutes: parseTimeToMinutes(job.startTime)
    }))
    .filter((entry) => entry.startMinutes !== null && entry.startMinutes >= args.anchorCursorMinutes)
    .sort((a, b) => {
      if (a.startMinutes! !== b.startMinutes!) {
        return a.startMinutes! - b.startMinutes!
      }
      return a.job.id - b.job.id
    })

  let cursorMinutes = Math.max(args.anchorCursorMinutes, DAY_START_MINUTES)
  let previousPostcode = args.anchorPostcode || FARM_POSTCODE

  let workedMinutes = await calculateWorkedMinutesBeforeCursor({
    visitDate: args.visitDate,
    cursorMinutes,
    workerIds: args.workerIds,
    excludeJobId: args.anchorJobId
  })

  let breakInserted = workedMinutes >= BREAK_THRESHOLD_MINUTES

  const updates: ReturnType<typeof prisma.job.update>[] = []

  for (const entry of laterJobs) {
    const job = entry.job
    const durationMinutes = getEffectiveJobMinutes(job)
    const travelMinutes = estimateTravelMinutes(previousPostcode, job.customer?.postcode ?? null)

    let nextStartMinutes = Math.max(cursorMinutes + travelMinutes, DAY_START_MINUTES)

    if (
      !breakInserted &&
      workedMinutes < BREAK_THRESHOLD_MINUTES &&
      workedMinutes + durationMinutes > BREAK_THRESHOLD_MINUTES
    ) {
      nextStartMinutes += BREAK_DURATION_MINUTES
      breakInserted = true
    }

    const nextEndMinutes = nextStartMinutes + durationMinutes

    if (nextEndMinutes > DAY_END_MINUTES) {
      updates.push(
        prisma.job.update({
          where: { id: job.id },
          data: {
            visitDate: null,
            startTime: null,
            status: 'unscheduled'
          }
        })
      )
      continue
    }

    updates.push(
      prisma.job.update({
        where: { id: job.id },
        data: {
          startTime: formatMinutesAsTime(nextStartMinutes)
        }
      })
    )

    cursorMinutes = nextEndMinutes
    workedMinutes += durationMinutes
    previousPostcode = job.customer?.postcode ?? previousPostcode
  }

  if (updates.length > 0) {
    await prisma.$transaction(updates)
  }
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
        assignments: true,
        customer: {
          select: {
            postcode: true
          }
        }
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

    const finalAssignedWorkerIds =
      assignedWorkerIdsForResponse ??
      updated.assignments.map((assignment) => assignment.workerId)

    const rebuildNeeded = shouldTriggerRebuild({
      action,
      statusUpdate,
      visitDateUpdate,
      startTimeUpdate,
      durationMinutesUpdate,
      overrunMinsUpdate,
      assignedWorkersChanged: body.assignedTo !== undefined,
      existingVisitDate: existing.visitDate,
      updatedVisitDate: updated.visitDate,
      updatedStartTime: updated.startTime,
      updatedWorkerIds: finalAssignedWorkerIds
    })

    if (rebuildNeeded && updated.visitDate && updated.startTime && finalAssignedWorkerIds.length > 0) {
      const plannedStartMinutes =
        parseTimeToMinutes(updated.startTime) ?? DAY_START_MINUTES

      const plannedEndMinutes =
        plannedStartMinutes + getEffectiveJobMinutes(updated)

      const liveNowMinutes = getLondonMinutes(now)

      let anchorCursorMinutes = plannedEndMinutes

      if (
        action === 'start' ||
        action === 'pause' ||
        action === 'resume' ||
        updated.status === 'in_progress' ||
        updated.status === 'paused'
      ) {
        anchorCursorMinutes = Math.max(plannedEndMinutes, liveNowMinutes)
      }

      if (action === 'finish') {
        anchorCursorMinutes = Math.max(plannedStartMinutes, getLondonMinutes(finishedAtUpdate ?? now))
      }

      if (
        action === 'couldntcomplete' ||
        action === 'couldnt_complete' ||
        action === 'cannotcomplete' ||
        action === 'cannot_complete' ||
        action === 'weather' ||
        action === 'cancel' ||
        action === 'cancelled' ||
        action === 'postpone' ||
        action === 'postponed' ||
        statusUpdate === 'cancelled' ||
        statusUpdate === 'weather' ||
        statusUpdate === 'weather_postponed' ||
        statusUpdate === 'postponed'
      ) {
        anchorCursorMinutes = Math.max(DAY_START_MINUTES, liveNowMinutes)
      }

      anchorCursorMinutes = Math.max(anchorCursorMinutes, DAY_START_MINUTES)

      await rebuildRemainingDay({
        anchorJobId: updated.id,
        visitDate: updated.visitDate,
        anchorCursorMinutes,
        anchorPostcode: updated.customer?.postcode ?? existing.customer?.postcode ?? FARM_POSTCODE,
        workerIds: finalAssignedWorkerIds
      })
    }

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

    const refreshed = await prisma.job.findUnique({
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

    const { notes, notesLog } = await buildNotesLog(jobId)

    return NextResponse.json({
      ...(refreshed ?? updated),
      jobNotes: notes,
      notesLog,
      assignedWorkerIds:
        assignedWorkerIdsForResponse ??
        (refreshed ?? updated).assignments.map((assignment) => assignment.workerId)
    })
  } catch (error) {
    console.error('PATCH /api/jobs/[id] failed:', error)

    return NextResponse.json(
      { error: 'Failed to update job' },
      { status: 500 }
    )
  }
}