export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

const PREP_START = '08:30'
const PREP_START_MINUTES = 8 * 60 + 30
const START_OF_DAY = 9 * 60 // 09:00
const END_OF_WORK = 16 * 60 + 30 // 16:30
const RETURN_TO_FARM = 17 * 60 // 17:00
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
  assignments: Array<{
    workerId: number
  }>
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

function getDurationMinutes(job: { durationMinutes: number | null; title?: string | null; jobType?: string | null }) {
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

  for (const fixedJob of fixedJobs) {
    const fixedStart = fixedJob.startTime ? timeToMinutes(fixedJob.startTime) : 9999

    while (movableJobs.length > 0) {
      let bestJob: JobRow | null = null
      let bestTravel = Infinity
      let bestStart = 0
      let bestEnd = 0

      for (const job of movableJobs) {
        const travelToJob = await getTravelMinutes(
          currentLocation,
          cleanString(job.address) || FARM_ADDRESS
        )

        const duration = getDurationMinutes(job)
        const proposedStart = Math.max(pointer + travelToJob, START_OF_DAY)
        const proposedEnd = proposedStart + duration

        if (proposedEnd > fixedStart) {
          continue
        }

        if (travelToJob < bestTravel) {
          bestTravel = travelToJob
          bestJob = job
          bestStart = proposedStart
          bestEnd = proposedEnd
        }
      }

      if (!bestJob) {
        break
      }

      await prisma.job.update({
        where: { id: bestJob.id },
        data: {
          visitDate: args.day,
          startTime: minutesToTime(bestStart),
          status: 'todo',
        },
      })

      bestJob.visitDate = args.day
      bestJob.startTime = minutesToTime(bestStart)
      bestJob.status = 'todo'

      scheduledCount += 1
      pointer = bestEnd
      currentLocation = cleanString(bestJob.address) || FARM_ADDRESS
      movableJobs = movableJobs.filter((job) => job.id !== bestJob!.id)
    }

    const fixedEnd = fixedStart + getDurationMinutes(fixedJob)
    pointer = Math.max(pointer, fixedEnd)
    currentLocation = cleanString(fixedJob.address) || currentLocation
  }

  while (movableJobs.length > 0) {
    let bestJob: JobRow | null = null
    let bestTravel = Infinity
    let bestStart = 0
    let bestEnd = 0

    for (const job of movableJobs) {
      const travelToJob = await getTravelMinutes(
        currentLocation,
        cleanString(job.address) || FARM_ADDRESS
      )

      const duration = getDurationMinutes(job)
      const proposedStart = Math.max(pointer + travelToJob, START_OF_DAY)
      const proposedEnd = proposedStart + duration

      if (proposedEnd > END_OF_WORK) {
        continue
      }

      const travelBackToFarm = await getTravelMinutes(
        cleanString(job.address) || FARM_ADDRESS,
        FARM_ADDRESS
      )

      if (proposedEnd + travelBackToFarm > RETURN_TO_FARM) {
        continue
      }

      if (travelToJob < bestTravel) {
        bestTravel = travelToJob
        bestJob = job
        bestStart = proposedStart
        bestEnd = proposedEnd
      }
    }

    if (!bestJob) {
      break
    }

    await prisma.job.update({
      where: { id: bestJob.id },
      data: {
        visitDate: args.day,
        startTime: minutesToTime(bestStart),
        status: 'todo',
      },
    })

    bestJob.visitDate = args.day
    bestJob.startTime = minutesToTime(bestStart)
    bestJob.status = 'todo'

    scheduledCount += 1
    pointer = bestEnd
    currentLocation = cleanString(bestJob.address) || FARM_ADDRESS
    movableJobs = movableJobs.filter((job) => job.id !== bestJob!.id)
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