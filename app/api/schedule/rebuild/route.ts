export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

const PREP_START = '08:30'
const PREP_START_MINUTES = 8 * 60 + 30
const START_OF_DAY = 9 * 60 // 09:00
const END_OF_WORK = 16 * 60 + 30 // 16:30
const RETURN_TO_FARM = 17 * 60 // 17:00
const BREAK_MINUTES = 20
const BREAK_THRESHOLD_MINUTES = 6 * 60
const DEFAULT_DURATION_MINUTES = 60
const FARM_ADDRESS = 'TF9 4BQ'
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || ''
const TREV_QUOTE_DEFAULT_SLOTS = ['11:00', '12:00', '13:00']
const SCHEDULER_LOOKAHEAD_DAYS = 30

type WorkerRow = {
  id: number
  firstName: string | null
  lastName: string | null
  email: string | null
  active: boolean
}

type JobRow = {
  id: number
  title: string | null
  address: string | null
  status: string | null
  jobType: string | null
  startTime: string | null
  visitDate: Date | null
  durationMinutes: number | null
  createdAt: Date
  visitPattern: string | null
  isRegularMaintenance: boolean | null
  maintenanceFrequency: string | null
  maintenanceFrequencyUnit: string | null
  maintenanceFrequencyWeeks: number | null
  timePreferenceMode: string | null
  preferredDay: string | null
  preferredTimeBand: string | null
  assignments: Array<{
    workerId: number
  }>
}

type TimeBand = 'Morning' | 'Midday' | 'Afternoon' | 'Anytime'

type CandidatePlacement = {
  job: JobRow
  start: number
  end: number
  travelToJob: number
  travelBackToFarm: number
  score: number
}

const travelCache = new Map<string, number>()

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function startOfToday() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
}

function endOfDate(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 0, 0, 0, 0)
}

