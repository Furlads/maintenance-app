import prisma from '@/lib/prisma'
import {
  addDays,
  cleanString,
  clampJobWindow,
  endOfLocalDay,
  getActiveBlocksForWorkerRange,
  getBlockWindowForDate,
  sameLocalDay,
  startOfLocalDay,
  timeToMinutes,
  minutesToTime,
  windowsOverlap,
} from '@/lib/time-off'

const TREV_QUOTE_DEFAULT_SLOTS = ['11:00', '12:00', '13:00']
const FARM_POSTCODE = 'TF9 4BQ'

const PREP_START_MINUTES = 8 * 60 + 30
const JOBS_START_MINUTES = 9 * 60
const END_OF_DAY_MINUTES = 19 * 60
const BREAK_THRESHOLD_MINUTES = 6 * 60
const BREAK_DURATION_MINUTES = 20
const DEFAULT_REPAIR_HORIZON_DAYS = 42

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
  fixedSchedule?: boolean | null
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
  fixedSchedule?: boolean | null
  durationMinutes?: number | null
  postcode?: string | null
  address?: string | null
  customer?: { postcode?: string | null } | null
}

type RepairResult = {
  ok: boolean
  repaired: number
  remaining: number
  repairedJobIds: number[]
  remainingJobIds: number[]
  error?: string
}

type RefitSingleJobResult = {
  ok: boolean
  repaired: boolean
  jobId: number
  workerId?: number
  remaining: number
  repairedJobIds: number[]
  remainingJobIds: number[]
  error?: string
}

type RefitWorkerDayResult = {
  ok: boolean
  workerId: number
  date: string
  repaired: number
  remaining: number
  repairedJobIds: number[]
  remainingJobIds: number[]
  error?: string
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

function sortDayJobs<
  T extends { startTime?: string | null; fixedSchedule?: boolean | null; id: number }
>(jobs: T[]) {
  return [...jobs].sort((a, b) => {
    const aStart = a.startTime ?? '99:99'
    const bStart = b.startTime ?? '99:99'
    if (aStart !== bStart) return aStart.localeCompare(bStart)

    const aFixed = a.fixedSchedule ? 0 : 1
    const bFixed = b.fixedSchedule ? 0 : 1
    if (aFixed !== bFixed) return aFixed - bFixed

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

    const previousWindow = previousJob
      ? clampJobWindow(previousJob.startTime, previousJob.durationMinutes)
      : null
    const nextWindow = nextJob
      ? clampJobWindow(nextJob.startTime, nextJob.durationMinutes)
      : null

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
      status: 'unscheduled',
      fixedSchedule: false,
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
      fixedSchedule: false,
    },
  })
}

async function tryScheduleTrevQuoteJob(params: {
  jobId: number
  duration: number
  worker: WorkerLite
  existingAssignedWorkerIds: number[]
  startDate: Date
  blocks: Array<{
    startDate: Date
    endDate: Date
    startTime: string | null
    endTime: string | null
    isFullDay: boolean
  }>
  daysToScan: number
}) {
  const { jobId, duration, worker, existingAssignedWorkerIds, startDate, blocks, daysToScan } = params

  if (!isTrevWorker(worker)) return false
  if (duration > 60) return false

  const datesToTry = Array.from({ length: daysToScan }, (_, i) =>
    startOfLocalDay(addDays(startDate, i))
  )

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
        status: {
          notIn: ['done', 'cancelled', 'archived'],
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
      await prisma.jobAssignment.create({
        data: {
          jobId,
          workerId: worker.id,
        },
      })
    }

    return true
  }

  await markJobAttention({
    jobId,
    reason: 'No Trev quote slot available in the repair window',
  })

  return false
}

