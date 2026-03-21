import prisma from '@/lib/prisma'
import {
  addDays,
  cleanString,
  clampJobWindow,
  endOfLocalDay,
  getActiveBlocksForWorkersRange,
  getBlockWindowForDate,
  sameLocalDay,
  startOfLocalDay,
  timeToMinutes,
  minutesToTime,
  windowsOverlap,
} from '@/lib/time-off'
import { ensureRollingRecurringMaintenanceJobs } from '@/lib/recurring-maintenance'

const TREV_QUOTE_DEFAULT_SLOTS = ['11:00', '12:00', '13:00']
const FARM_POSTCODE = 'TF9 4BQ'

const PREP_START_MINUTES = 8 * 60 + 30
const JOBS_START_MINUTES = 9 * 60
const END_OF_DAY_MINUTES = 16 * 60 + 30
const BREAK_THRESHOLD_MINUTES = 6 * 60
const BREAK_DURATION_MINUTES = 20

type AutoSchedulerResult = {
  ok: boolean
  error?: string
  scheduled: number
  recurringCreated: number
  message?: string
}

type LocalRepairReason = 'cancel' | 'edit' | 'manual'

type LocalRepairResult = {
  ok: boolean
  error?: string
  workerId: number
  date: string
  reason: LocalRepairReason
  repaired: number
  remaining: number
  unplacedJobIds: number[]
  message?: string
}

type LocalRepairForJobResult = {
  ok: boolean
  error?: string
  jobId: number
  repairs: LocalRepairResult[]
  message?: string
}

type WorkerLite = {
  id: number
  firstName: string | null
  lastName: string | null
  email?: string | null
}

type JobWithRelations = {
  id: number
  title: string | null
  jobType: string | null
  postcode?: string | null
  address?: string | null
  visitDate: Date | null
  startTime: string | null
  durationMinutes: number | null
  status: string | null
  createdAt: Date
  customer: {
    postcode: string | null
  } | null
  assignments: Array<{
    workerId: number
  }>
}

type DayJobLike = {
  id: number
  startTime?: string | null
  durationMinutes?: number | null
  postcode?: string | null
  address?: string | null
  customer?: { postcode?: string | null } | null
}

function normalisePostcode(value: unknown) {
  return cleanString(value).toUpperCase()
}

function postcodeOutward(value: unknown) {
  const postcode = normalisePostcode(value)
  if (!postcode) return ''
  return postcode.split(' ')[0] || ''
}

function postcodeAreaLetters(value: unknown) {
  const outward = postcodeOutward(value)
  const match = outward.match(/^[A-Z]+/)
  return match ? match[0] : ''
}

function postcodeDistrict(value: unknown) {
  const outward = postcodeOutward(value)
  const match = outward.match(/^([A-Z]+)(\d+)/)
  if (!match) return null
  return {
    area: match[1],
    district: Number(match[2]),
  }
}

function getTravelMinutes(fromPostcode: unknown, toPostcode: unknown) {
  const from = normalisePostcode(fromPostcode)
  const to = normalisePostcode(toPostcode)

  if (!from || !to) return 30
  if (from === to) return 10

  const fromOutward = postcodeOutward(from)
  const toOutward = postcodeOutward(to)

  if (fromOutward && fromOutward === toOutward) return 12

  const fromDistrict = postcodeDistrict(from)
  const toDistrict = postcodeDistrict(to)

  if (
    fromDistrict &&
    toDistrict &&
    fromDistrict.area === toDistrict.area &&
    Number.isFinite(fromDistrict.district) &&
    Number.isFinite(toDistrict.district)
  ) {
    const diff = Math.abs(fromDistrict.district - toDistrict.district)
    if (diff <= 1) return 18
    if (diff <= 3) return 25
    return 35
  }

  const fromArea = postcodeAreaLetters(from)
  const toArea = postcodeAreaLetters(to)

  if (fromArea && toArea && fromArea === toArea) return 35

  if (
    (fromArea === 'TF' && ['ST', 'SY', 'CW'].includes(toArea)) ||
    (toArea === 'TF' && ['ST', 'SY', 'CW'].includes(fromArea))
  ) {
    return 40
  }

  if (
    ['TF', 'ST', 'SY', 'CW'].includes(fromArea) &&
    ['TF', 'ST', 'SY', 'CW'].includes(toArea)
  ) {
    return 50
  }

  return 60
}