function isSameDay(a: Date | null, b: Date) {
  if (!a) return false

  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function timeToMinutes(time: string) {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(mins: number) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function getDurationMinutes(job: {
  durationMinutes: number | null
  title?: string | null
  jobType?: string | null
}) {
  if (isMorningPrepJob(job)) {
    return 30
  }

  return typeof job.durationMinutes === 'number' && job.durationMinutes > 0
    ? job.durationMinutes
    : DEFAULT_DURATION_MINUTES
}

function isMorningPrepJob(job: { title?: string | null; jobType?: string | null }) {
  const title = cleanString(job.title).toLowerCase()
  const jobType = cleanString(job.jobType).toLowerCase()

  return title === 'morning prep' || jobType === 'prep'
}

function isQuoteJob(job: { jobType?: string | null }) {
  const value = cleanString(job.jobType).toLowerCase()
  return value === 'quote' || value === 'quoted'
}

function isMaintenanceJob(job: { jobType?: string | null }) {
  const value = cleanString(job.jobType).toLowerCase()
  return value.includes('maint')
}

function isRegularMaintenanceJob(job: JobRow) {
  return isMaintenanceJob(job) && Boolean(job.isRegularMaintenance)
}

function isTrevWorker(worker: WorkerRow) {
  const first = cleanString(worker.firstName).toLowerCase()
  const last = cleanString(worker.lastName).toLowerCase()
  const email = cleanString(worker.email).toLowerCase()

  const firstMatches = first === 'trevor' || first === 'trev'
  const lastMatches = last.includes('fudger')
  const emailMatches = email.includes('trevor.fudger')

  return (firstMatches && lastMatches) || emailMatches
}

function isCancelledOrArchived(job: { status?: string | null }) {
  const status = cleanString(job.status).toLowerCase()
  return status === 'cancelled' || status === 'archived'
}

function isCompletedOrLive(job: { status?: string | null }) {
  const status = cleanString(job.status).toLowerCase()

  return (
    status === 'done' ||
    status === 'completed' ||
    status === 'in_progress' ||
    status === 'inprogress' ||
    status === 'paused'
  )
}

function isFixedJob(job: JobRow, worker: WorkerRow) {
  if (isCancelledOrArchived(job)) return false

  if (isMorningPrepJob(job)) return true
  if (isQuoteJob(job) && isTrevWorker(worker)) return true

  return false
}

function sortByStartThenCreated(a: JobRow, b: JobRow) {
  const aStart = a.startTime ? timeToMinutes(a.startTime) : 9999
  const bStart = b.startTime ? timeToMinutes(b.startTime) : 9999

  if (aStart !== bStart) {
    return aStart - bStart
  }

  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
}

function getDayName(date: Date) {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(date)
}

function normaliseTimeBand(value: string | null | undefined): TimeBand {
  const cleaned = cleanString(value)

  if (cleaned === 'Morning') return 'Morning'
  if (cleaned === 'Midday') return 'Midday'
  if (cleaned === 'Afternoon') return 'Afternoon'
  return 'Anytime'
}

function getTimeBandBounds(timeBand: TimeBand) {
  if (timeBand === 'Morning') {
    return { start: START_OF_DAY, end: 12 * 60 }
  }

  if (timeBand === 'Midday') {
    return { start: 11 * 60, end: 14 * 60 + 30 }
  }

  if (timeBand === 'Afternoon') {
    return { start: 13 * 60, end: END_OF_WORK }
  }

  return { start: START_OF_DAY, end: END_OF_WORK }
}

function getMaintenancePriority(job: JobRow) {
  const frequency = cleanString(job.maintenanceFrequency)

  if (frequency === 'weekly') return 400
  if (frequency === 'fortnightly') return 300
  if (frequency === 'every_3_weeks') return 220
  if (frequency === 'monthly') return 180

  return 100
}

function getJobPriority(job: JobRow) {
  if (isRegularMaintenanceJob(job)) {
    let score = 1000 + getMaintenancePriority(job)

    const mode = cleanString(job.timePreferenceMode)
    if (mode === 'specific') {
      score += 80
    } else if (mode === 'best-fit') {
      score += 40
    }

    return score
  }

  if (isMaintenanceJob(job)) return 700
  if (isQuoteJob(job)) return 500

  return 300
}

function matchesPreferredDay(job: JobRow, day: Date) {
  if (!isRegularMaintenanceJob(job)) return true

  if (cleanString(job.timePreferenceMode) !== 'specific') return true

  const preferredDay = cleanString(job.preferredDay)
  if (!preferredDay) return true

  return preferredDay === getDayName(day)
}

function getEarliestAllowedStart(job: JobRow) {
  if (!isRegularMaintenanceJob(job)) return START_OF_DAY

  if (cleanString(job.timePreferenceMode) !== 'specific') return START_OF_DAY

  const { start } = getTimeBandBounds(normaliseTimeBand(job.preferredTimeBand))
  return start
}

function getLatestAllowedEnd(job: JobRow) {
  if (!isRegularMaintenanceJob(job)) return END_OF_WORK

  if (cleanString(job.timePreferenceMode) !== 'specific') return END_OF_WORK

  const { end } = getTimeBandBounds(normaliseTimeBand(job.preferredTimeBand))
  return end
}

async function getTravelMinutes(origin: string, destination: string) {
  const safeOrigin = cleanString(origin) || FARM_ADDRESS
  const safeDestination = cleanString(destination) || FARM_ADDRESS

  if (safeOrigin.toLowerCase() === safeDestination.toLowerCase()) {
    return 5
  }

  const cacheKey = `${safeOrigin}__${safeDestination}`
  const cached = travelCache.get(cacheKey)

  if (typeof cached === 'number') {
    return cached
  }

  if (!GOOGLE_MAPS_API_KEY) {
    travelCache.set(cacheKey, 20)
    return 20
  }

  try {
    const url =
      `https://maps.googleapis.com/maps/api/distancematrix/json` +
      `?origins=${encodeURIComponent(safeOrigin)}` +
      `&destinations=${encodeURIComponent(safeDestination)}` +
      `&mode=driving` +
      `&region=uk` +
      `&key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}`

    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
    })

    if (!res.ok) {
      travelCache.set(cacheKey, 20)
      return 20
    }

    const data = await res.json().catch(() => null)
    const seconds = data?.rows?.[0]?.elements?.[0]?.duration?.value

    if (!seconds || !Number.isFinite(seconds)) {
      travelCache.set(cacheKey, 20)
      return 20
    }

    const minutes = Math.max(5, Math.ceil(seconds / 60))
    travelCache.set(cacheKey, minutes)
    return minutes
  } catch (error) {
    console.error('getTravelMinutes failed:', error)
    travelCache.set(cacheKey, 20)
    return 20
  }
}

