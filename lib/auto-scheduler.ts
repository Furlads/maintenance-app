// lib/auto-scheduler.ts

import prisma from '@/lib/prisma'
import {
  addDays,
  cleanString,
  endOfLocalDay,
  getActiveBlocksForWorkersRange,
  getBlockWindowForDate,
  sameLocalDay,
  startOfLocalDay,
  minutesToTime,
  windowsOverlap,
} from '@/lib/time-off'

const FARM_POSTCODE = 'TF9 4BQ'

const PREP_START_MINUTES = 8 * 60 + 30
const JOBS_START_MINUTES = 9 * 60
const END_OF_DAY_MINUTES = 16 * 60 + 30
const BREAK_THRESHOLD_MINUTES = 6 * 60
const BREAK_DURATION_MINUTES = 20
const SCHEDULER_HORIZON_DAYS = 30
const MIN_TRAVEL_SAVING_TO_APPLY = 5

// -------------------------
// TYPES
// -------------------------

type WorkerLite = {
  id: number
  firstName: string | null
  lastName: string | null
  email?: string | null
  active?: boolean | null
}

type WorkerBlock = {
  workerId: number
  startDate: Date
  endDate: Date
  startTime: string | null
  endTime: string | null
  isFullDay: boolean
}

type DayJobLike = {
  id: number
  startTime?: string | null
  durationMinutes?: number | null
  postcode?: string | null
  address?: string | null
  customer?: { postcode?: string | null } | null
  jobType?: string | null
  createdAt?: Date
  visitDate?: Date | null
  status?: string | null
  assignments?: Array<{ workerId: number }>
}

type RouteScheduleItem = {
  jobId: number
  startMinutes: number
  endMinutes: number
}

