export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function isValidISODateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function isValidHHMM(value: string) {
  return /^\d{2}:\d{2}$/.test(value)
}

function uniquePositiveInts(values: unknown): number[] {
  if (!Array.isArray(values)) return []

  return [
    ...new Set(
      values
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    )
  ]
}

function normalizeJobStatus(rawStatus: unknown, hasVisitDate: boolean) {
  const value = cleanString(rawStatus).toLowerCase()

  if (!value) {
    return hasVisitDate ? 'todo' : 'unscheduled'
  }

  if (
    value === 'scheduled' ||
    value === 'schedule' ||
    value === 'todo' ||
    value === 'to do'
  ) {
    return hasVisitDate ? 'todo' : 'unscheduled'
  }

  if (
    value === 'in_progress' ||
    value === 'in progress' ||
    value === 'inprogress' ||
    value === 'started' ||
    value === 'active'
  ) {
    return 'in_progress'
  }

  if (value === 'paused' || value === 'on hold') {
    return 'paused'
  }

  if (
    value === 'done' ||
    value === 'completed' ||
    value === 'complete' ||
    value === 'finished'
  ) {
    return 'done'
  }

  if (value === 'quoted' || value === 'quote') {
    return 'quoted'
  }

  if (value === 'unscheduled' || value === 'unassigned') {
    return 'unscheduled'
  }

  return hasVisitDate ? 'todo' : 'unscheduled'
}

function getLondonDateParts(date: Date) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })

  const parts = formatter.formatToParts(date)

  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value

  if (!year || !month || !day) {
    throw new Error('Failed to build London date parts')
  }

  return { year, month, day }
}

function londonDateOnlyString(date: Date) {
  const { year, month, day } = getLondonDateParts(date)
  return `${year}-${month}-${day}`
}

function startOfLondonDayUtc(date: Date) {
  const iso = londonDateOnlyString(date)
  return new Date(`${iso}T00:00:00.000Z`)
}

function nextLondonDayUtc(date: Date) {
  const start = startOfLondonDayUtc(date)
  return new Date(start.getTime() + 24 * 60 * 60 * 1000)
}

async function ensureMorningPrepJobs() {
  const now = new Date()
  const dayStart = startOfLondonDayUtc(now)
  const dayEnd = nextLondonDayUtc(now)

  const todaysRealJobs = await prisma.job.findMany({
    where: {
      visitDate: {
        gte: dayStart,
        lt: dayEnd
      },
      title: {
        not: 'Morning Prep'
      }
    },
    include: {
      assignments: {
        select: {
          workerId: true
        }
      }
    }
  })

  const workerIdsNeedingPrep = [
    ...new Set(
      todaysRealJobs.flatMap((job) =>
        job.assignments.map((assignment) => assignment.workerId)
      )
    )
  ]

  if (workerIdsNeedingPrep.length === 0) {
    return
  }

  const existingPrepJobs = await prisma.job.findMany({
    where: {
      title: 'Morning Prep',
      visitDate: {
        gte: dayStart,
        lt: dayEnd
      }
    },
    include: {
      assignments: {
        select: {
          workerId: true
        }
      }
    }
  })

  const existingPrepWorkerIds = new Set(
    existingPrepJobs.flatMap((job) =>
      job.assignments.map((assignment) => assignment.workerId)
    )
  )

  const missingWorkerIds = workerIdsNeedingPrep.filter(
    (workerId) => !existingPrepWorkerIds.has(workerId)
  )

  if (missingWorkerIds.length === 0) {
    return
  }

  let internalCustomer = await prisma.customer.findFirst({
    where: {
      name: 'Furlads Internal'
    }
  })

  if (!internalCustomer) {
    internalCustomer = await prisma.customer.create({
      data: {
        name: 'Furlads Internal',
        address: 'Furlads Yard',
        notes: 'System customer for internal operational jobs like Morning Prep.'
      }
    })
  }

  for (const workerId of missingWorkerIds) {
    await prisma.job.create({
      data: {
        title: 'Morning Prep',
        customerId: internalCustomer.id,
        address: 'Furlads Yard',
        notes:
          'Automatic prep block for van checks, loading up, fuel, and kit. Finish early if ready sooner.',
        jobType: 'Prep',
        visitDate: dayStart,
        startTime: '08:30',
        durationMinutes: 30,
        status: 'todo',
        assignments: {
          create: [
            {
              worker: {
                connect: { id: workerId }
              }
            }
          ]
        }
      }
    })
  }
}

