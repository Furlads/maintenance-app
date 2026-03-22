import * as prismaModule from '@/lib/prisma'

const prisma = ((prismaModule as any).prisma ?? (prismaModule as any).default) as any

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

function parseDateAtTime(dateText: string, timeText?: string | null, endOfDay = false) {
  const base = new Date(`${dateText}T00:00:00`)
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

function getJobWindow(job: {
  visitDate?: Date | string | null
  startTime?: string | null
  durationMinutes?: number | null
}) {
  if (!job.visitDate) return null

  const dateKey =
    typeof job.visitDate === 'string'
      ? job.visitDate.slice(0, 10)
      : new Date(job.visitDate).toISOString().slice(0, 10)

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
  const startDateKey =
    typeof block.startDate === 'string'
      ? block.startDate.slice(0, 10)
      : new Date(block.startDate).toISOString().slice(0, 10)

  const endDateKey =
    typeof block.endDate === 'string'
      ? block.endDate.slice(0, 10)
      : new Date(block.endDate).toISOString().slice(0, 10)

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

function intervalsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
) {
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
    minute: '2-digit'
  })
}

async function listWorkerJobs(workerId: number) {
  return (await prisma.job.findMany({
    where: {
      assignments: {
        some: {
          workerId
        }
      },
      status: {
        notIn: ['archived', 'cancelled']
      }
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
          workerId: true
        }
      }
    }
  })) as SimpleJob[]
}

async function listWorkerBlocks(workerId: number) {
  return (await prisma.workerAvailabilityBlock.findMany({
    where: {
      workerId,
      active: true
    },
    select: {
      startDate: true,
      endDate: true,
      startTime: true,
      endTime: true,
      isFullDay: true
    }
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
        startTime
      }
    }
  }

  return null
}

async function findReplacementWorker(
  originalWorkerId: number,
  job: SimpleJob
) {
  const jobWindow = getJobWindow(job)
  if (!jobWindow) return null

  const workers = await prisma.worker.findMany({
    where: {
      active: true,
      id: {
        not: originalWorkerId
      }
    },
    select: {
      id: true,
      firstName: true,
      lastName: true
    },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }]
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
      contactRef: 'kelly'
    }
  })

  if (existing) return existing

  return prisma.conversation.create({
    data: {
      source: 'system-scheduler',
      contactName: 'Scheduler Alerts',
      contactRef: 'kelly',
      archived: false
    }
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
      externalMessageId: `scheduler-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    }
  })
}

async function addJobAuditNote(jobId: number, note: string) {
  await prisma.jobNote.create({
    data: {
      jobId,
      note,
      createdByWorkerId: null
    }
  })
}

export async function handleTimeOffApproval(params: {
  workerId: number
  requestType: string
  requestedByName: string
  startDate: Date
  endDate: Date
  startTime: string | null
  endTime: string | null
  isFullDay: boolean
}) {
  const blockWindow = getBlockWindow({
    startDate: params.startDate,
    endDate: params.endDate,
    startTime: params.startTime,
    endTime: params.endTime,
    isFullDay: params.isFullDay
  })

  if (!blockWindow) {
    return {
      conflictsFound: 0,
      results: [],
      error: 'Could not calculate blocked time window'
    }
  }

  const workerJobs = await listWorkerJobs(params.workerId)

  const conflictingJobs = workerJobs.filter((job) => {
    const jobWindow = getJobWindow(job)
    if (!jobWindow) return false

    return intervalsOverlap(
      blockWindow.start,
      blockWindow.end,
      jobWindow.start,
      jobWindow.end
    )
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
      select: { name: true }
    })

    const customerName = customer?.name || `Job #${job.id}`

    if (isQuoteJob(job)) {
      const nextSlot = await findNextAvailableDateForWorker(
        params.workerId,
        job,
        blockWindow.end,
        14
      )

      if (nextSlot) {
        await prisma.job.update({
          where: { id: job.id },
          data: {
            visitDate: nextSlot.visitDate,
            startTime: nextSlot.startTime
          }
        })

        const detail = `Quote auto-moved to ${nextSlot.visitDate.toISOString().slice(0, 10)} at ${nextSlot.startTime}.`

        await addJobAuditNote(
          job.id,
          `System auto-moved quote after approved time off. ${detail}`
        )

        await createKellyAlert({
          subject: `Auto-rescheduled quote: ${customerName}`,
          preview: detail,
          body: [
            `${params.requestedByName} approved time off for worker ${params.workerId}.`,
            `Type: ${params.requestType}.`,
            `Blocked window: ${formatDateTimeForAlert(blockWindow.start)} to ${formatDateTimeForAlert(blockWindow.end)}.`,
            `Affected job: ${customerName}.`,
            detail
          ].join('\n'),
          jobId: job.id
        })

        results.push({
          jobId: job.id,
          outcome: 'moved',
          details: detail
        })

        continue
      }
    }

    const isSoloWorkerJob =
      job.assignments.length === 1 &&
      job.assignments[0]?.workerId === params.workerId

    if (isSoloWorkerJob) {
      const replacementWorker = await findReplacementWorker(params.workerId, job)

      if (replacementWorker) {
        await prisma.jobAssignment.update({
          where: {
            id: job.assignments[0].id
          },
          data: {
            workerId: replacementWorker.id
          }
        })

        const replacementName = `${replacementWorker.firstName} ${replacementWorker.lastName}`.trim()
        const detail = `Job reassigned automatically to ${replacementName}.`

        await addJobAuditNote(
          job.id,
          `System reassigned job after approved time off. ${detail}`
        )

        await createKellyAlert({
          subject: `Auto-reassigned job: ${customerName}`,
          preview: detail,
          body: [
            `${params.requestedByName} approved time off for worker ${params.workerId}.`,
            `Type: ${params.requestType}.`,
            `Blocked window: ${formatDateTimeForAlert(blockWindow.start)} to ${formatDateTimeForAlert(blockWindow.end)}.`,
            `Affected job: ${customerName}.`,
            detail
          ].join('\n'),
          jobId: job.id
        })

        results.push({
          jobId: job.id,
          outcome: 'reassigned',
          details: detail
        })

        continue
      }
    }

    const detail = 'No safe automatic reschedule was found. Kelly review needed.'

    await addJobAuditNote(
      job.id,
      `Approved time off clash detected. ${detail}`
    )

    await createKellyAlert({
      subject: `Manual review needed: ${customerName}`,
      preview: detail,
      body: [
        `${params.requestedByName} approved time off for worker ${params.workerId}.`,
        `Type: ${params.requestType}.`,
        `Blocked window: ${formatDateTimeForAlert(blockWindow.start)} to ${formatDateTimeForAlert(blockWindow.end)}.`,
        `Affected job: ${customerName}.`,
        `Booked job window: ${formatDateTimeForAlert(jobWindow.start)} to ${formatDateTimeForAlert(jobWindow.end)}.`,
        detail
      ].join('\n'),
      jobId: job.id
    })

    results.push({
      jobId: job.id,
      outcome: 'manual_review',
      details: detail
    })
  }

  return {
    conflictsFound: conflictingJobs.length,
    results,
    error: null
  }
}