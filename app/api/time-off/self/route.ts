import { NextResponse } from 'next/server'
import * as prismaModule from '@/lib/prisma'

const prisma = ((prismaModule as any).prisma ?? (prismaModule as any).default) as any

type TimeOffBody = {
  workerId?: number
  requestType?: string
  isFullDay?: boolean
  startDate?: string
  endDate?: string
  startTime?: string | null
  endTime?: string | null
  reason?: string
  requestedByName?: string
}

type SimpleJob = {
  id: number
  title: string
  jobType: string
  status: string
  visitDate: Date | string | null
  startTime: string | null
  durationMinutes: number | null
  address: string
  customerId: number
  assignments: Array<{
    id: number
    workerId: number
  }>
}

type SimpleBlock = {
  startDate: Date
  endDate: Date
  startTime: string | null
  endTime: string | null
  isFullDay: boolean
}

function safeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normaliseDateText(value: string) {
  const clean = value.trim()

  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean
  }

  const slashMatch = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slashMatch) {
    const day = slashMatch[1].padStart(2, '0')
    const month = slashMatch[2].padStart(2, '0')
    const year = slashMatch[3]
    return `${year}-${month}-${day}`
  }

  const dashMatch = clean.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (dashMatch) {
    const day = dashMatch[1].padStart(2, '0')
    const month = dashMatch[2].padStart(2, '0')
    const year = dashMatch[3]
    return `${year}-${month}-${day}`
  }

  const parsed = new Date(clean)

  if (!Number.isNaN(parsed.getTime())) {
    const yyyy = parsed.getFullYear()
    const mm = String(parsed.getMonth() + 1).padStart(2, '0')
    const dd = String(parsed.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  return ''
}

function isValidTimeText(value: string) {
  return /^\d{2}:\d{2}$/.test(value)
}

function parseDateAtTime(dateText: string, timeText?: string | null, endOfDay = false) {
  const normalisedDateText = normaliseDateText(dateText)
  if (!normalisedDateText) return null

  const base = new Date(`${normalisedDateText}T00:00:00`)
  if (Number.isNaN(base.getTime())) return null

  if (!timeText) {
    if (endOfDay) {
      base.setHours(23, 59, 59, 999)
    } else {
      base.setHours(0, 0, 0, 0)
    }
    return base
  }

  const [hours, minutes] = timeText.split(':').map(Number)

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    if (endOfDay) {
      base.setHours(23, 59, 59, 999)
    } else {
      base.setHours(0, 0, 0, 0)
    }
    return base
  }

  base.setHours(hours, minutes, endOfDay ? 59 : 0, endOfDay ? 999 : 0)
  return base
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60000)
}

function getDateKey(value: Date | string | null | undefined) {
  if (!value) return ''

  if (typeof value === 'string') {
    return normaliseDateText(value.slice(0, 10)) || normaliseDateText(value)
  }

  if (Number.isNaN(value.getTime())) return ''

  return value.toISOString().slice(0, 10)
}

function getJobWindow(job: {
  visitDate?: Date | string | null
  startTime?: string | null
  durationMinutes?: number | null
}) {
  const dateKey = getDateKey(job.visitDate)
  if (!dateKey) return null

  const start = parseDateAtTime(dateKey, job.startTime || '09:00', false)
  if (!start) return null

  const duration =
    typeof job.durationMinutes === 'number' && job.durationMinutes > 0
      ? job.durationMinutes
      : 60

  const end = addMinutes(start, duration)
  return { start, end }
}

function getBlockWindow(block: {
  startDate: string | Date
  endDate: string | Date
  startTime?: string | null
  endTime?: string | null
  isFullDay: boolean
}) {
  const startDateKey = getDateKey(block.startDate)
  const endDateKey = getDateKey(block.endDate)

  if (!startDateKey || !endDateKey) return null

  if (block.isFullDay) {
    const start = parseDateAtTime(startDateKey, null, false)
    const end = parseDateAtTime(endDateKey, null, true)
    if (!start || !end) return null
    return { start, end }
  }

  const start = parseDateAtTime(startDateKey, block.startTime || '00:00', false)
  const end = parseDateAtTime(endDateKey, block.endTime || '23:59', false)

  if (!start || !end) return null
  return { start, end }
}

