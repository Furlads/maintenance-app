// lib/auto-scheduler.ts

import prisma from '@/lib/prisma'
import {
  addDays,
  cleanString,
  endOfLocalDay,
  getActiveBlocksForWorkersRange,
  getBlockWindowForDate,
  startOfLocalDay,
  minutesToTime,
  windowsOverlap,
} from '@/lib/time-off'

const FARM_POSTCODE = 'TF9 4BQ'

const PREP_START_MINUTES = 8 * 60 + 30
const JOBS_START_MINUTES = 9 * 60
const END_OF_DAY_MINUTES = 19 * 60
const BREAK_THRESHOLD_MINUTES = 6 * 60
const BREAK_DURATION_MINUTES = 20
const SCHEDULER_HORIZON_DAYS = 30
const MIN_TRAVEL_SAVING_TO_APPLY = 1

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
  fixedSchedule?: boolean | null
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
  optimised?: boolean
  travelMinutesSaved?: number
  reorderedJobs?: number
  warning?: string | null
}

type LocalRepairForJobResult = {
  ok: boolean
  error?: string
  jobId: number
  repairs: LocalRepairResult[]
  message?: string
}

type ApplyOptimisedRouteResult = {
  improved: boolean
  saved: number
  reorderedJobs: number
  compacted: boolean
  updatedTimes: number
  warning: string | null
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

function timeToMinutes(value: string | null | undefined) {
  const cleaned = cleanString(value)
  if (!/^\d{2}:\d{2}$/.test(cleaned)) return null

  const [hours, minutes] = cleaned.split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null

  return hours * 60 + minutes
}

function sortJobs(jobs: DayJobLike[]) {
  return [...jobs].sort((a, b) => {
    const aStart = a.startTime ?? '99:99'
    const bStart = b.startTime ?? '99:99'
    if (aStart !== bStart) return aStart.localeCompare(bStart)

    const aFixed = a.fixedSchedule ? 0 : 1
    const bFixed = b.fixedSchedule ? 0 : 1
    if (aFixed !== bFixed) return aFixed - bFixed

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

  if (jobs.length > 0) {
    total += getTravelMinutes(prev, FARM_POSTCODE)
  }

  return total
}

function optimiseOrder(jobs: DayJobLike[]) {
  if (jobs.length <= 2) return jobs

  const hasFixedJobs = jobs.some((job) => job.fixedSchedule && job.startTime)
  if (hasFixedJobs) {
    return sortJobs(jobs)
  }

  const quoteJobs = jobs.filter((job) => isQuoteJob(job))
  const nonQuoteJobs = jobs.filter((job) => !isQuoteJob(job))

  if (nonQuoteJobs.length <= 1) {
    return jobs
  }

  function buildNearestRoute(items: DayJobLike[], startPostcode: string) {
    const remaining = [...items]
    const ordered: DayJobLike[] = []
    let prev = startPostcode

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

  function calculateRouteTravelFromStart(items: DayJobLike[], startPostcode: string) {
    let total = 0
    let prev = startPostcode

    for (const job of items) {
      const pc = getJobPostcode(job)
      total += getTravelMinutes(prev, pc)
      prev = pc || prev
    }

    return total
  }

  const nearestFirstRoute = buildNearestRoute(nonQuoteJobs, FARM_POSTCODE)

  let furthestJob = nonQuoteJobs[0]
  let furthestMinutes = -1

  for (const job of nonQuoteJobs) {
    const travelFromFarm = getTravelMinutes(FARM_POSTCODE, getJobPostcode(job))
    if (travelFromFarm > furthestMinutes) {
      furthestMinutes = travelFromFarm
      furthestJob = job
    }
  }

  const remainingAfterFurthest = nonQuoteJobs.filter((job) => job.id !== furthestJob.id)
  const furthestFirstRoute = [
    furthestJob,
    ...buildNearestRoute(
      remainingAfterFurthest,
      getJobPostcode(furthestJob) || FARM_POSTCODE
    ),
  ]

  const nearestFirstTravel = calculateRouteTravelFromStart(
    nearestFirstRoute,
    FARM_POSTCODE
  )
  const furthestFirstTravel = calculateRouteTravelFromStart(
    furthestFirstRoute,
    FARM_POSTCODE
  )

  const bestFlexibleRoute =
    furthestFirstTravel < nearestFirstTravel
      ? furthestFirstRoute
      : nearestFirstRoute

  return [...quoteJobs, ...bestFlexibleRoute]
}

function countReorderedJobs(original: DayJobLike[], optimised: DayJobLike[]) {
  const originalIds = original.map((job) => job.id)
  const optimisedIds = optimised.map((job) => job.id)

  let changed = 0

  for (let i = 0; i < Math.max(originalIds.length, optimisedIds.length); i++) {
    if (originalIds[i] !== optimisedIds[i]) {
      changed += 1
    }
  }

  return changed
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

  const orderedJobs = sortJobs(jobs)

  let currentMinutes = PREP_START_MINUTES
  let previousPostcode = FARM_POSTCODE
  let workedMinutes = 0
  let breakInserted = false

  const schedule: RouteScheduleItem[] = []

  for (let index = 0; index < orderedJobs.length; index++) {
    const job = orderedJobs[index]
    const durationMinutes = getJobDurationMinutes(job)
    const travelMinutes = getTravelMinutes(previousPostcode, getJobPostcode(job))
    const nextFixedJob = orderedJobs.slice(index + 1).find(
      (candidate) => candidate.fixedSchedule && candidate.startTime
    )

    if (job.fixedSchedule && job.startTime) {
      const fixedStart = timeToMinutes(job.startTime)

      if (fixedStart === null) {
        return null
      }

      const earliestPossibleStart = Math.max(
        currentMinutes + travelMinutes,
        JOBS_START_MINUTES
      )

      if (earliestPossibleStart > fixedStart) {
        return null
      }

      const fixedEnd = fixedStart + durationMinutes

      if (fixedEnd > END_OF_DAY_MINUTES) {
        return null
      }

      if (
        isWorkerBlockedForSlot({
          blocks,
          date,
          startMinutes: fixedStart,
          endMinutes: fixedEnd,
        })
      ) {
        return null
      }

      schedule.push({
        jobId: job.id,
        startMinutes: fixedStart,
        endMinutes: fixedEnd,
      })

      currentMinutes = fixedEnd
      workedMinutes += durationMinutes
      previousPostcode = getJobPostcode(job) || previousPostcode
      continue
    }

    let startMinutes = Math.max(
      currentMinutes + travelMinutes,
      JOBS_START_MINUTES
    )

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

    if (nextFixedJob && nextFixedJob.startTime) {
      const nextFixedStart = timeToMinutes(nextFixedJob.startTime)
      if (nextFixedStart !== null) {
        const travelToNextFixed = getTravelMinutes(
          getJobPostcode(job),
          getJobPostcode(nextFixedJob)
        )

        if (endMinutes + travelToNextFixed > nextFixedStart) {
          return null
        }
      }
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

function buildDayWarning(schedule: RouteScheduleItem[], jobs: DayJobLike[]) {
  if (schedule.length === 0) return null

  const lastEnd = schedule[schedule.length - 1]?.endMinutes ?? JOBS_START_MINUTES
  const totalJobMinutes = jobs.reduce(
    (sum, job) => sum + getJobDurationMinutes(job),
    0
  )

  const breakMinutes = totalJobMinutes >= BREAK_THRESHOLD_MINUTES ? BREAK_DURATION_MINUTES : 0
  const routeTravelMinutes = calculateRouteTravel(jobs)
  const usedMinutes =
    (lastEnd - JOBS_START_MINUTES) + breakMinutes
  const remainingMinutes = END_OF_DAY_MINUTES - lastEnd

  if (lastEnd > END_OF_DAY_MINUTES - 15) {
    return 'Warning: this day is right up against the end of the working day.'
  }

  if (remainingMinutes <= 30) {
    return 'Warning: this day is tight with less than 30 mins spare.'
  }

  if (totalJobMinutes >= 360 && routeTravelMinutes >= 90) {
    return 'Warning: this day is workable but still heavy on labour plus travel.'
  }

  if (usedMinutes >= 420) {
    return 'Warning: this day is heavily loaded and leaves little room for overruns.'
  }

  return null
}

function countScheduleTimeChanges(
  jobs: DayJobLike[],
  schedule: RouteScheduleItem[]
) {
  const currentById = new Map(
    jobs.map((job) => [job.id, cleanString(job.startTime)])
  )

  let changed = 0

  for (const item of schedule) {
    const nextTime = minutesToTime(item.startMinutes)
    const currentTime = currentById.get(item.jobId) || ''

    if (currentTime !== nextTime) {
      changed += 1
    }
  }

  return changed
}

async function applyRouteSchedule(schedule: RouteScheduleItem[], date: Date) {
  for (const item of schedule) {
    await prisma.job.update({
      where: { id: item.jobId },
      data: {
        visitDate: startOfLocalDay(date),
        startTime: minutesToTime(item.startMinutes),
      },
    })
  }
}

async function applyOptimisedRoute(params: {
  worker: WorkerLite
  date: Date
  jobs: DayJobLike[]
  blocks: WorkerBlock[]
}): Promise<ApplyOptimisedRouteResult> {
  const { date, jobs, blocks } = params

  const sorted = sortJobs(jobs)

  if (sorted.length <= 1) {
    return {
      improved: false,
      saved: 0,
      reorderedJobs: 0,
      compacted: false,
      updatedTimes: 0,
      warning: null,
    }
  }

  const currentSchedule = buildRouteSchedule({
    date,
    jobs: sorted,
    blocks,
  })

  const currentScheduleChanges = currentSchedule
    ? countScheduleTimeChanges(sorted, currentSchedule)
    : 0

  const originalTravel = calculateRouteTravel(sorted)
  const optimised = optimiseOrder(sorted)
  const newTravel = calculateRouteTravel(optimised)
  const saved = originalTravel - newTravel
  const reorderedJobs = countReorderedJobs(sorted, optimised)

  const optimisedSchedule = buildRouteSchedule({
    date,
    jobs: optimised,
    blocks,
  })

  const optimisedScheduleChanges = optimisedSchedule
    ? countScheduleTimeChanges(optimised, optimisedSchedule)
    : 0

  const shouldApplyOptimisedOrder =
    !!optimisedSchedule &&
    reorderedJobs > 0 &&
    saved >= MIN_TRAVEL_SAVING_TO_APPLY

  if (shouldApplyOptimisedOrder) {
    await applyRouteSchedule(optimisedSchedule!, date)

    return {
      improved: true,
      saved,
      reorderedJobs,
      compacted: optimisedScheduleChanges > 0,
      updatedTimes: optimisedScheduleChanges,
      warning: buildDayWarning(optimisedSchedule!, optimised),
    }
  }

  if (currentSchedule && currentScheduleChanges > 0) {
    await applyRouteSchedule(currentSchedule, date)

    return {
      improved: true,
      saved: 0,
      reorderedJobs: 0,
      compacted: true,
      updatedTimes: currentScheduleChanges,
      warning: buildDayWarning(currentSchedule, sorted),
    }
  }

  return {
    improved: false,
    saved: 0,
    reorderedJobs: 0,
    compacted: false,
    updatedTimes: 0,
    warning: currentSchedule ? buildDayWarning(currentSchedule, sorted) : null,
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
    orderBy: [{ startTime: 'asc' }, { createdAt: 'asc' }],
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
      optimised: false,
      travelMinutesSaved: 0,
      reorderedJobs: 0,
      warning: null,
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
      optimised: false,
      travelMinutesSaved: 0,
      reorderedJobs: 0,
      warning: null,
      message:
        jobs.length === 0
          ? 'No assigned jobs found for this worker/day.'
          : 'Only one job on this worker/day, nothing to optimise.',
    }
  }

  const result = await applyOptimisedRoute({
    worker,
    date: day,
    jobs,
    blocks,
  })

  const messageParts: string[] = []

  if (result.reorderedJobs > 0 && result.saved > 0) {
    messageParts.push(
      `Saved ${result.saved} mins travel by reordering ${result.reorderedJobs} job${
        result.reorderedJobs === 1 ? '' : 's'
      }.`
    )
  } else if (result.compacted && result.updatedTimes > 0) {
    messageParts.push(
      `Tightened this day and updated ${result.updatedTimes} job time${
        result.updatedTimes === 1 ? '' : 's'
      }.`
    )
  } else {
    messageParts.push('No better route found for this worker/day.')
  }

  if (result.warning) {
    messageParts.push(result.warning)
  }

  return {
    ok: true,
    workerId: worker.id,
    date: day.toISOString(),
    reason: repairReason,
    repaired:
      result.reorderedJobs > 0
        ? result.reorderedJobs
        : result.updatedTimes > 0
          ? result.updatedTimes
          : 0,
    remaining: 0,
    unplacedJobIds: [],
    optimised: result.improved,
    travelMinutesSaved: result.saved,
    reorderedJobs: result.reorderedJobs,
    warning: result.warning,
    message: messageParts.join(' '),
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