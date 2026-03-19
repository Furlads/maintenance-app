export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

const TREV_QUOTE_DEFAULT_SLOTS = ['11:00', '12:00', '13:00'] as const

const MAINTENANCE_FREQUENCY_VALUES = new Set([
  'weekly',
  'fortnightly',
  'every_3_weeks',
  'monthly',
])

const TIME_PREFERENCE_MODES = new Set(['best-fit', 'specific'])
const PREFERRED_DAYS = new Set([
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
])
const PREFERRED_TIME_BANDS = new Set(['Morning', 'Midday', 'Afternoon', 'Anytime'])

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function isTrue(value: unknown) {
  return value === true || value === 'true' || value === 1 || value === '1'
}

function isQuoteJobType(jobType: string) {
  const value = clean(jobType).toLowerCase()
  return value === 'quote' || value === 'quoted'
}

function isValidHHMM(value: string) {
  return /^\d{2}:\d{2}$/.test(value)
}

function getLondonDateParts(date: Date) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
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

function parseDateValue(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '' || value === 'null') return null

  if (typeof value === 'string') {
    const trimmed = value.trim()

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return new Date(`${trimmed}T00:00:00.000Z`)
    }

    const parsed = new Date(trimmed)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }

  return undefined
}

function parsePositiveInt(value: unknown): number | undefined {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return undefined
  const rounded = Math.round(parsed)
  return rounded > 0 ? rounded : undefined
}

function parseNonNegativeInt(value: unknown): number | undefined {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return undefined
  const rounded = Math.round(parsed)
  return rounded >= 0 ? rounded : undefined
}

function parseAssignedWorkerIds(input: unknown): number[] {
  if (!Array.isArray(input)) return []

  const cleaned: number[] = input
    .map((value): number | null => {
      if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
        return value
      }

      if (typeof value === 'string') {
        const parsed = Number(value.trim())
        if (Number.isInteger(parsed) && parsed > 0) {
          return parsed
        }
      }

      return null
    })
    .filter((value): value is number => value !== null)

  return [...new Set(cleaned)]
}

function parseMaintenanceFrequency(value: unknown) {
  const cleaned = clean(value)
  return MAINTENANCE_FREQUENCY_VALUES.has(cleaned) ? cleaned : null
}

function parseMaintenanceFrequencyUnit(value: unknown) {
  const cleaned = clean(value).toLowerCase()
  if (cleaned === 'weeks' || cleaned === 'monthly') return cleaned
  return null
}

function getMaintenanceFrequencyWeeksFromFrequency(frequency: string | null) {
  if (frequency === 'weekly') return 1
  if (frequency === 'fortnightly') return 2
  if (frequency === 'every_3_weeks') return 3
  if (frequency === 'monthly') return null
  return null
}

