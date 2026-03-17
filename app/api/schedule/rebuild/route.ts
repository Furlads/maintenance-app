export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

const START_OF_DAY = 9 * 60 // 09:00
const END_OF_WORK = 16 * 60 + 30 // 16:30
const RETURN_TO_FARM = 17 * 60 // 17:00
const DEFAULT_DURATION_MINUTES = 60
const FARM_ADDRESS = 'TF9 4BQ'
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || ''

type WorkerRow = {
  id: number
  firstName: string | null
  lastName: string | null
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

function isFixedJob(job: JobRow) {
  const status = cleanString(job.status).toLowerCase()
  const jobType = cleanString(job.jobType).toLowerCase()

  if (status === 'cancelled' || status === 'archived') return false
  if (!job.visitDate || !job.startTime) return false

  if (jobType === 'quote' || jobType === 'quoted') return true

  return true
}

function isFlexibleJob(job: JobRow) {
  const status = cleanString(job.status).toLowerCase()

  if (status === 'cancelled' || status === 'archived') return false
  if (status === 'done' || status === 'completed') return false
  if (status === 'in_progress' || status === 'inprogress' || status === 'paused') return false

  return !job.visitDate || !job.startTime
}

function isSameDay(a: Date | null, b: Date) {
  if (!a) return false

  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function getStartMinutes(job: JobRow) {
  if (!job.startTime) return 9999
  return timeToMinutes(job.startTime)
}

function sortFixedJobs(a: JobRow, b: JobRow) {
  const aStart = getStartMinutes(a)
  const bStart = getStartMinutes(b)

  if (aStart !== bStart) return aStart - bStart

  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
}

async function getTravelMinutes(origin: string, destination: string) {
  const safeOrigin = cleanString(origin) || FARM_ADDRESS
  const safeDestination = cleanString(destination) || FARM_ADDRESS

  if (safeOrigin.toLowerCase() === safeDestination.toLowerCase()) {
    return 5
  }

  if (!GOOGLE_MAPS_API_KEY) {
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
      return 20
    }

    const data = await res.json().catch(() => null)
    const seconds = data?.rows?.[0]?.elements?.[0]?.duration?.value

    if (!seconds || !Number.isFinite(seconds)) {
      return 20
    }

    return Math.max(5, Math.ceil(seconds / 60))
  } catch (error) {
    console.error('getTravelMinutes failed:', error)
    return 20
  }
}

async function clearFlexibleJobsForToday(today: Date) {
  const todayStart = startOfToday()
  const todayEnd = endOfToday()

  await prisma.job.updateMany({
    where: {
      visitDate: {
        gte: todayStart,
        lte: todayEnd,
      },
      status: {
        notIn: ['cancelled', 'archived', 'done', 'completed', 'in_progress', 'inprogress', 'paused'],
      },
      NOT: {
        OR: [
          {
            AND: [
              { startTime: { not: null } },
              {
                OR: [
                  { jobType: { equals: 'Quote', mode: 'insensitive' } },
                  { jobType: { equals: 'Quoted', mode: 'insensitive' } },
                ],
              },
            ],
          },
        ],
      },
    },
    data: {
      visitDate: null,
      startTime: null,
      status: 'unscheduled',
    },
  })
}

export async function POST() {
  try {
    const today = startOfToday()

    await clearFlexibleJobsForToday(today)

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
        .filter((job) => isFixedJob(job) && isSameDay(job.visitDate, today))
        .sort(sortFixedJobs)

      let flexibleJobs = workerJobs.filter((job) => isFlexibleJob(job))

      let pointer = START_OF_DAY
      let currentLocation = FARM_ADDRESS

      for (const fixedJob of fixedJobs) {
        const fixedStart = getStartMinutes(fixedJob)

        while (flexibleJobs.length > 0) {
          let bestJob: JobRow | null = null
          let bestTravel = Infinity

          for (const job of flexibleJobs) {
            const travel = await getTravelMinutes(
              currentLocation,
              cleanString(job.address) || FARM_ADDRESS
            )

            const duration = getDurationMinutes(job)
            const proposedStart = Math.max(pointer + travel, START_OF_DAY)
            const proposedEnd = proposedStart + duration

            if (proposedEnd > fixedStart) {
              continue
            }

            const travelBackToFarm = await getTravelMinutes(
              cleanString(job.address) || FARM_ADDRESS,
              FARM_ADDRESS
            )

            if (proposedEnd + travelBackToFarm > RETURN_TO_FARM) {
              continue
            }

            if (travel < bestTravel) {
              bestTravel = travel
              bestJob = job
            }
          }

          if (!bestJob) {
            break
          }

          const duration = getDurationMinutes(bestJob)
          const jobStart = Math.max(pointer + bestTravel, START_OF_DAY)
          const jobEnd = jobStart + duration

          await prisma.job.update({
            where: { id: bestJob.id },
            data: {
              visitDate: today,
              startTime: minutesToTime(jobStart),
              status: 'todo',
            },
          })

          bestJob.visitDate = today
          bestJob.startTime = minutesToTime(jobStart)
          bestJob.status = 'todo'

          scheduled += 1
          pointer = jobEnd
          currentLocation = cleanString(bestJob.address) || FARM_ADDRESS
          flexibleJobs = flexibleJobs.filter((job) => job.id !== bestJob!.id)
        }

        const fixedEnd = fixedStart + getDurationMinutes(fixedJob)
        pointer = Math.max(pointer, fixedEnd)
        currentLocation = cleanString(fixedJob.address) || currentLocation
      }

      while (flexibleJobs.length > 0) {
        let bestJob: JobRow | null = null
        let bestTravel = Infinity

        for (const job of flexibleJobs) {
          const travel = await getTravelMinutes(
            currentLocation,
            cleanString(job.address) || FARM_ADDRESS
          )

          const duration = getDurationMinutes(job)
          const proposedStart = Math.max(pointer + travel, START_OF_DAY)
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

          if (travel < bestTravel) {
            bestTravel = travel
            bestJob = job
          }
        }

        if (!bestJob) {
          break
        }

        const duration = getDurationMinutes(bestJob)
        const jobStart = Math.max(pointer + bestTravel, START_OF_DAY)
        const jobEnd = jobStart + duration

        await prisma.job.update({
          where: { id: bestJob.id },
          data: {
            visitDate: today,
            startTime: minutesToTime(jobStart),
            status: 'todo',
          },
        })

        bestJob.visitDate = today
        bestJob.startTime = minutesToTime(jobStart)
        bestJob.status = 'todo'

        scheduled += 1
        pointer = jobEnd
        currentLocation = cleanString(bestJob.address) || FARM_ADDRESS
        flexibleJobs = flexibleJobs.filter((job) => job.id !== bestJob!.id)
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