async function clearMovableJobsFromToday(workerIds: number[], today: Date) {
  if (workerIds.length === 0) return

  const end = endOfDate(addDays(today, SCHEDULER_LOOKAHEAD_DAYS - 1))

  const jobsToClear = await prisma.job.findMany({
    where: {
      visitDate: {
        gte: today,
        lte: end,
      },
      assignments: {
        some: {
          workerId: {
            in: workerIds,
          },
        },
      },
      status: {
        notIn: ['cancelled', 'archived', 'done', 'completed', 'in_progress', 'inprogress', 'paused'],
      },
    },
    select: {
      id: true,
      title: true,
      jobType: true,
      visitPattern: true,
      isRegularMaintenance: true,
      maintenanceFrequency: true,
      maintenanceFrequencyUnit: true,
      maintenanceFrequencyWeeks: true,
      timePreferenceMode: true,
      preferredDay: true,
      preferredTimeBand: true,
    },
  })

  const movableIds = jobsToClear
    .filter((job) => !isMorningPrepJob(job) && !isQuoteJob(job))
    .map((job) => job.id)

  if (movableIds.length === 0) return

  await prisma.job.updateMany({
    where: {
      id: {
        in: movableIds,
      },
    },
    data: {
      visitDate: null,
      startTime: null,
      status: 'unscheduled',
    },
  })
}

function applyBreakIfNeeded(args: {
  pointer: number
  workedMinutes: number
  breakTaken: boolean
}) {
  if (args.breakTaken) {
    return {
      pointer: args.pointer,
      breakTaken: true,
    }
  }

  if (args.workedMinutes < BREAK_THRESHOLD_MINUTES) {
    return {
      pointer: args.pointer,
      breakTaken: false,
    }
  }

  return {
    pointer: args.pointer + BREAK_MINUTES,
    breakTaken: true,
  }
}

async function chooseBestMovableJob(args: {
  movableJobs: JobRow[]
  day: Date
  pointer: number
  currentLocation: string
  limitEnd: number
  workedMinutes: number
  breakTaken: boolean
}) {
  let best: CandidatePlacement | null = null

  for (const job of args.movableJobs) {
    if (!matchesPreferredDay(job, args.day)) {
      continue
    }

    const travelToJob = await getTravelMinutes(
      args.currentLocation,
      cleanString(job.address) || FARM_ADDRESS
    )

    const duration = getDurationMinutes(job)

    const breakAdjusted = applyBreakIfNeeded({
      pointer: args.pointer,
      workedMinutes: args.workedMinutes,
      breakTaken: args.breakTaken,
    })

    const allowedStart = getEarliestAllowedStart(job)
    const allowedEnd = Math.min(getLatestAllowedEnd(job), args.limitEnd)

    const proposedStart = Math.max(
      breakAdjusted.pointer + travelToJob,
      START_OF_DAY,
      allowedStart
    )
    const proposedEnd = proposedStart + duration

    if (proposedEnd > allowedEnd) {
      continue
    }

    const travelBackToFarm = await getTravelMinutes(
      cleanString(job.address) || FARM_ADDRESS,
      FARM_ADDRESS
    )

    if (args.limitEnd === END_OF_WORK && proposedEnd + travelBackToFarm > RETURN_TO_FARM) {
      continue
    }

    const priority = getJobPriority(job)
    const gapPenalty = Math.max(0, proposedStart - args.pointer)
    const score = priority * 1000 - travelToJob * 10 - gapPenalty

    if (!best || score > best.score) {
      best = {
        job,
        start: proposedStart,
        end: proposedEnd,
        travelToJob,
        travelBackToFarm,
        score,
      }
    }
  }

  return best
}