function normaliseMaintenanceSettings(input: {
  jobType: string
  visitPattern: unknown
  isRegularMaintenance: unknown
  maintenanceFrequency: unknown
  maintenanceFrequencyUnit: unknown
  maintenanceFrequencyWeeks: unknown
  timePreferenceMode: unknown
  preferredDay: unknown
  preferredTimeBand: unknown
}) {
  const jobType = clean(input.jobType)
  const visitPatternRaw = clean(input.visitPattern) || 'one-off'

  const isMaintenanceJob = jobType.toLowerCase() === 'maintenance'
  const isRegularMaintenance =
    isMaintenanceJob &&
    (visitPatternRaw === 'regular-maintenance' || isTrue(input.isRegularMaintenance))

  if (!isMaintenanceJob || !isRegularMaintenance) {
    return {
      visitPattern: isMaintenanceJob ? visitPatternRaw : null,
      isRegularMaintenance: false,
      maintenanceFrequency: null,
      maintenanceFrequencyUnit: null,
      maintenanceFrequencyWeeks: null,
      timePreferenceMode: null,
      preferredDay: null,
      preferredTimeBand: null,
    }
  }

  const maintenanceFrequency = parseMaintenanceFrequency(input.maintenanceFrequency)

  if (!maintenanceFrequency) {
    throw new Error(
      'Regular maintenance jobs must have a valid maintenance frequency.'
    )
  }

  const parsedWeeks = parsePositiveInt(input.maintenanceFrequencyWeeks)
  const derivedWeeks = getMaintenanceFrequencyWeeksFromFrequency(maintenanceFrequency)

  let maintenanceFrequencyUnit = parseMaintenanceFrequencyUnit(
    input.maintenanceFrequencyUnit
  )

  if (!maintenanceFrequencyUnit) {
    maintenanceFrequencyUnit = maintenanceFrequency === 'monthly' ? 'monthly' : 'weeks'
  }

  if (maintenanceFrequency === 'monthly') {
    maintenanceFrequencyUnit = 'monthly'
  } else {
    maintenanceFrequencyUnit = 'weeks'
  }

  const maintenanceFrequencyWeeks =
    maintenanceFrequencyUnit === 'monthly'
      ? null
      : parsedWeeks ?? derivedWeeks ?? null

  const timePreferenceModeRaw = clean(input.timePreferenceMode) || 'best-fit'
  const timePreferenceMode = TIME_PREFERENCE_MODES.has(timePreferenceModeRaw)
    ? timePreferenceModeRaw
    : 'best-fit'

  let preferredDay: string | null = null
  let preferredTimeBand: string | null = null

  if (timePreferenceMode === 'specific') {
    const parsedPreferredDay = clean(input.preferredDay)
    const parsedPreferredTimeBand = clean(input.preferredTimeBand) || 'Anytime'

    preferredDay = PREFERRED_DAYS.has(parsedPreferredDay) ? parsedPreferredDay : null
    preferredTimeBand = PREFERRED_TIME_BANDS.has(parsedPreferredTimeBand)
      ? parsedPreferredTimeBand
      : 'Anytime'
  }

  return {
    visitPattern: 'regular-maintenance',
    isRegularMaintenance: true,
    maintenanceFrequency,
    maintenanceFrequencyUnit,
    maintenanceFrequencyWeeks,
    timePreferenceMode,
    preferredDay,
    preferredTimeBand,
  }
}

async function findTrevWorkerIds() {
  const workers = await prisma.worker.findMany({
    where: {
      OR: [
        {
          AND: [
            { firstName: { equals: 'Trevor', mode: 'insensitive' } },
            { lastName: { contains: 'Fudger', mode: 'insensitive' } },
          ],
        },
        {
          AND: [
            { firstName: { equals: 'Trev', mode: 'insensitive' } },
            { lastName: { contains: 'Fudger', mode: 'insensitive' } },
          ],
        },
        {
          email: { contains: 'trevor.fudger', mode: 'insensitive' },
        },
      ],
    },
    select: {
      id: true,
    },
  })

  return workers.map((worker) => worker.id)
}

