import prisma from '@/lib/prisma'

export const FULL_DAY_START_MINUTES = 0
export const FULL_DAY_END_MINUTES = 24 * 60
export const JOBS_START_MINUTES = 9 * 60
export const END_OF_DAY_MINUTES = 16 * 60 + 30

export function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function isValidHHMM(value: string) {
  return /^\d{2}:\d{2}$/.test(value)
}

export function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export function minutesToTime(minutes: number) {
  const hrs = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

export function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
}

export function endOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

export function sameLocalDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function clampJobWindow(startTime: string | null | undefined, durationMinutes: number | null | undefined) {
  if (!startTime) return null

  const start = timeToMinutes(startTime)
  const duration =
    typeof durationMinutes === 'number' && durationMinutes > 0 ? durationMinutes : 120

  return {
    start,
    end: start + duration,
    duration,
  }
}

export function getBlockWindowForDate(block: {
  startDate: Date
  endDate: Date
  startTime: string | null
  endTime: string | null
  isFullDay: boolean
}, date: Date) {
  const blockStartDay = startOfLocalDay(block.startDate)
  const blockEndDay = startOfLocalDay(block.endDate)
  const currentDay = startOfLocalDay(date)

  if (currentDay < blockStartDay || currentDay > blockEndDay) {
    return null
  }

  if (block.isFullDay) {
    return {
      start: FULL_DAY_START_MINUTES,
      end: FULL_DAY_END_MINUTES,
    }
  }

  const isFirstDay = sameLocalDay(currentDay, blockStartDay)
  const isLastDay = sameLocalDay(currentDay, blockEndDay)

  const start = isFirstDay && block.startTime ? timeToMinutes(block.startTime) : FULL_DAY_START_MINUTES
  const end = isLastDay && block.endTime ? timeToMinutes(block.endTime) : FULL_DAY_END_MINUTES

  return {
    start,
    end,
  }
}

export function windowsOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
) {
  return aStart < bEnd && bStart < aEnd
}

export function requestTypeLabel(requestType: string) {
  const value = cleanString(requestType).toLowerCase()

  if (value === 'holiday') return 'Holiday'
  if (value === 'day_off') return 'Day off'
  if (value === 'early_finish') return 'Early finish'
  if (value === 'late_start') return 'Late start'
  if (value === 'appointment') return 'Appointment'
  if (value === 'sick') return 'Sick / emergency'
  return requestType || 'Time off'
}

export async function getActiveBlocksForWorkerRange(params: {
  workerId: number
  startDate: Date
  endDate: Date
}) {
  return prisma.workerAvailabilityBlock.findMany({
    where: {
      workerId: params.workerId,
      active: true,
      startDate: {
        lte: endOfLocalDay(params.endDate),
      },
      endDate: {
        gte: startOfLocalDay(params.startDate),
      },
    },
    orderBy: [
      { startDate: 'asc' },
      { createdAt: 'asc' },
    ],
  })
}

export async function getActiveBlocksForWorkersRange(params: {
  workerIds: number[]
  startDate: Date
  endDate: Date
}) {
  if (params.workerIds.length === 0) return []

  return prisma.workerAvailabilityBlock.findMany({
    where: {
      workerId: {
        in: params.workerIds,
      },
      active: true,
      startDate: {
        lte: endOfLocalDay(params.endDate),
      },
      endDate: {
        gte: startOfLocalDay(params.startDate),
      },
    },
    orderBy: [
      { workerId: 'asc' },
      { startDate: 'asc' },
      { createdAt: 'asc' },
    ],
  })
}

export async function unscheduleImpactedJobsForApprovedBlock(params: {
  workerId: number
  block: {
    startDate: Date
    endDate: Date
    startTime: string | null
    endTime: string | null
    isFullDay: boolean
  }
}) {
  const jobs = await prisma.job.findMany({
    where: {
      assignments: {
        some: {
          workerId: params.workerId,
        },
      },
      visitDate: {
        gte: startOfLocalDay(params.block.startDate),
        lte: endOfLocalDay(params.block.endDate),
      },
      status: {
        notIn: ['done', 'cancelled', 'archived'],
      },
    },
    include: {
      assignments: true,
    },
    orderBy: [
      { visitDate: 'asc' },
      { startTime: 'asc' },
      { createdAt: 'asc' },
    ],
  })

  const impactedJobIds: number[] = []

  for (const job of jobs) {
    if (!job.visitDate || !job.startTime) {
      impactedJobIds.push(job.id)
      continue
    }

    const jobWindow = clampJobWindow(job.startTime, job.durationMinutes)
    const blockWindow = getBlockWindowForDate(params.block, job.visitDate)

    if (!jobWindow || !blockWindow) {
      continue
    }

    if (params.block.isFullDay) {
      impactedJobIds.push(job.id)
      continue
    }

    const sameDayJobsForWorker = jobs.filter(
      (other) =>
        other.id !== job.id &&
        other.visitDate &&
        sameLocalDay(other.visitDate, job.visitDate) &&
        !!other.startTime
    )

    const hasDirectOverlap = windowsOverlap(
      jobWindow.start,
      jobWindow.end,
      blockWindow.start,
      blockWindow.end
    )

    const startsAfterBlockedWindow = jobWindow.start >= blockWindow.start
    const laterJobsExist = sameDayJobsForWorker.some((other) => {
      if (!other.startTime) return false
      const otherWindow = clampJobWindow(other.startTime, other.durationMinutes)
      if (!otherWindow) return false
      return otherWindow.start > jobWindow.start
    })

    if (hasDirectOverlap || startsAfterBlockedWindow || laterJobsExist) {
      impactedJobIds.push(job.id)
    }
  }

  const uniqueIds = [...new Set(impactedJobIds)]

  if (uniqueIds.length > 0) {
    await prisma.job.updateMany({
      where: {
        id: {
          in: uniqueIds,
        },
      },
      data: {
        visitDate: null,
        startTime: null,
        status: 'unscheduled',
        arrivedAt: null,
        finishedAt: null,
        pausedAt: null,
        pausedMinutes: 0,
        overrunMins: 0,
      },
    })
  }

  return uniqueIds
}