function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd
}

function isQuoteJob(job: { title?: string | null; jobType?: string | null }) {
  const title = safeString(job.title).toLowerCase()
  const jobType = safeString(job.jobType).toLowerCase()
  return title === 'quote' || jobType === 'quote'
}

function formatDateTimeForAlert(value: Date) {
  return value.toLocaleString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function listWorkerJobs(workerId: number) {
  return (await prisma.job.findMany({
    where: {
      assignments: {
        some: {
          workerId,
        },
      },
      status: {
        notIn: ['archived', 'cancelled'],
      },
    },
    select: {
      id: true,
      title: true,
      jobType: true,
      status: true,
      visitDate: true,
      startTime: true,
      durationMinutes: true,
      address: true,
      customerId: true,
      assignments: {
        select: {
          id: true,
          workerId: true,
        },
      },
    },
  })) as SimpleJob[]
}

async function listWorkerBlocks(workerId: number) {
  return (await prisma.workerAvailabilityBlock.findMany({
    where: {
      workerId,
      active: true,
    },
    select: {
      startDate: true,
      endDate: true,
      startTime: true,
      endTime: true,
      isFullDay: true,
    },
  })) as SimpleBlock[]
}

async function isWorkerFreeForWindow(
  workerId: number,
  windowStart: Date,
  windowEnd: Date,
  excludeJobId?: number
) {
  const jobs = await listWorkerJobs(workerId)

  for (const job of jobs) {
    if (excludeJobId && job.id === excludeJobId) continue

    const jobWindow = getJobWindow(job)
    if (!jobWindow) continue

    if (intervalsOverlap(windowStart, windowEnd, jobWindow.start, jobWindow.end)) {
      return false
    }
  }

  const blocks = await listWorkerBlocks(workerId)

  for (const block of blocks) {
    const blockWindow = getBlockWindow(block)
    if (!blockWindow) continue

    if (intervalsOverlap(windowStart, windowEnd, blockWindow.start, blockWindow.end)) {
      return false
    }
  }

  return true
}

async function findNextAvailableDateForWorker(
  workerId: number,
  originalJob: SimpleJob,
  fromDate: Date,
  daysToSearch = 14
) {
  const originalWindow = getJobWindow(originalJob)
  if (!originalWindow) return null

  const duration =
    typeof originalJob.durationMinutes === 'number' && originalJob.durationMinutes > 0
      ? originalJob.durationMinutes
      : 60

  const startTime = originalJob.startTime || '09:00'

  for (let offset = 1; offset <= daysToSearch; offset += 1) {
    const candidateDate = new Date(fromDate)
    candidateDate.setDate(candidateDate.getDate() + offset)

    const dateKey = candidateDate.toISOString().slice(0, 10)
    const start = parseDateAtTime(dateKey, startTime, false)
    if (!start) continue

    const end = addMinutes(start, duration)

    const free = await isWorkerFreeForWindow(workerId, start, end, originalJob.id)
    if (free) {
      return {
        visitDate: new Date(`${dateKey}T00:00:00.000Z`),
        startTime,
      }
    }
  }

  return null
}

async function findReplacementWorker(originalWorkerId: number, job: SimpleJob) {
  const jobWindow = getJobWindow(job)
  if (!jobWindow) return null

  const workers = await prisma.worker.findMany({
    where: {
      active: true,
      id: {
        not: originalWorkerId,
      },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  })

  for (const worker of workers) {
    const free = await isWorkerFreeForWindow(worker.id, jobWindow.start, jobWindow.end, job.id)
    if (free) {
      return worker
    }
  }

  return null
}

async function ensureKellyAlertConversation() {
  const existing = await prisma.conversation.findFirst({
    where: {
      source: 'system-scheduler',
      contactRef: 'kelly',
    },
  })

  if (existing) return existing

  return prisma.conversation.create({
    data: {
      source: 'system-scheduler',
      contactName: 'Scheduler Alerts',
      contactRef: 'kelly',
      archived: false,
    },
  })
}

async function createKellyAlert(params: {
  subject: string
  preview: string
  body: string
  jobId?: number
}) {
  const conversation = await ensureKellyAlertConversation()

  return prisma.inboxMessage.create({
    data: {
      source: 'system-scheduler',
      senderName: 'Scheduler',
      senderEmail: null,
      senderPhone: null,
      subject: params.subject,
      preview: params.preview,
      body: params.body,
      assignedTo: 'Kelly',
      status: 'unread',
      conversationId: conversation.id,
      jobId: params.jobId ?? null,
      externalMessageId: `scheduler-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    },
  })
}

async function addJobAuditNote(jobId: number, note: string) {
  await prisma.jobNote.create({
    data: {
      jobId,
      note,
      createdByWorkerId: null,
    },
  })
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as TimeOffBody

    const workerId = Number(body.workerId)
    const requestType = safeString(body.requestType) || 'unavailable'
    const isFullDay = Boolean(body.isFullDay)
    const startDateText = normaliseDateText(safeString(body.startDate))
    const endDateText = normaliseDateText(safeString(body.endDate))
    const startTime = safeString(body.startTime)
    const endTime = safeString(body.endTime)
    const reason = safeString(body.reason)
    const requestedByName = safeString(body.requestedByName) || 'Trev'

    if (!workerId) {
      return NextResponse.json({ error: 'Missing workerId' }, { status: 400 })
    }

    if (!startDateText || !endDateText) {
      return NextResponse.json({ error: 'Missing or invalid start/end date' }, { status: 400 })
    }

    const startDate = new Date(`${startDateText}T00:00:00.000Z`)
    const endDate = new Date(`${endDateText}T00:00:00.000Z`)

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return NextResponse.json({ error: 'Invalid dates' }, { status: 400 })
    }

    if (endDate.getTime() < startDate.getTime()) {
      return NextResponse.json({ error: 'End date cannot be before start date' }, { status: 400 })
    }

    if (!isFullDay) {
      if (!startTime || !endTime) {
        return NextResponse.json({ error: 'Start and end times are required for timed blocks' }, { status: 400 })
      }

      if (!isValidTimeText(startTime) || !isValidTimeText(endTime)) {
        return NextResponse.json({ error: 'Times must be in HH:mm format' }, { status: 400 })
      }

      if (endTime <= startTime) {
        return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 })
      }
    }

    const blockWindow = getBlockWindow({
      startDate,
      endDate,
      startTime: isFullDay ? null : startTime,
      endTime: isFullDay ? null : endTime,
      isFullDay,
    })

    if (!blockWindow) {
      return NextResponse.json({ error: 'Could not calculate blocked time window' }, { status: 400 })
    }

    const request = await prisma.timeOffRequest.create({
      data: {
        workerId,
        requestType,
        status: 'approved',
        startDate,
        endDate,
        startTime: isFullDay ? null : startTime,
        endTime: isFullDay ? null : endTime,
        isFullDay,
        reason: reason || null,
        requestedByName,
        reviewedByName: requestedByName,
        reviewedAt: new Date(),
      },
    })

    const availabilityBlock = await prisma.workerAvailabilityBlock.create({
      data: {
        workerId,
        requestId: request.id,
        source: 'time_off_request',
        title: requestType,
        startDate,
        endDate,
        startTime: isFullDay ? null : startTime,
        endTime: isFullDay ? null : endTime,
        isFullDay,
        notes: reason || null,
        active: true,
      },
    })

    const workerJobs = await listWorkerJobs(workerId)
    const conflictingJobs = workerJobs.filter((job) => {
      const jobWindow = getJobWindow(job)
      if (!jobWindow) return false
      return intervalsOverlap(blockWindow.start, blockWindow.end, jobWindow.start, jobWindow.end)
    })

    const results: Array<{
      jobId: number
      outcome: 'moved' | 'reassigned' | 'manual_review'
      details: string
    }> = []

    for (const job of conflictingJobs) {
      const jobWindow = getJobWindow(job)
      if (!jobWindow) continue

      const customer = await prisma.customer.findUnique({
        where: { id: job.customerId },
        select: { name: true },
      })

      const customerName = customer?.name || `Job #${job.id}`

      if (isQuoteJob(job)) {
        const nextSlot = await findNextAvailableDateForWorker(workerId, job, blockWindow.end, 14)

        if (nextSlot) {
          await prisma.job.update({
            where: { id: job.id },
            data: {
              visitDate: nextSlot.visitDate,
              startTime: nextSlot.startTime,
            },
          })

          const detail = `Quote auto-moved to ${nextSlot.visitDate.toISOString().slice(0, 10)} at ${nextSlot.startTime}.`

          await addJobAuditNote(job.id, `System auto-moved quote after Trev added time off. ${detail}`)

          await createKellyAlert({
            subject: `Auto-rescheduled quote: ${customerName}`,
            preview: detail,
            body: [
              `Trev added time off: ${requestType}.`,
              `Blocked window: ${formatDateTimeForAlert(blockWindow.start)} to ${formatDateTimeForAlert(blockWindow.end)}.`,
              `Affected job: ${customerName}.`,
              detail,
            ].join('\n'),
            jobId: job.id,
          })

          results.push({
            jobId: job.id,
            outcome: 'moved',
            details: detail,
          })

          continue
        }
      }

      const isSoloTrevJob = job.assignments.length === 1 && job.assignments[0]?.workerId === workerId

      if (isSoloTrevJob) {
        const replacementWorker = await findReplacementWorker(workerId, job)

        if (replacementWorker) {
          await prisma.jobAssignment.update({
            where: {
              id: job.assignments[0].id,
            },
            data: {
              workerId: replacementWorker.id,
            },
          })

          const replacementName = `${replacementWorker.firstName} ${replacementWorker.lastName}`.trim()
          const detail = `Job reassigned automatically to ${replacementName}.`

          await addJobAuditNote(job.id, `System reassigned job after Trev added time off. ${detail}`)

          await createKellyAlert({
            subject: `Auto-reassigned job: ${customerName}`,
            preview: detail,
            body: [
              `Trev added time off: ${requestType}.`,
              `Blocked window: ${formatDateTimeForAlert(blockWindow.start)} to ${formatDateTimeForAlert(blockWindow.end)}.`,
              `Affected job: ${customerName}.`,
              detail,
            ].join('\n'),
            jobId: job.id,
          })

          results.push({
            jobId: job.id,
            outcome: 'reassigned',
            details: detail,
          })

          continue
        }
      }

      const detail = 'No safe automatic reschedule was found. Kelly review needed.'

      await addJobAuditNote(job.id, `Time off clash detected after Trev added time off. ${detail}`)

      await createKellyAlert({
        subject: `Manual review needed: ${customerName}`,
        preview: detail,
        body: [
          `Trev added time off: ${requestType}.`,
          `Blocked window: ${formatDateTimeForAlert(blockWindow.start)} to ${formatDateTimeForAlert(blockWindow.end)}.`,
          `Affected job: ${customerName}.`,
          `Booked job window: ${formatDateTimeForAlert(jobWindow.start)} to ${formatDateTimeForAlert(jobWindow.end)}.`,
          detail,
        ].join('\n'),
        jobId: job.id,
      })

      results.push({
        jobId: job.id,
        outcome: 'manual_review',
        details: detail,
      })
    }

    return NextResponse.json({
      ok: true,
      requestId: request.id,
      availabilityBlockId: availabilityBlock.id,
      conflictsFound: conflictingJobs.length,
      results,
    })
  } catch (error) {
    console.error('POST /api/time-off/self failed', error)
    return NextResponse.json({ error: 'Failed to save blocked time' }, { status: 500 })
  }
}