async function scheduleWorkerDay(args: {
  worker: WorkerRow
  jobs: JobRow[]
  day: Date
}) {
  const fixedJobs = args.jobs
    .filter((job) => isSameDay(job.visitDate, args.day) && isFixedJob(job, args.worker) && !!job.startTime)
    .sort(sortByStartThenCreated)

  let movableJobs = args.jobs.filter((job) => {
    if (isCancelledOrArchived(job)) return false
    if (isCompletedOrLive(job)) return false
    if (isFixedJob(job, args.worker)) return false

    return !job.visitDate
  })

  let scheduledCount = 0
  let pointer = START_OF_DAY
  let currentLocation = FARM_ADDRESS
  let workedMinutes = 0
  let breakTaken = false

  for (const fixedJob of fixedJobs) {
    const fixedStart = fixedJob.startTime ? timeToMinutes(fixedJob.startTime) : 9999

    while (movableJobs.length > 0) {
      const bestPlacement = await chooseBestMovableJob({
        movableJobs,
        day: args.day,
        pointer,
        currentLocation,
        limitEnd: fixedStart,
        workedMinutes,
        breakTaken,
      })

      if (!bestPlacement) {
        break
      }

      const breakAdjusted = applyBreakIfNeeded({
        pointer,
        workedMinutes,
        breakTaken,
      })

      if (!breakTaken && breakAdjusted.pointer !== pointer) {
        pointer = breakAdjusted.pointer
        breakTaken = true
      }

      await prisma.job.update({
        where: { id: bestPlacement.job.id },
        data: {
          visitDate: args.day,
          startTime: minutesToTime(bestPlacement.start),
          status: 'todo',
        },
      })

      bestPlacement.job.visitDate = args.day
      bestPlacement.job.startTime = minutesToTime(bestPlacement.start)
      bestPlacement.job.status = 'todo'

      scheduledCount += 1
      pointer = bestPlacement.end
      workedMinutes += getDurationMinutes(bestPlacement.job)
      currentLocation = cleanString(bestPlacement.job.address) || FARM_ADDRESS
      movableJobs = movableJobs.filter((job) => job.id !== bestPlacement.job.id)
    }

    const fixedDuration = getDurationMinutes(fixedJob)
    const fixedEnd = fixedStart + fixedDuration

    if (pointer < fixedStart) {
      pointer = fixedStart
    }

    pointer = Math.max(pointer, fixedEnd)
    workedMinutes += fixedDuration
    currentLocation = cleanString(fixedJob.address) || currentLocation

    const breakAdjusted = applyBreakIfNeeded({
      pointer,
      workedMinutes,
      breakTaken,
    })

    pointer = breakAdjusted.pointer
    breakTaken = breakAdjusted.breakTaken
  }

  while (movableJobs.length > 0) {
    const bestPlacement = await chooseBestMovableJob({
      movableJobs,
      day: args.day,
      pointer,
      currentLocation,
      limitEnd: END_OF_WORK,
      workedMinutes,
      breakTaken,
    })

    if (!bestPlacement) {
      break
    }

    const breakAdjusted = applyBreakIfNeeded({
      pointer,
      workedMinutes,
      breakTaken,
    })

    if (!breakTaken && breakAdjusted.pointer !== pointer) {
      pointer = breakAdjusted.pointer
      breakTaken = true
    }

    await prisma.job.update({
      where: { id: bestPlacement.job.id },
      data: {
        visitDate: args.day,
        startTime: minutesToTime(bestPlacement.start),
        status: 'todo',
      },
    })

    bestPlacement.job.visitDate = args.day
    bestPlacement.job.startTime = minutesToTime(bestPlacement.start)
    bestPlacement.job.status = 'todo'

    scheduledCount += 1
    pointer = bestPlacement.end
    workedMinutes += getDurationMinutes(bestPlacement.job)
    currentLocation = cleanString(bestPlacement.job.address) || FARM_ADDRESS
    movableJobs = movableJobs.filter((job) => job.id !== bestPlacement.job.id)
  }

  return scheduledCount
}

export async function POST() {
  try {
    const today = startOfToday()
    travelCache.clear()

    const workers = (await prisma.worker.findMany({
      where: { active: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    })) as WorkerRow[]

    if (workers.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'No active workers found.' },
        { status: 400 }
      )
    }

    await clearMovableJobsFromToday(
      workers.map((worker) => worker.id),
      today
    )

    const allJobs = (await prisma.job.findMany({
      where: {
        status: {
          notIn: ['cancelled', 'archived'],
        },
      },
      include: {
        assignments: {
          select: {
            workerId: true,
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    })) as JobRow[]

    let scheduled = 0

    for (const worker of workers) {
      const workerJobs = allJobs.filter((job) =>
        job.assignments.some((assignment) => assignment.workerId === worker.id)
      )

      for (let dayOffset = 0; dayOffset < SCHEDULER_LOOKAHEAD_DAYS; dayOffset++) {
        const day = addDays(today, dayOffset)
        const count = await scheduleWorkerDay({
          worker,
          jobs: workerJobs,
          day,
        })

        scheduled += count
      }
    }

    return NextResponse.json({
      ok: true,
      scheduled,
      message: 'Diary rebuilt successfully.',
    })
  } catch (error) {
    console.error('POST /api/schedule/rebuild failed:', error)

    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to rebuild schedule.',
      },
      { status: 500 }
    )
  }
}