type AutoSchedulerResult = {
  ok: boolean
  scheduled: number
  optimisedDays: number
  travelMinutesSaved: number
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

// -------------------------
// POSTCODE + TRAVEL
// -------------------------

function normalisePostcode(value: unknown) {
  return cleanString(value).toUpperCase()
}

function postcodeOutward(value: unknown) {
  const postcode = normalisePostcode(value)
  if (!postcode) return ''
  return postcode.split(' ')[0] || ''
}

function postcodeDistrict(value: unknown) {
  const outward = postcodeOutward(value)
  const match = outward.match(/^([A-Z]+)(\d+)/)
  if (!match) return null
  return { area: match[1], district: Number(match[2]) }
}

function postcodeAreaLetters(value: unknown) {
  const outward = postcodeOutward(value)
  const match = outward.match(/^[A-Z]+/)
  return match ? match[0] : ''
}

function getTravelMinutes(fromPostcode: unknown, toPostcode: unknown) {
  const from = normalisePostcode(fromPostcode)
  const to = normalisePostcode(toPostcode)

  if (!from || !to) return 30
  if (from === to) return 10

  const fromOutward = postcodeOutward(from)
  const toOutward = postcodeOutward(to)

  if (fromOutward && toOutward && fromOutward === toOutward) return 12

  const fromDistrict = postcodeDistrict(from)
  const toDistrict = postcodeDistrict(to)

  if (
    fromDistrict &&
    toDistrict &&
    fromDistrict.area === toDistrict.area
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
    ['TF', 'ST', 'SY', 'CW'].includes(fromArea) &&
    ['TF', 'ST', 'SY', 'CW'].includes(toArea)
  ) {
    return 50
  }

  return 60
}

// -------------------------
// HELPERS
// -------------------------

function getJobPostcode(job: DayJobLike) {
  return (
    normalisePostcode(job.postcode) ||
    normalisePostcode(job.customer?.postcode) ||
    ''
  )
}

function getJobDurationMinutes(job: DayJobLike) {
  return job.durationMinutes && job.durationMinutes > 0
    ? job.durationMinutes
    : 120
}

function sortJobs(jobs: DayJobLike[]) {
  return [...jobs].sort((a, b) => {
    const aStart = a.startTime ?? '99:99'
    const bStart = b.startTime ?? '99:99'
    if (aStart !== bStart) return aStart.localeCompare(bStart)

    const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0
    if (aCreated !== bCreated) return aCreated - bCreated

    return a.id - b.id
  })
}

function isQuoteJob(job: DayJobLike) {
  const value = cleanString(job.jobType).toLowerCase()
  return value === 'quote' || value === 'quoted'
}

function calculateRouteTravel(jobs: DayJobLike[]) {
  let total = 0
  let prev = FARM_POSTCODE

  for (const job of jobs) {
    const pc = getJobPostcode(job)
    total += getTravelMinutes(prev, pc)
    prev = pc || prev
  }

  return total
}

function optimiseOrder(jobs: DayJobLike[]) {
  if (jobs.length <= 2) return jobs

  // Leave quote days alone for safety
  if (jobs.some((job) => isQuoteJob(job))) {
    return jobs
  }

  const remaining = [...jobs]
  const ordered: DayJobLike[] = []

  let prev = FARM_POSTCODE

  while (remaining.length) {
    remaining.sort((a, b) => {
      const ta = getTravelMinutes(prev, getJobPostcode(a))
      const tb = getTravelMinutes(prev, getJobPostcode(b))
      if (ta !== tb) return ta - tb

      const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0
      if (aCreated !== bCreated) return aCreated - bCreated

      return a.id - b.id
    })

    const next = remaining.shift()
    if (!next) break

    ordered.push(next)
    prev = getJobPostcode(next) || prev
  }

  return ordered
}

function isWorkerBlockedForSlot(params: {
  blocks: WorkerBlock[]
  date: Date
  startMinutes: number
  endMinutes: number
}) {
  for (const block of params.blocks) {
    const window = getBlockWindowForDate(block, params.date)
    if (!window) continue

    if (
      windowsOverlap(
        params.startMinutes,
        params.endMinutes,
        window.start,
        window.end
      )
    ) {
      return true
    }
  }

  return false
}

function buildRouteSchedule(params: {
  date: Date
  jobs: DayJobLike[]
  blocks: WorkerBlock[]
}) {
  const { date, jobs, blocks } = params

  let currentMinutes = PREP_START_MINUTES
  let previousPostcode = FARM_POSTCODE
  let workedMinutes = 0
  let breakInserted = false

  const schedule: RouteScheduleItem[] = []

  for (const job of jobs) {
    const travelMinutes = getTravelMinutes(
      previousPostcode,
      getJobPostcode(job)
    )

    let startMinutes = Math.max(
      currentMinutes + travelMinutes,
      JOBS_START_MINUTES
    )

    const durationMinutes = getJobDurationMinutes(job)

    if (
      !breakInserted &&
      workedMinutes < BREAK_THRESHOLD_MINUTES &&
      workedMinutes + durationMinutes >= BREAK_THRESHOLD_MINUTES
    ) {
      startMinutes += BREAK_DURATION_MINUTES
      breakInserted = true
    }

    const endMinutes = startMinutes + durationMinutes

    if (endMinutes > END_OF_DAY_MINUTES) {
      return null
    }

    if (
      isWorkerBlockedForSlot({
        blocks,
        date,
        startMinutes,
        endMinutes,
      })
    ) {
      return null
    }

    schedule.push({
      jobId: job.id,
      startMinutes,
      endMinutes,
    })

    currentMinutes = endMinutes
    workedMinutes += durationMinutes
    previousPostcode = getJobPostcode(job) || previousPostcode
  }

  return schedule
}

async function applyOptimisedRoute(params: {
  worker: WorkerLite
  date: Date
  jobs: DayJobLike[]
  blocks: WorkerBlock[]
}) {
  const { date, jobs, blocks } = params

  const sorted = sortJobs(jobs)

  if (sorted.length <= 1) {
    return { improved: false, saved: 0 }
  }

  const originalTravel = calculateRouteTravel(sorted)
  const optimised = optimiseOrder(sorted)
  const newTravel = calculateRouteTravel(optimised)
  const saved = originalTravel - newTravel

  if (saved < MIN_TRAVEL_SAVING_TO_APPLY) {
    return { improved: false, saved: 0 }
  }

  const rebuiltSchedule = buildRouteSchedule({
    date,
    jobs: optimised,
    blocks,
  })

  if (!rebuiltSchedule) {
    return { improved: false, saved: 0 }
  }

  for (const item of rebuiltSchedule) {
    await prisma.job.update({
      where: { id: item.jobId },
      data: {
        visitDate: startOfLocalDay(date),
        startTime: minutesToTime(item.startMinutes),
      },
    })
  }

  return {
    improved: true,
    saved,
  }
}

function buildDayKey(workerId: number, date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${workerId}__${year}-${month}-${day}`
}

// -------------------------
// LOCAL REPAIR HELPERS
// -------------------------

async function getWorkerDayJobs(params: {
  workerId: number
  date: Date
  excludeJobId?: number | null
}) {
  const dayStart = startOfLocalDay(params.date)
  const dayEnd = endOfLocalDay(params.date)

  return (await prisma.job.findMany({
    where: {
      id: params.excludeJobId ? { not: params.excludeJobId } : undefined,
      visitDate: {
        gte: dayStart,
        lte: dayEnd,
      },
      status: {
        notIn: ['done', 'cancelled', 'archived', 'unscheduled'],
      },
      assignments: {
        some: {
          workerId: params.workerId,
        },
      },
    },
    include: {
      customer: true,
      assignments: true,
    },
    orderBy: [
      { startTime: 'asc' },
      { createdAt: 'asc' },
    ],
  })) as DayJobLike[]
}

export async function runLocalWorkerDayRepair(params: {
  workerId: number
  date: Date
  reason?: LocalRepairReason
  excludeJobId?: number | null
}): Promise<LocalRepairResult> {
  const repairReason = params.reason ?? 'manual'
  const day = startOfLocalDay(params.date)

  const worker = (await prisma.worker.findUnique({
    where: { id: params.workerId },
  })) as WorkerLite | null

  if (!worker || !worker.active) {
    return {
      ok: false,
      error: 'Worker not found or inactive',
      workerId: params.workerId,
      date: day.toISOString(),
      reason: repairReason,
      repaired: 0,
      remaining: 0,
      unplacedJobIds: [],
    }
  }

  const blocks = (await getActiveBlocksForWorkersRange({
    workerIds: [worker.id],
    startDate: day,
    endDate: day,
  })) as WorkerBlock[]

  const jobs = await getWorkerDayJobs({
    workerId: worker.id,
    date: day,
    excludeJobId: params.excludeJobId ?? null,
  })

  if (jobs.length <= 1) {
    return {
      ok: true,
      workerId: worker.id,
      date: day.toISOString(),
      reason: repairReason,
      repaired: 0,
      remaining: 0,
      unplacedJobIds: [],
      message: jobs.length === 0
        ? 'No assigned jobs found for this worker/day'
        : 'Only one job on this worker/day, nothing to optimise',
    }
  }

  const result = await applyOptimisedRoute({
    worker,
    date: day,
    jobs,
    blocks,
  })

  return {
    ok: true,
    workerId: worker.id,
    date: day.toISOString(),
    reason: repairReason,
    repaired: result.improved ? jobs.length : 0,
    remaining: 0,
    unplacedJobIds: [],
    message: result.improved
      ? `Route improved and saved ${result.saved} mins travel`
      : 'No more economical route found for this worker/day',
  }
}

export async function runLocalRepairForJob(params: {
  jobId: number
  reason?: LocalRepairReason
}): Promise<LocalRepairForJobResult> {
  const repairReason = params.reason ?? 'manual'

  const job = (await prisma.job.findUnique({
    where: { id: params.jobId },
    include: {
      customer: true,
      assignments: true,
    },
  })) as DayJobLike | null

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

  if (!job.assignments?.length) {
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
      date: new Date(job.visitDate),
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

// -------------------------
// MAIN AUTO SCHEDULER
// -------------------------

export async function runAutoScheduler(): Promise<AutoSchedulerResult> {
  const workers = (await prisma.worker.findMany({
    where: { active: true },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  })) as WorkerLite[]

  const today = startOfLocalDay(new Date())
  const horizonEnd = endOfLocalDay(addDays(today, SCHEDULER_HORIZON_DAYS))

  const jobs = (await prisma.job.findMany({
    where: {
      visitDate: {
        gte: today,
        lte: horizonEnd,
      },
      status: {
        notIn: ['done', 'cancelled', 'archived', 'unscheduled'],
      },
      assignments: {
        some: {},
      },
    },
    include: {
      customer: true,
      assignments: true,
    },
    orderBy: [
      { visitDate: 'asc' },
      { startTime: 'asc' },
      { createdAt: 'asc' },
    ],
  })) as DayJobLike[]

  const blocks = (await getActiveBlocksForWorkersRange({
    workerIds: workers.map((worker) => worker.id),
    startDate: today,
    endDate: horizonEnd,
  })) as WorkerBlock[]

  const blocksByWorker = new Map<number, WorkerBlock[]>()
  for (const block of blocks) {
    const current = blocksByWorker.get(block.workerId) || []
    current.push(block)
    blocksByWorker.set(block.workerId, current)
  }

  const jobsByWorkerDay = new Map<string, DayJobLike[]>()

  for (const job of jobs) {
    if (!job.visitDate || !job.assignments?.length) continue

    for (const assignment of job.assignments) {
      const key = buildDayKey(assignment.workerId, new Date(job.visitDate))
      const current = jobsByWorkerDay.get(key) || []
      current.push(job)
      jobsByWorkerDay.set(key, current)
    }
  }

  let optimisedDays = 0
  let travelMinutesSaved = 0

  for (const worker of workers) {
    for (let offset = 0; offset <= SCHEDULER_HORIZON_DAYS; offset++) {
      const day = startOfLocalDay(addDays(today, offset))
      const key = buildDayKey(worker.id, day)
      const workerDayJobs = jobsByWorkerDay.get(key) || []

      if (workerDayJobs.length <= 1) continue

      const workerBlocks = blocksByWorker.get(worker.id) || []

      const result = await applyOptimisedRoute({
        worker,
        date: day,
        jobs: workerDayJobs,
        blocks: workerBlocks,
      })

      if (result.improved) {
        optimisedDays += 1
        travelMinutesSaved += result.saved
      }
    }
  }

  return {
    ok: true,
    scheduled: 0,
    optimisedDays,
    travelMinutesSaved,
    message:
      optimisedDays > 0
        ? `Improved ${optimisedDays} day${
            optimisedDays === 1 ? '' : 's'
          } and saved ${travelMinutesSaved} mins travel`
        : 'No more economical route found',
  }
}