function isQuoteJobType(jobType: string | null | undefined) {
  const value = cleanString(jobType).toLowerCase()
  return value === 'quote' || value === 'quoted'
}

function isTrevWorker(worker: WorkerLite) {
  const first = cleanString(worker.firstName).toLowerCase()
  const last = cleanString(worker.lastName).toLowerCase()
  const email = cleanString(worker.email).toLowerCase()

  const firstMatches = first === 'trevor' || first === 'trev'
  const lastMatches = last.includes('fudger')
  const emailMatches = email.includes('trevor.fudger')

  return (firstMatches && lastMatches) || emailMatches
}

async function assignJobToWorkerIfNeeded(jobId: number, workerId: number) {
  const existingAssignment = await prisma.jobAssignment.findFirst({
    where: {
      jobId,
      workerId,
    },
    select: {
      id: true,
    },
  })

  if (existingAssignment) return

  await prisma.jobAssignment.create({
    data: {
      jobId,
      workerId,
    },
  })
}

function getJobPostcode(job: {
  postcode?: string | null
  address?: string | null
  customer?: { postcode?: string | null } | null
}) {
  return (
    normalisePostcode(job.postcode) ||
    normalisePostcode(job.customer?.postcode) ||
    ''
  )
}

function getJobDurationMinutes(job: { durationMinutes?: number | null }) {
  return typeof job.durationMinutes === 'number' && job.durationMinutes > 0
    ? job.durationMinutes
    : 120
}

function sortDayJobs<T extends { startTime?: string | null; id: number }>(jobs: T[]) {
  return [...jobs].sort((a, b) => {
    const aStart = a.startTime ?? '99:99'
    const bStart = b.startTime ?? '99:99'
    if (aStart !== bStart) return aStart.localeCompare(bStart)
    return a.id - b.id
  })
}

function getScheduledDayJobs(dayJobs: DayJobLike[]) {
  return sortDayJobs(dayJobs).filter((job) => !!job.startTime)
}

function getTotalWorkMinutes(dayJobs: DayJobLike[]) {
  return getScheduledDayJobs(dayJobs).reduce((total, job) => {
    return total + getJobDurationMinutes(job)
  }, 0)
}

function getWorkMinutesBeforeIndex(dayJobs: DayJobLike[], exclusiveIndex: number) {
  return dayJobs.slice(0, exclusiveIndex).reduce((total, job) => {
    return total + getJobDurationMinutes(job)
  }, 0)
}

function isWorkerBlockedForSlot(params: {
  blocks: Array<{
    startDate: Date
    endDate: Date
    startTime: string | null
    endTime: string | null
    isFullDay: boolean
  }>
  date: Date
  startMinutes: number
  endMinutes: number
}) {
  for (const block of params.blocks) {
    const window = getBlockWindowForDate(block, params.date)
    if (!window) continue

    if (windowsOverlap(params.startMinutes, params.endMinutes, window.start, window.end)) {
      return true
    }
  }

  return false
}

function isWorkerUnavailableForWholeDay(params: {
  blocks: Array<{
    startDate: Date
    endDate: Date
    startTime: string | null
    endTime: string | null
    isFullDay: boolean
  }>
  date: Date
}) {
  return isWorkerBlockedForSlot({
    blocks: params.blocks,
    date: params.date,
    startMinutes: JOBS_START_MINUTES,
    endMinutes: END_OF_DAY_MINUTES,
  })
}

function scoreCandidateJob(params: {
  currentPostcode: string
  worker: WorkerLite
  job: {
    jobType?: string | null
    postcode?: string | null
    address?: string | null
    customer?: { postcode?: string | null } | null
  }
}) {
  const { currentPostcode, worker, job } = params
  const jobPostcode = getJobPostcode(job)
  const travelMinutes = getTravelMinutes(currentPostcode, jobPostcode)

  let score = travelMinutes

  if (isQuoteJobType(job.jobType)) {
    if (isTrevWorker(worker)) {
      score -= 15
    } else {
      score += 5000
    }
  }

  return {
    score,
    travelMinutes,
    jobPostcode,
  }
}