export async function GET() {
  try {
    await ensureMorningPrepJobs()

    const jobs = await prisma.job.findMany({
      include: {
        customer: true,
        assignments: {
          include: {
            worker: true
          }
        }
      },
      orderBy: [
        { visitDate: 'asc' },
        { startTime: 'asc' },
        { createdAt: 'asc' }
      ]
    })

    return NextResponse.json(jobs)
  } catch (error) {
    console.error('GET /api/jobs failed:', error)

    return NextResponse.json(
      { error: 'Failed to load jobs' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))

    const title = cleanString(body.title)
    const customerId = Number(body.customerId)
    const address = cleanString(body.address)
    const notes = cleanString(body.notes)
    const jobType = cleanString(body.jobType) || 'Other'

    const assignedWorkerIds = uniquePositiveInts(
      Array.isArray(body.assignedTo)
        ? body.assignedTo
        : Array.isArray(body.assignedWorkerIds)
          ? body.assignedWorkerIds
          : body.workerIds
    )

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      )
    }

    if (!Number.isInteger(customerId) || customerId <= 0) {
      return NextResponse.json(
        { error: 'Valid customerId is required' },
        { status: 400 }
      )
    }

    if (!address) {
      return NextResponse.json(
        { error: 'Address is required' },
        { status: 400 }
      )
    }

    let visitDate: Date | null = null

    if ('visitDate' in body && body.visitDate !== null && body.visitDate !== '') {
      const visitDateRaw = cleanString(body.visitDate)

      if (!isValidISODateOnly(visitDateRaw)) {
        return NextResponse.json(
          { error: 'visitDate must be YYYY-MM-DD' },
          { status: 400 }
        )
      }

      visitDate = new Date(`${visitDateRaw}T00:00:00.000Z`)
    }

    let startTime: string | null = null

    if ('startTime' in body && body.startTime !== null && body.startTime !== '') {
      const startTimeRaw = cleanString(body.startTime)

      if (!isValidHHMM(startTimeRaw)) {
        return NextResponse.json(
          { error: 'startTime must be HH:MM' },
          { status: 400 }
        )
      }

      startTime = startTimeRaw
    }

    let durationMinutes: number | null = null

    if (
      'durationMinutes' in body &&
      body.durationMinutes !== null &&
      body.durationMinutes !== ''
    ) {
      const parsed = Number(body.durationMinutes)

      if (!Number.isFinite(parsed) || parsed <= 0) {
        return NextResponse.json(
          { error: 'durationMinutes must be a positive number' },
          { status: 400 }
        )
      }

      durationMinutes = Math.round(parsed)
    }

    const status = normalizeJobStatus(body.status, !!visitDate)

    const job = await prisma.job.create({
      data: {
        title,
        customerId,
        address,
        notes: notes || null,
        jobType,
        visitDate,
        startTime,
        durationMinutes,
        status,
        assignments:
          assignedWorkerIds.length > 0
            ? {
                create: assignedWorkerIds.map((workerId) => ({
                  worker: {
                    connect: { id: workerId }
                  }
                }))
              }
            : undefined
      },
      include: {
        customer: true,
        assignments: {
          include: {
            worker: true
          }
        }
      }
    })

    return NextResponse.json(job)
  } catch (error) {
    console.error('POST /api/jobs failed:', error)

    return NextResponse.json(
      { error: 'Failed to create job' },
      { status: 500 }
    )
  }
}