export async function repairAssignedJobsForWorker(params: {
  workerId: number
  jobIds: number[]
  startDate: Date
  daysToScan?: number
}): Promise<RepairResult> {
  const daysToScan = params.daysToScan ?? DEFAULT_REPAIR_HORIZON_DAYS
  const repairStartDate = startOfLocalDay(params.startDate)
  const repairEndDate = endOfLocalDay(addDays(repairStartDate, Math.max(daysToScan - 1, 0)))

  const worker = await prisma.worker.findUnique({
    where: { id: params.workerId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      active: true,
    },
  })

  if (!worker || !worker.active) {
    return {
      ok: false,
      repaired: 0,
      remaining: params.jobIds.length,
      repairedJobIds: [],
      remainingJobIds: [...params.jobIds],
      error: 'Worker not found or inactive',
    }
  }

  const uniqueJobIds = [...new Set(params.jobIds.filter((id) => Number.isInteger(id) && id > 0))]

  if (uniqueJobIds.length === 0) {
    return {
      ok: true,
      repaired: 0,
      remaining: 0,
      repairedJobIds: [],
      remainingJobIds: [],
    }
  }

  const candidateJobs = await prisma.job.findMany({
    where: {
      id: {
        in: uniqueJobIds,
      },
      assignments: {
        some: {
          workerId: params.workerId,
        },
      },
      status: {
        notIn: ['done', 'cancelled', 'archived'],
      },
    },
    orderBy: [{ createdAt: 'asc' }],
    include: {
      assignments: true,
      customer: {
        select: {
          postcode: true,
        },
      },
    },
  })

  const candidateJobsById = new Map(candidateJobs.map((job) => [job.id, job]))

  const workerBlocks = await getActiveBlocksForWorkerRange({
    workerId: params.workerId,
    startDate: repairStartDate,
    endDate: repairEndDate,
  })

  const workerExistingJobs = await prisma.job.findMany({
    where: {
      id: {
        notIn: uniqueJobIds,
      },
      assignments: {
        some: {
          workerId: params.workerId,
        },
      },
      visitDate: {
        gte: repairStartDate,
        lte: repairEndDate,
      },
      status: {
        notIn: ['done', 'cancelled', 'archived'],
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

  const repairedJobIds: number[] = []
  const scheduledJobIds = new Set<number>()

  for (let dayOffset = 0; dayOffset < daysToScan; dayOffset++) {
    const scheduledDate = startOfLocalDay(addDays(repairStartDate, dayOffset))

    let mutableDayJobs = sortDayJobs(
      workerExistingJobs.filter((existingJob) => {
        if (!existingJob.visitDate) return false
        return sameLocalDay(existingJob.visitDate, scheduledDate)
      })
    )

    while (true) {
      const availableJobs = candidateJobs.filter((job) => {
        if (scheduledJobIds.has(job.id)) return false
        if (job.fixedSchedule) return false

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
            startDate: scheduledDate,
            blocks: workerBlocks,
            daysToScan: Math.max(daysToScan - dayOffset, 1),
          })

          if (trevQuoteScheduled) {
            scheduledJobIds.add(job.id)
            repairedJobIds.push(job.id)

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

        await clearJobAttentionAndPlace({
          jobId: job.id,
          visitDate: scheduledDate,
          startTime: minutesToTime(slot.startMinutes),
        })

        scheduledJobIds.add(job.id)
        repairedJobIds.push(job.id)

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

        placedOne = true
        break
      }

      if (!placedOne) {
        break
      }
    }
  }

  const remainingJobIds = uniqueJobIds.filter((jobId) => !scheduledJobIds.has(jobId))

  for (const jobId of remainingJobIds) {
    const job = candidateJobsById.get(jobId)
    if (!job || job.fixedSchedule) continue

    await prisma.job.update({
      where: { id: jobId },
      data: {
        visitDate: null,
        startTime: null,
        status: 'unscheduled',
        fixedSchedule: false,
      },
    })
  }

  return {
    ok: true,
    repaired: repairedJobIds.length,
    remaining: remainingJobIds.length,
    repairedJobIds,
    remainingJobIds,
  }
}

export async function refitSingleAssignedJob(params: {
  jobId: number
  startDate?: Date
  daysToScan?: number
}): Promise<RefitSingleJobResult> {
  const job = await prisma.job.findUnique({
    where: { id: params.jobId },
    include: {
      assignments: true,
    },
  })

  if (!job) {
    return {
      ok: false,
      repaired: false,
      jobId: params.jobId,
      remaining: 1,
      repairedJobIds: [],
      remainingJobIds: [params.jobId],
      error: 'Job not found',
    }
  }

  if (job.fixedSchedule) {
    return {
      ok: false,
      repaired: false,
      jobId: job.id,
      remaining: 1,
      repairedJobIds: [],
      remainingJobIds: [job.id],
      error: 'This job is locked to its current date and time',
    }
  }

  if (job.status === 'done' || job.status === 'cancelled' || job.status === 'archived') {
    return {
      ok: false,
      repaired: false,
      jobId: job.id,
      remaining: 1,
      repairedJobIds: [],
      remainingJobIds: [job.id],
      error: 'This job cannot be re-fitted in its current status',
    }
  }

  if (job.assignments.length === 0) {
    await markJobAttention({
      jobId: job.id,
      reason: 'Cannot re-fit because no worker is assigned',
    })

    return {
      ok: false,
      repaired: false,
      jobId: job.id,
      remaining: 1,
      repairedJobIds: [],
      remainingJobIds: [job.id],
      error: 'No worker assigned',
    }
  }

  const workerId = job.assignments[0].workerId
  const repairStartDate = params.startDate ?? job.visitDate ?? new Date()

  await prisma.job.update({
    where: { id: job.id },
    data: {
      visitDate: null,
      startTime: null,
      status: 'unscheduled',
      fixedSchedule: false,
    },
  })

  const result = await repairAssignedJobsForWorker({
    workerId,
    jobIds: [job.id],
    startDate: repairStartDate,
    daysToScan: params.daysToScan,
  })

  return {
    ok: result.ok,
    repaired: result.repaired > 0,
    jobId: job.id,
    workerId,
    remaining: result.remaining,
    repairedJobIds: result.repairedJobIds,
    remainingJobIds: result.remainingJobIds,
    error: result.error,
  }
}

export async function refitWorkerDay(params: {
  workerId: number
  date: Date
  daysToScan?: number
}): Promise<RefitWorkerDayResult> {
  const dayStart = startOfLocalDay(params.date)
  const dayEnd = endOfLocalDay(params.date)

  const worker = await prisma.worker.findUnique({
    where: { id: params.workerId },
    select: {
      id: true,
      active: true,
    },
  })

  const dateLabel = dayStart.toISOString().split('T')[0]

  if (!worker || !worker.active) {
    return {
      ok: false,
      workerId: params.workerId,
      date: dateLabel,
      repaired: 0,
      remaining: 0,
      repairedJobIds: [],
      remainingJobIds: [],
      error: 'Worker not found or inactive',
    }
  }

  const dayJobs = await prisma.job.findMany({
    where: {
      assignments: {
        some: {
          workerId: params.workerId,
        },
      },
      visitDate: {
        gte: dayStart,
        lte: dayEnd,
      },
      status: {
        notIn: ['done', 'cancelled', 'archived'],
      },
    },
    orderBy: [
      { startTime: 'asc' },
      { createdAt: 'asc' },
    ],
    select: {
      id: true,
      fixedSchedule: true,
    },
  })

  const targetJobIds = dayJobs
    .filter((job: { fixedSchedule?: boolean | null }) => !job.fixedSchedule)
    .map((job) => job.id)

  if (targetJobIds.length === 0) {
    return {
      ok: true,
      workerId: params.workerId,
      date: dateLabel,
      repaired: 0,
      remaining: 0,
      repairedJobIds: [],
      remainingJobIds: [],
    }
  }

  await prisma.job.updateMany({
    where: {
      id: {
        in: targetJobIds,
      },
    },
    data: {
      visitDate: null,
      startTime: null,
      status: 'unscheduled',
      fixedSchedule: false,
    },
  })

  const result = await repairAssignedJobsForWorker({
    workerId: params.workerId,
    jobIds: targetJobIds,
    startDate: dayStart,
    daysToScan: params.daysToScan,
  })

  return {
    ok: result.ok,
    workerId: params.workerId,
    date: dateLabel,
    repaired: result.repaired,
    remaining: result.remaining,
    repairedJobIds: result.repairedJobIds,
    remainingJobIds: result.remainingJobIds,
    error: result.error,
  }
}