function findBestSlotForJob(params: {
  dayJobs: DayJobLike[]
  candidateJob: JobWithRelations
  blocks: Array<{
    startDate: Date
    endDate: Date
    startTime: string | null
    endTime: string | null
    isFullDay: boolean
  }>
  scheduledDate: Date
}) {
  const { dayJobs, candidateJob, blocks, scheduledDate } = params

  const scheduledJobs = getScheduledDayJobs(dayJobs)
  const duration = getJobDurationMinutes(candidateJob)
  const candidatePostcode = getJobPostcode(candidateJob)
  const totalWorkMinutes = getTotalWorkMinutes(scheduledJobs)
  const breakAlreadyAdded = totalWorkMinutes >= BREAK_THRESHOLD_MINUTES

  let bestSlot:
    | {
        startMinutes: number
        endMinutes: number
      }
    | null = null

  for (let insertIndex = 0; insertIndex <= scheduledJobs.length; insertIndex++) {
    const previousJob = insertIndex > 0 ? scheduledJobs[insertIndex - 1] : null
    const nextJob = insertIndex < scheduledJobs.length ? scheduledJobs[insertIndex] : null

    const previousWindow = previousJob ? clampJobWindow(previousJob.startTime, previousJob.durationMinutes) : null
    const nextWindow = nextJob ? clampJobWindow(nextJob.startTime, nextJob.durationMinutes) : null

    const previousPostcode = previousJob ? getJobPostcode(previousJob) : FARM_POSTCODE
    const nextPostcode = nextJob ? getJobPostcode(nextJob) : ''

    const travelFromPrevious = getTravelMinutes(previousPostcode, candidatePostcode)
    const travelToNext = nextJob ? getTravelMinutes(candidatePostcode, nextPostcode) : 0

    const earliestBaseStart = previousWindow
      ? previousWindow.end + travelFromPrevious
      : Math.max(PREP_START_MINUTES + travelFromPrevious, JOBS_START_MINUTES)

    const workMinutesBefore = getWorkMinutesBeforeIndex(scheduledJobs, insertIndex)
    const breakNeededOnThisPlacement =
      !breakAlreadyAdded &&
      workMinutesBefore < BREAK_THRESHOLD_MINUTES &&
      workMinutesBefore + duration >= BREAK_THRESHOLD_MINUTES

    const extraBreakMinutes = breakNeededOnThisPlacement ? BREAK_DURATION_MINUTES : 0
    const candidateStart = Math.max(earliestBaseStart, JOBS_START_MINUTES)
    const candidateEnd = candidateStart + duration + extraBreakMinutes

    if (candidateEnd > END_OF_DAY_MINUTES) {
      continue
    }

    if (
      isWorkerBlockedForSlot({
        blocks,
        date: scheduledDate,
        startMinutes: candidateStart,
        endMinutes: candidateEnd,
      })
    ) {
      continue
    }

    if (nextWindow) {
      if (candidateEnd + travelToNext > nextWindow.start) {
        continue
      }
    }

    if (
      !bestSlot ||
      candidateStart < bestSlot.startMinutes ||
      (candidateStart === bestSlot.startMinutes && candidateEnd < bestSlot.endMinutes)
    ) {
      bestSlot = {
        startMinutes: candidateStart,
        endMinutes: candidateEnd,
      }
    }
  }

  return bestSlot
}

async function markJobAttention(params: {
  jobId: number
  reason: string
}) {
  await prisma.job.update({
    where: { id: params.jobId },
    data: {
      needsSchedulingAttention: true,
      schedulingAttentionReason: params.reason,
      schedulingLastAttemptAt: new Date(),
    },
  })
}

async function clearJobAttentionAndPlace(params: {
  jobId: number
  visitDate: Date
  startTime: string
}) {
  await prisma.job.update({
    where: { id: params.jobId },
    data: {
      visitDate: params.visitDate,
      startTime: params.startTime,
      status: 'todo',
      needsSchedulingAttention: false,
      schedulingAttentionReason: null,
      schedulingLastAttemptAt: new Date(),
    },
  })
}