async function resolveTrevQuoteVisitSchedule(params: {
  visitDate: Date | null
  startTime: string | null
  jobType: string
  assignedWorkerIds: number[]
  allowQuoteTimeOverride: boolean
}) {
  const {
    visitDate,
    startTime,
    jobType,
    assignedWorkerIds,
    allowQuoteTimeOverride,
  } = params

  if (!isQuoteJobType(jobType)) {
    return {
      visitDate,
      startTime,
    }
  }

  const trevWorkerIds = await findTrevWorkerIds()

  if (trevWorkerIds.length === 0) {
    return {
      error: NextResponse.json(
        { error: 'Could not find Trev in the worker database.' },
        { status: 400 }
      ),
    }
  }

  const isAssignedToTrev = assignedWorkerIds.some((workerId) =>
    trevWorkerIds.includes(workerId)
  )

  if (!isAssignedToTrev) {
    return {
      visitDate,
      startTime,
    }
  }

  if (!visitDate) {
    return {
      error: NextResponse.json(
        { error: 'Quote visits for Trev must have a visitDate.' },
        { status: 400 }
      ),
    }
  }

  if (allowQuoteTimeOverride && !startTime) {
    return {
      error: NextResponse.json(
        {
          error:
            'Override was enabled but no manual startTime was provided for this Trev quote visit.',
        },
        { status: 400 }
      ),
    }
  }

  const dayStart = startOfLondonDayUtc(visitDate)
  const dayEnd = nextLondonDayUtc(visitDate)

  const existingTrevQuoteJobs = await prisma.job.findMany({
    where: {
      jobType: {
        equals: 'Quote',
        mode: 'insensitive',
      },
      visitDate: {
        gte: dayStart,
        lt: dayEnd,
      },
      status: {
        notIn: ['cancelled', 'archived'],
      },
      assignments: {
        some: {
          workerId: {
            in: trevWorkerIds,
          },
        },
      },
    },
    select: {
      id: true,
      startTime: true,
    },
  })

  if (existingTrevQuoteJobs.length >= 3) {
    return {
      error: NextResponse.json(
        {
          error:
            'Trev already has 3 quote visits booked for that day. Maximum reached.',
        },
        { status: 400 }
      ),
    }
  }

  const takenTimes = new Set(
    existingTrevQuoteJobs.map((job) => clean(job.startTime)).filter(Boolean)
  )

  let resolvedStartTime = startTime

  if (!resolvedStartTime) {
    const nextFreeDefaultSlot = TREV_QUOTE_DEFAULT_SLOTS.find(
      (slot) => !takenTimes.has(slot)
    )

    if (!nextFreeDefaultSlot) {
      return {
        error: NextResponse.json(
          {
            error:
              'No Trev quote slots are left for that day. Available default slots are 11:00, 12:00 and 13:00 only.',
          },
          { status: 400 }
        ),
      }
    }

    resolvedStartTime = nextFreeDefaultSlot
  }

  if (
    !allowQuoteTimeOverride &&
    !TREV_QUOTE_DEFAULT_SLOTS.includes(
      resolvedStartTime as (typeof TREV_QUOTE_DEFAULT_SLOTS)[number]
    )
  ) {
    return {
      error: NextResponse.json(
        {
          error:
            'Trev quote visits can only be booked at 11:00, 12:00 or 13:00 unless override is enabled.',
        },
        { status: 400 }
      ),
    }
  }

  if (takenTimes.has(resolvedStartTime)) {
    return {
      error: NextResponse.json(
        {
          error: 'Trev already has a quote visit booked at that time on that day.',
        },
        { status: 400 }
      ),
    }
  }

  return {
    visitDate,
    startTime: resolvedStartTime,
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)

    const includeArchived = isTrue(searchParams.get('includeArchived'))
    const includeCancelled = isTrue(searchParams.get('includeCancelled'))
    const workerId = parsePositiveInt(searchParams.get('workerId'))
    const customerId = parsePositiveInt(searchParams.get('customerId'))
    const jobId = parsePositiveInt(searchParams.get('jobId'))
    const status = clean(searchParams.get('status'))
    const q = clean(searchParams.get('q'))

    const where: any = {}

    if (status) {
      where.status = status
    } else {
      const excludedStatuses: string[] = []

      if (!includeArchived) {
        excludedStatuses.push('archived')
      }

      if (!includeCancelled) {
        excludedStatuses.push('cancelled')
      }

      if (excludedStatuses.length > 0) {
        where.status = {
          notIn: excludedStatuses,
        }
      }
    }

    if (workerId) {
      where.assignments = {
        some: {
          workerId,
        },
      }
    }

    if (customerId) {
      where.customerId = customerId
    }

    if (jobId) {
      where.id = jobId
    }

    if (q) {
      where.OR = [
        {
          title: {
            contains: q,
            mode: 'insensitive',
          },
        },
        {
          address: {
            contains: q,
            mode: 'insensitive',
          },
        },
        {
          jobType: {
            contains: q,
            mode: 'insensitive',
          },
        },
        {
          notes: {
            contains: q,
            mode: 'insensitive',
          },
        },
        {
          paymentNotes: {
            contains: q,
            mode: 'insensitive',
          },
        },
        {
          customer: {
            name: {
              contains: q,
              mode: 'insensitive',
            },
          },
        },
        {
          customer: {
            postcode: {
              contains: q,
              mode: 'insensitive',
            },
          },
        },
      ]
    }

    const jobs = await prisma.job.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      include: {
        customer: true,
        assignments: {
          include: {
            worker: true,
          },
        },
        photos: true,
        chasMessages: true,
      },
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
    const body = await req.json().catch(() => ({} as Record<string, unknown>))

    const customerId = parsePositiveInt(body.customerId)

    if (!customerId) {
      return NextResponse.json(
        { error: 'customerId is required' },
        { status: 400 }
      )
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        name: true,
        address: true,
        postcode: true,
      },
    })

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    const assignedWorkerIds = parseAssignedWorkerIds(body.assignedTo)

    if (assignedWorkerIds.length > 0) {
      const existingWorkers = await prisma.worker.findMany({
        where: {
          id: {
            in: assignedWorkerIds,
          },
        },
        select: { id: true },
      })

      const existingWorkerIds = new Set(existingWorkers.map((worker) => worker.id))

      const missingWorkerIds = assignedWorkerIds.filter(
        (workerId) => !existingWorkerIds.has(workerId)
      )

      if (missingWorkerIds.length > 0) {
        return NextResponse.json(
          {
            error: 'Some assigned workers do not exist',
            missingWorkerIds,
          },
          { status: 400 }
        )
      }
    }

    let startTime: string | null = null
    if (body.startTime !== undefined) {
      if (body.startTime === null || clean(body.startTime) === '') {
        startTime = null
      } else if (typeof body.startTime === 'string') {
        const trimmedStartTime = body.startTime.trim()

        if (!isValidHHMM(trimmedStartTime)) {
          return NextResponse.json(
            { error: 'startTime must be HH:MM' },
            { status: 400 }
          )
        }

        startTime = trimmedStartTime
      }
    }

    const visitDate = parseDateValue(body.visitDate)
    const jobType = clean(body.jobType) || 'Quote'
    const allowQuoteTimeOverride = isTrue(body.allowQuoteTimeOverride)

    const resolvedQuoteSchedule = await resolveTrevQuoteVisitSchedule({
      visitDate: visitDate ?? null,
      startTime,
      jobType,
      assignedWorkerIds,
      allowQuoteTimeOverride,
    })

    if ('error' in resolvedQuoteSchedule) {
      return resolvedQuoteSchedule.error
    }

    const paymentStatusRaw = clean(body.paymentStatus).toLowerCase()
    const allowedPaymentStatuses = new Set(['cash_paid', 'invoice_needed'])

    const paymentStatus =
      paymentStatusRaw === ''
        ? null
        : allowedPaymentStatuses.has(paymentStatusRaw)
          ? paymentStatusRaw
          : null

    if (paymentStatusRaw && !paymentStatus) {
      return NextResponse.json(
        { error: 'paymentStatus must be cash_paid or invoice_needed' },
        { status: 400 }
      )
    }

    let maintenanceSettings
    try {
      maintenanceSettings = normaliseMaintenanceSettings({
        jobType,
        visitPattern: body.visitPattern,
        isRegularMaintenance: body.isRegularMaintenance,
        maintenanceFrequency: body.maintenanceFrequency,
        maintenanceFrequencyUnit: body.maintenanceFrequencyUnit,
        maintenanceFrequencyWeeks: body.maintenanceFrequencyWeeks,
        timePreferenceMode: body.timePreferenceMode,
        preferredDay: body.preferredDay,
        preferredTimeBand: body.preferredTimeBand,
      })
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : 'Invalid maintenance settings',
        },
        { status: 400 }
      )
    }

    const created = await prisma.job.create({
      data: {
        title: clean(body.title) || clean(customer.name) || 'New Job',
        customerId,
        address: clean(body.address) || clean(customer.address) || '',
        notes:
          body.notes === null
            ? null
            : typeof body.notes === 'string'
              ? body.notes
              : null,
        jobType,
        visitDate: resolvedQuoteSchedule.visitDate,
        startTime: resolvedQuoteSchedule.startTime,
        durationMinutes:
          parsePositiveInt(body.durationMinutes ?? body.durationMins) ?? null,
        overrunMins: parseNonNegativeInt(body.overrunMins) ?? 0,
        status: clean(body.status) || 'unscheduled',
        paymentStatus,
        paymentNotes:
          body.paymentNotes === null
            ? null
            : typeof body.paymentNotes === 'string'
              ? body.paymentNotes.trim()
              : null,

        visitPattern: maintenanceSettings.visitPattern,
        isRegularMaintenance: maintenanceSettings.isRegularMaintenance,
        maintenanceFrequency: maintenanceSettings.maintenanceFrequency,
        maintenanceFrequencyUnit: maintenanceSettings.maintenanceFrequencyUnit,
        maintenanceFrequencyWeeks: maintenanceSettings.maintenanceFrequencyWeeks,
        timePreferenceMode: maintenanceSettings.timePreferenceMode,
        preferredDay: maintenanceSettings.preferredDay,
        preferredTimeBand: maintenanceSettings.preferredTimeBand,

        assignments:
          assignedWorkerIds.length > 0
            ? {
                create: assignedWorkerIds.map((workerId) => ({
                  workerId,
                })),
              }
            : undefined,
      },
      include: {
        customer: true,
        assignments: {
          include: {
            worker: true,
          },
        },
        photos: true,
        chasMessages: true,
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error('POST /api/jobs failed:', error)

    return NextResponse.json(
      { error: 'Failed to create job' },
      { status: 500 }
    )
  }
}