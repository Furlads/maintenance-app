export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

const START_OF_DAY = 9 * 60 // 09:00
const END_OF_WORK = 16 * 60 + 30 // 16:30
const RETURN_TO_FARM = 17 * 60 // 17:00
const DEFAULT_DURATION_MINUTES = 60
const FARM_ADDRESS = 'TF9 4BQ'
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || ''
const TREV_QUOTE_DEFAULT_SLOTS = ['11:00', '12:00', '13:00']

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

function endOfToday() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
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

function getDurationMinutes(job: { durationMinutes: number | null }) {
  return typeof job.durationMinutes === 'number' && job.durationMinutes > 0
    ? job.durationMinutes
    : DEFAULT_DURATION_MINUTES
}

function isToday(date: Date | null) {
  if (!date) return false

  const today = startOfToday()

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  )
}

function isQuoteJob(job: JobRow) {
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

function isCompletedOrLive(job: JobRow) {
  const status = cleanString(job.status).toLowerCase()

  return (
    status === 'done' ||
    status === 'completed' ||
    status === 'in_progress' ||
    status === 'inprogress' ||
    status === 'paused'
  )
}

function isCancelledOrArchived(job: JobRow) {
  const status = cleanString(job.status).toLowerCase()
  return status === 'cancelled' || status === 'archived'
}

function isFixedForToday(job: JobRow, worker: WorkerRow) {
  if (!isToday(job.visitDate)) return false
  if (!job.startTime) return false

  if (isQuoteJob(job) && isTrevWorker(worker)) {
    return true
  }

  return false
}

function isMovableForToday(job: JobRow, worker: WorkerRow) {
  if (isCancelledOrArchived(job)) return false
  if (isCompletedOrLive(job)) return false
  if (isFixedForToday(job, worker)) return false

  if (job.visitDate === null) return true
  if (isToday(job.visitDate)) return true

  return false
}

function sortByStartTimeThenCreated(a: JobRow, b: JobRow) {
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

async function clearMovableJobsForToday(jobIds: number[]) {
  if (jobIds.length === 0) return

  await prisma.job.updateMany({
    where: {
      id: {
        in: jobIds,
      },
    },
    data: {
      visitDate: null,
      startTime: null,
      status: 'unscheduled',
    },
  })
}

async function fillGapWithClosestJobs(args: {
  remainingJobs: JobRow[]
  pointer: number
  currentLocation: string
  gapEndMinutes: number
  today: Date
}) {
  const scheduledIds: number[] = []
  let pointer = args.pointer
  let currentLocation = args.currentLocation
  let remainingJobs = [...args.remainingJobs]

  while (remainingJobs.length > 0) {
    let bestJob: JobRow | null = null
    let bestTravel = Infinity
    let bestStart = 0
    let bestEnd = 0

    for (const job of remainingJobs) {
      const travelToJob = await getTravelMinutes(
        currentLocation,
        cleanString(job.address) || FARM_ADDRESS
      )

      const duration = getDurationMinutes(job)
      const proposedStart = Math.max(pointer + travelToJob, START_OF_DAY)
      const proposedEnd = proposedStart + duration

      if (proposedEnd > args.gapEndMinutes) {
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
        visitDate: args.today,
        startTime: minutesToTime(bestStart),
        status: 'todo',
      },
    })

    scheduledIds.push(bestJob.id)
    pointer = bestEnd
    currentLocation = cleanString(bestJob.address) || FARM_ADDRESS
    remainingJobs = remainingJobs.filter((job) => job.id !== bestJob!.id)
  }

  return {
    pointer,
    currentLocation,
    scheduledIds,
    remainingJobs,
  }
}

async function fillEndOfDayWithClosestJobs(args: {
  remainingJobs: JobRow[]
  pointer: number
  currentLocation: string
  today: Date
}) {
  const scheduledIds: number[] = []
  let pointer = args.pointer
  let currentLocation = args.currentLocation
  let remainingJobs = [...args.remainingJobs]

  while (remainingJobs.length > 0) {
    let bestJob: JobRow | null = null
    let bestTravel = Infinity
    let bestStart = 0
    let bestEnd = 0

    for (const job of remainingJobs) {
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
        visitDate: args.today,
        startTime: minutesToTime(bestStart),
        status: 'todo',
      },
    })

    scheduledIds.push(bestJob.id)
    pointer = bestEnd
    currentLocation = cleanString(bestJob.address) || FARM_ADDRESS
    remainingJobs = remainingJobs.filter((job) => job.id !== bestJob!.id)
  }

  return {
    pointer,
    currentLocation,
    scheduledIds,
    remainingJobs,
  }
}

export async function POST() {
  try {
    const today = startOfToday()

    const [workers, allJobs] = await Promise.all([
      prisma.worker.findMany({
        where: { active: true },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      }) as Promise<WorkerRow[]>,
      prisma.job.findMany({
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
      }) as Promise<JobRow[]>,
    ])

    if (workers.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'No active workers found.' },
        { status: 400 }
      )
    }

    let scheduled = 0

    for (const worker of workers) {
      const workerJobs = allJobs.filter((job) =>
        job.assignments.some((assignment) => assignment.workerId === worker.id)
      )

      const fixedJobs = workerJobs
        .filter((job) => isFixedForToday(job, worker))
        .sort(sortByStartTimeThenCreated)

      const movableJobs = workerJobs.filter((job) => isMovableForToday(job, worker))

      await clearMovableJobsForToday(movableJobs.map((job) => job.id))

      let remainingJobs = [...movableJobs].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )

      let pointer = START_OF_DAY
      let currentLocation = FARM_ADDRESS

      for (const fixedJob of fixedJobs) {
        const fixedStart = fixedJob.startTime ? timeToMinutes(fixedJob.startTime) : 9999

        const gapFill = await fillGapWithClosestJobs({
          remainingJobs,
          pointer,
          currentLocation,
          gapEndMinutes: fixedStart,
          today,
        })

        pointer = gapFill.pointer
        currentLocation = gapFill.currentLocation
        remainingJobs = gapFill.remainingJobs
        scheduled += gapFill.scheduledIds.length

        const fixedEnd = fixedStart + getDurationMinutes(fixedJob)
        pointer = Math.max(pointer, fixedEnd)
        currentLocation = cleanString(fixedJob.address) || currentLocation
      }

      const endFill = await fillEndOfDayWithClosestJobs({
        remainingJobs,
        pointer,
        currentLocation,
        today,
      })

      scheduled += endFill.scheduledIds.length
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