async function markJobUnplacedOnWorkerDay(params: {
  jobId: number
  visitDate: Date
  reason: string
}) {
  await prisma.job.update({
    where: { id: params.jobId },
    data: {
      visitDate: params.visitDate,
      startTime: null,
      status: 'unscheduled',
      needsSchedulingAttention: true,
      schedulingAttentionReason: params.reason,
      schedulingLastAttemptAt: new Date(),
    },
  })
}

function getLocalRepairFailureReason(params: {
  job: JobWithRelations
  worker: WorkerLite
  scheduledDate: Date
  blocks: Array<{
    startDate: Date
    endDate: Date
    startTime: string | null
    endTime: string | null
    isFullDay: boolean
  }>
  dayJobs: DayJobLike[]
}) {
  const { job, worker, scheduledDate, blocks, dayJobs } = params

  if (job.assignments.length === 0) {
    return 'No worker assigned'
  }

  if (isQuoteJobType(job.jobType) && !isTrevWorker(worker)) {
    return 'Quote jobs can only be scheduled with Trevor'
  }

  if (
    isWorkerUnavailableForWholeDay({
      blocks,
      date: scheduledDate,
    })
  ) {
    return 'Worker unavailable for this day'
  }

  const duration = getJobDurationMinutes(job)

  if (duration > END_OF_DAY_MINUTES - JOBS_START_MINUTES) {
    return 'Job duration exceeds working day'
  }

  const slot = findBestSlotForJob({
    dayJobs,
    candidateJob: job,
    blocks,
    scheduledDate,
  })

  if (!slot) {
    const totalWorkMinutes = getTotalWorkMinutes(dayJobs)

    if (
      totalWorkMinutes < BREAK_THRESHOLD_MINUTES &&
      totalWorkMinutes + duration >= BREAK_THRESHOLD_MINUTES
    ) {
      return 'Break requirement prevents fit'
    }

    const currentPostcode =
      dayJobs.length > 0
        ? getJobPostcode(dayJobs[dayJobs.length - 1])
        : FARM_POSTCODE

    const jobPostcode = getJobPostcode(job)
    const travelMinutes = getTravelMinutes(currentPostcode, jobPostcode)

    if (travelMinutes >= 45) {
      return 'Travel constraints prevent fit'
    }

    return 'No slot available on assigned worker/day'
  }

  return 'Could not be placed during local repair'
}

async function tryScheduleTrevQuoteJob(params: {
  jobId: number
  duration: number
  worker: WorkerLite
  existingAssignedWorkerIds: number[]
  today: Date
  preferredDate: Date | null
  blocks: Array<{
    startDate: Date
    endDate: Date
    startTime: string | null
    endTime: string | null
    isFullDay: boolean
  }>
}) {
  const { jobId, duration, worker, existingAssignedWorkerIds, today, preferredDate, blocks } = params

  if (!isTrevWorker(worker)) return false
  if (duration > 60) return false

  const datesToTry = preferredDate
    ? [startOfLocalDay(preferredDate)]
    : Array.from({ length: 30 }, (_, i) => startOfLocalDay(addDays(today, i)))

  for (const scheduledDate of datesToTry) {
    const blocked = TREV_QUOTE_DEFAULT_SLOTS.every((slot) => {
      const start = timeToMinutes(slot)
      const end = start + duration
      return isWorkerBlockedForSlot({
        blocks,
        date: scheduledDate,
        startMinutes: start,
        endMinutes: end,
      })
    })

    if (blocked) continue

    const dayStart = startOfLocalDay(scheduledDate)
    const dayEnd = endOfLocalDay(scheduledDate)

    const trevQuoteJobsForDay = await prisma.job.findMany({
      where: {
        id: {
          not: jobId,
        },
        visitDate: {
          gte: dayStart,
          lte: dayEnd,
        },
        jobType: {
          equals: 'Quote',
          mode: 'insensitive',
        },
        assignments: {
          some: {
            workerId: worker.id,
          },
        },
      },
      select: {
        id: true,
        startTime: true,
      },
    })

    if (trevQuoteJobsForDay.length >= 3) {
      continue
    }

    const takenSlots = new Set(
      trevQuoteJobsForDay
        .map((job) => cleanString(job.startTime))
        .filter(Boolean)
    )

    const nextFreeSlot = TREV_QUOTE_DEFAULT_SLOTS.find((slot) => {
      if (takenSlots.has(slot)) return false

      const start = timeToMinutes(slot)
      const end = start + duration

      return !isWorkerBlockedForSlot({
        blocks,
        date: scheduledDate,
        startMinutes: start,
        endMinutes: end,
      })
    })

    if (!nextFreeSlot) continue

    await clearJobAttentionAndPlace({
      jobId,
      visitDate: dayStart,
      startTime: nextFreeSlot,
    })

    if (!existingAssignedWorkerIds.includes(worker.id)) {
      await assignJobToWorkerIfNeeded(jobId, worker.id)
    }

    return true
  }

  await markJobAttention({
    jobId,
    reason: 'No Trev quote slot available in the current scheduling window',
  })

  return false
}

export async function runLocalWorkerDayRepair(params: {
  workerId: number
  date: Date
  reason?: LocalRepairReason
  excludeJobId?: number | null
}): Promise<LocalRepairResult> {
  const repairReason = params.reason ?? 'manual'
  const scheduledDate = startOfLocalDay(params.date)
  const dayStart = startOfLocalDay(scheduledDate)
  const dayEnd = endOfLocalDay(scheduledDate)

  const worker = await prisma.worker.findUnique({
    where: { id: params.workerId },
  })

  if (!worker || !worker.active) {
    return {
      ok: false,
      error: 'Worker not found or inactive',
      workerId: params.workerId,
      date: dayStart.toISOString(),
      reason: repairReason,
      repaired: 0,
      remaining: 0,
      unplacedJobIds: [],
    }
  }

  const blocks = await getActiveBlocksForWorkersRange({
    workerIds: [worker.id],
    startDate: dayStart,
    endDate: dayEnd,
  })

  const assignedJobs = await prisma.job.findMany({
    where: {
      id: params.excludeJobId ? { not: params.excludeJobId } : undefined,
      assignments: {
        some: {
          workerId: worker.id,
        },
      },
      status: {
        notIn: ['done', 'cancelled', 'archived'],
      },
      OR: [
        {
          visitDate: {
            gte: dayStart,
            lte: dayEnd,
          },
        },
        {
          visitDate: null,
          needsSchedulingAttention: true,
        },
        {
          visitDate: null,
          status: 'unscheduled',
        },
      ],
    },
    orderBy: [
      { startTime: 'asc' },
      { createdAt: 'asc' },
    ],
    include: {
      assignments: true,
      customer: {
        select: {
          postcode: true,
        },
      },
    },
  })

  if (assignedJobs.length === 0) {
    return {
      ok: true,
      workerId: worker.id,
      date: dayStart.toISOString(),
      reason: repairReason,
      repaired: 0,
      remaining: 0,
      unplacedJobIds: [],
      message: 'No assigned jobs found to repair for this worker/day',
    }
  }

  for (const job of assignedJobs) {
    await prisma.job.update({
      where: { id: job.id },
      data: {
        visitDate: dayStart,
        startTime: null,
        schedulingLastAttemptAt: new Date(),
      },
    })
  }

  let repaired = 0
  const unplacedJobIds: number[] = []
  let mutableDayJobs: Array<{
    id: number
    startTime: string | null
    durationMinutes: number | null
    postcode?: string | null
    address?: string | null
    customer?: { postcode?: string | null } | null
  }> = []

  const rankedRepairJobs = [...assignedJobs].sort((a, b) => {
    const aStart = a.startTime ?? '99:99'
    const bStart = b.startTime ?? '99:99'
    if (aStart !== bStart) return aStart.localeCompare(bStart)
    return a.createdAt.getTime() - b.createdAt.getTime()
  })

  for (const job of rankedRepairJobs) {
    const existingAssignedWorkerIds = job.assignments.map((assignment) => assignment.workerId)
    const duration = getJobDurationMinutes(job)

    if (isQuoteJobType(job.jobType) && isTrevWorker(worker)) {
      const placed = await tryScheduleTrevQuoteJob({
        jobId: job.id,
        duration,
        worker,
        existingAssignedWorkerIds,
        today: dayStart,
        preferredDate: dayStart,
        blocks,
      })

      if (placed) {
        const refreshedJob = await prisma.job.findUnique({
          where: { id: job.id },
          include: {
            customer: {
              select: {
                postcode: true,
              },
            },
          },
        })

        if (refreshedJob && refreshedJob.startTime) {
          mutableDayJobs = sortDayJobs([...mutableDayJobs, refreshedJob])
        }

        repaired += 1
        continue
      }

      unplacedJobIds.push(job.id)
      await markJobUnplacedOnWorkerDay({
        jobId: job.id,
        visitDate: dayStart,
        reason: 'No Trev quote slot available on assigned worker/day',
      })
      continue
    }

    if (isQuoteJobType(job.jobType) && !isTrevWorker(worker)) {
      unplacedJobIds.push(job.id)
      await markJobUnplacedOnWorkerDay({
        jobId: job.id,
        visitDate: dayStart,
        reason: 'Quote jobs can only be scheduled with Trevor',
      })
      continue
    }

    const slot = findBestSlotForJob({
      dayJobs: mutableDayJobs,
      candidateJob: job,
      blocks,
      scheduledDate: dayStart,
    })

    if (!slot) {
      const reason = getLocalRepairFailureReason({
        job,
        worker,
        scheduledDate: dayStart,
        blocks,
        dayJobs: mutableDayJobs,
      })

      unplacedJobIds.push(job.id)

      await markJobUnplacedOnWorkerDay({
        jobId: job.id,
        visitDate: dayStart,
        reason,
      })

      continue
    }

    await clearJobAttentionAndPlace({
      jobId: job.id,
      visitDate: dayStart,
      startTime: minutesToTime(slot.startMinutes),
    })

    if (!existingAssignedWorkerIds.includes(worker.id)) {
      await assignJobToWorkerIfNeeded(job.id, worker.id)
    }

    const refreshedJob = await prisma.job.findUnique({
      where: { id: job.id },
      include: {
        customer: {
          select: {
            postcode: true,
          },
        },
      },
    })

    if (refreshedJob) {
      mutableDayJobs = sortDayJobs([...mutableDayJobs, refreshedJob])
    }

    repaired += 1
  }

  return {
    ok: true,
    workerId: worker.id,
    date: dayStart.toISOString(),
    reason: repairReason,
    repaired,
    remaining: unplacedJobIds.length,
    unplacedJobIds,
    message:
      unplacedJobIds.length > 0
        ? 'Local worker/day repair completed with some jobs still needing attention'
        : 'Local worker/day repair completed successfully',
  }
}

export async function runLocalRepairForJob(params: {
  jobId: number
  reason?: LocalRepairReason
}): Promise<LocalRepairForJobResult> {
  const repairReason = params.reason ?? 'manual'

  const job = await prisma.job.findUnique({
    where: { id: params.jobId },
    include: {
      assignments: true,
      customer: {
        select: {
          postcode: true,
        },
      },
    },
  })

  if (!job) {
    return {
      ok: false,
      error: 'Job not found',
      jobId: params.jobId,
      repairs: [],
    }
  }

  if (!job.visitDate) {
    return {
      ok: false,
      error: 'Job has no visit date for local repair',
      jobId: params.jobId,
      repairs: [],
    }
  }

  if (job.assignments.length === 0) {
    await markJobAttention({
      jobId: job.id,
      reason: 'No worker assigned',
    })

    return {
      ok: false,
      error: 'Job has no assigned worker for local repair',
      jobId: params.jobId,
      repairs: [],
    }
  }

  const repairs: LocalRepairResult[] = []

  for (const assignment of job.assignments) {
    const repair = await runLocalWorkerDayRepair({
      workerId: assignment.workerId,
      date: job.visitDate,
      reason: repairReason,
      excludeJobId: repairReason === 'cancel' ? job.id : null,
    })

    repairs.push(repair)
  }

  return {
    ok: repairs.every((item) => item.ok),
    jobId: params.jobId,
    repairs,
    message:
      repairs.length > 0
        ? 'Triggered local repair for assigned worker/day'
        : 'No repairs were triggered',
  }
}

export async function runAutoScheduler(
  options?: { skipRecurringTopUp?: boolean }
): Promise<AutoSchedulerResult> {
  const workers = await prisma.worker.findMany({
    where: { active: true },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  })

  const unscheduledJobs = await prisma.job.findMany({
    where: {
      status: {
        notIn: ['done', 'cancelled', 'archived'],
      },
      OR: [
        { status: 'unscheduled' },
        { visitDate: null },
        { startTime: null },
      ],
    },
    orderBy: { createdAt: 'asc' },
    include: {
      assignments: true,
      customer: {
        select: {
          postcode: true,
        },
      },
    },
  })

  if (workers.length === 0) {
    return { ok: false, error: 'No workers found', scheduled: 0, recurringCreated: 0 }
  }

  if (unscheduledJobs.length === 0) {
    if (!options?.skipRecurringTopUp) {
      const recurringTopUp = await ensureRollingRecurringMaintenanceJobs()

      if (recurringTopUp.createdCount > 0) {
        const secondPass = await runAutoScheduler({ skipRecurringTopUp: true })

        return {
          ok: secondPass.ok,
          error: secondPass.ok ? undefined : secondPass.error,
          scheduled: secondPass.scheduled,
          recurringCreated: recurringTopUp.createdCount,
          message: secondPass.message,
        }
      }
    }

    return {
      ok: true,
      scheduled: 0,
      recurringCreated: 0,
      message: 'No unscheduled jobs found',
    }
  }

  const today = startOfLocalDay(new Date())
  const horizonEnd = addDays(today, 30)
  const blocks = await getActiveBlocksForWorkersRange({
    workerIds: workers.map((worker) => worker.id),
    startDate: today,
    endDate: horizonEnd,
  })

  const blocksByWorker = new Map<number, typeof blocks>()
  for (const block of blocks) {
    const current = blocksByWorker.get(block.workerId) || []
    current.push(block)
    blocksByWorker.set(block.workerId, current)
  }

  let scheduledCount = 0
  const scheduledJobIds = new Set<number>()

  for (const worker of workers) {
    const workerBlocks = blocksByWorker.get(worker.id) || []

    const workerExistingJobs = await prisma.job.findMany({
      where: {
        assignments: {
          some: {
            workerId: worker.id,
          },
        },
        visitDate: {
          gte: today,
        },
        status: {
          notIn: ['done', 'cancelled'],
        },
      },
      orderBy: [
        { visitDate: 'asc' },
        { startTime: 'asc' },
        { createdAt: 'asc' },
      ],
      include: {
        customer: {
          select: {
            postcode: true,
          },
        },
      },
    })

    for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
      const scheduledDate = startOfLocalDay(addDays(today, dayOffset))

      let mutableDayJobs = sortDayJobs(
        workerExistingJobs.filter((existingJob) => {
          if (!existingJob.visitDate) return false
          return sameLocalDay(existingJob.visitDate, scheduledDate)
        })
      )

      while (true) {
        const availableJobs = unscheduledJobs.filter((job) => {
          if (scheduledJobIds.has(job.id)) return false

          if (job.visitDate) {
            return sameLocalDay(job.visitDate, scheduledDate)
          }

          return true
        })

        if (availableJobs.length === 0) {
          break
        }

        const currentPostcode =
          mutableDayJobs.length > 0
            ? getJobPostcode(mutableDayJobs[mutableDayJobs.length - 1])
            : FARM_POSTCODE

        const rankedJobs = availableJobs
          .map((job) => {
            const candidate = scoreCandidateJob({
              currentPostcode,
              worker,
              job,
            })

            return {
              job,
              ...candidate,
            }
          })
          .sort((a, b) => {
            if (a.score !== b.score) return a.score - b.score
            return a.job.createdAt.getTime() - b.job.createdAt.getTime()
          })

        let placedOne = false

        for (const candidate of rankedJobs) {
          const job = candidate.job
          const duration = getJobDurationMinutes(job)
          const existingAssignedWorkerIds = job.assignments.map((assignment) => assignment.workerId)

          if (isQuoteJobType(job.jobType) && isTrevWorker(worker)) {
            const trevQuoteScheduled = await tryScheduleTrevQuoteJob({
              jobId: job.id,
              duration,
              worker,
              existingAssignedWorkerIds,
              today,
              preferredDate: job.visitDate,
              blocks: workerBlocks,
            })

            if (trevQuoteScheduled) {
              const refreshedJob = await prisma.job.findUnique({
                where: { id: job.id },
                include: {
                  customer: {
                    select: {
                      postcode: true,
                    },
                  },
                },
              })

              if (refreshedJob && refreshedJob.visitDate && sameLocalDay(refreshedJob.visitDate, scheduledDate)) {
                mutableDayJobs = sortDayJobs([...mutableDayJobs, refreshedJob])
                workerExistingJobs.push(refreshedJob)
              }

              scheduledJobIds.add(job.id)
              scheduledCount += 1
              placedOne = true
              break
            }

            continue
          }

          if (isQuoteJobType(job.jobType) && !isTrevWorker(worker)) {
            continue
          }

          const slot = findBestSlotForJob({
            dayJobs: mutableDayJobs,
            candidateJob: job,
            blocks: workerBlocks,
            scheduledDate,
          })

          if (!slot) {
            continue
          }

          const storedDate = startOfLocalDay(job.visitDate ? job.visitDate : scheduledDate)

          await clearJobAttentionAndPlace({
            jobId: job.id,
            visitDate: storedDate,
            startTime: minutesToTime(slot.startMinutes),
          })

          if (!existingAssignedWorkerIds.includes(worker.id)) {
            await assignJobToWorkerIfNeeded(job.id, worker.id)
          }

          const refreshedJob = await prisma.job.findUnique({
            where: { id: job.id },
            include: {
              customer: {
                select: {
                  postcode: true,
                },
              },
            },
          })

          if (refreshedJob) {
            mutableDayJobs = sortDayJobs([...mutableDayJobs, refreshedJob])
            workerExistingJobs.push(refreshedJob)
          }

          scheduledJobIds.add(job.id)
          scheduledCount += 1
          placedOne = true
          break
        }

        if (!placedOne) {
          break
        }
      }
    }
  }

  const remainingJobIds = unscheduledJobs
    .filter((job) => !scheduledJobIds.has(job.id))
    .map((job) => job.id)

  if (remainingJobIds.length > 0) {
    const now = new Date()

    for (const job of unscheduledJobs.filter((item) => remainingJobIds.includes(item.id))) {
      const reason =
        job.assignments.length === 0
          ? 'No worker assigned'
          : isQuoteJobType(job.jobType) &&
              !job.assignments.some((assignment) => {
                const worker = workers.find((item) => item.id === assignment.workerId)
                return worker ? isTrevWorker(worker) : false
              })
            ? 'Quote jobs can only be scheduled with Trevor'
            : 'Unscheduled after full scheduler pass'

      await prisma.job.update({
        where: { id: job.id },
        data: {
          needsSchedulingAttention: true,
          schedulingAttentionReason: reason,
          schedulingLastAttemptAt: now,
        },
      })
    }
  }

  let recurringCreated = 0

  if (!options?.skipRecurringTopUp) {
    const recurringTopUp = await ensureRollingRecurringMaintenanceJobs()
    recurringCreated = recurringTopUp.createdCount

    if (recurringTopUp.createdCount > 0) {
      const secondPass = await runAutoScheduler({ skipRecurringTopUp: true })

      return {
        ok: secondPass.ok,
        error: secondPass.ok ? undefined : secondPass.error,
        scheduled: scheduledCount + secondPass.scheduled,
        recurringCreated: recurringTopUp.createdCount,
        message: secondPass.message,
      }
    }
  }

  return {
    ok: true,
    scheduled: scheduledCount,
    recurringCreated,
  }
}