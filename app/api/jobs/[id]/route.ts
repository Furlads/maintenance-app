export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { runLocalRepairForJob } from '@/lib/auto-scheduler'
import { cancelJobAlerts, syncJobAlerts } from '@/lib/notifications'

type Ctx = { params: Promise<{ id: string }> }

const DEFAULT_JOB_DURATION_MINUTES = 60
const TREV_QUOTE_DEFAULT_SLOTS = ['11:00', '12:00', '13:00'] as const
const RECURRING_HORIZON_DAYS = 42

const ALLOWED_JOB_STATUSES = new Set([
  'unscheduled',
  'todo',
  'in_progress',
  'paused',
  'done',
  'quoted',
  'cancelled',
  'archived',
])

const ALLOWED_PAYMENT_STATUSES = new Set(['cash_paid', 'invoice_needed'])

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

function normaliseJobStatus(value: unknown): string {
  const status = clean(value).toLowerCase()

  if (!status) return ''

  if (status === 'scheduled' || status === 'to do') return 'todo'
  if (status === 'in progress' || status === 'inprogress') return 'in_progress'
  if (status === 'completed' || status === 'complete') return 'done'
  if (status === 'quote') return 'todo'
  if (status === 'quoted') return 'quoted'

  return status
}

function isQuoteJobType(jobType: string) {
  const value = clean(jobType).toLowerCase()
  return value === 'quote' || value === 'quoted'
}

function isTrue(value: unknown) {
  return value === true || value === 'true' || value === 1 || value === '1'
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

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value
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

function getAssignedWorkerIdsFromBody(body: Record<string, unknown>) {
  return parseAssignedWorkerIds(body.assignedWorkerIds ?? body.assignedTo)
}

function isMaintenanceJob(jobType: string | null | undefined) {
  return clean(jobType).toLowerCase() === 'maintenance'
}

function parseMaintenanceFrequency(value: unknown) {
  const cleanedValue = clean(value)
  return MAINTENANCE_FREQUENCY_VALUES.has(cleanedValue) ? cleanedValue : null
}

function parseMaintenanceFrequencyUnit(value: unknown) {
  const cleanedValue = clean(value).toLowerCase()
  if (cleanedValue === 'weeks' || cleanedValue === 'monthly') return cleanedValue
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

  const isMaintenance = jobType.toLowerCase() === 'maintenance'
  const isRegularMaintenance =
    isMaintenance &&
    (visitPatternRaw === 'regular-maintenance' || isTrue(input.isRegularMaintenance))

  if (!isMaintenance || !isRegularMaintenance) {
    return {
      visitPattern: isMaintenance ? visitPatternRaw : null,
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
    throw new Error('Regular maintenance jobs must have a valid maintenance frequency.')
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

function isRegularMaintenanceJob(job: {
  jobType?: string | null
  isRegularMaintenance?: boolean | null
  visitPattern?: string | null
  maintenanceFrequency?: string | null
}) {
  return (
    isMaintenanceJob(job.jobType) &&
    Boolean(job.isRegularMaintenance) &&
    clean(job.visitPattern) === 'regular-maintenance' &&
    clean(job.maintenanceFrequency) !== ''
  )
}

function addDaysToDate(date: Date, days: number) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + days,
    0,
    0,
    0,
    0
  )
}

function addMonthsToDate(date: Date, months: number) {
  return new Date(
    date.getFullYear(),
    date.getMonth() + months,
    date.getDate(),
    0,
    0,
    0,
    0
  )
}

function calculateNextMaintenanceVisitDate(args: {
  baseDate: Date
  maintenanceFrequency: string | null
  maintenanceFrequencyUnit?: string | null
  maintenanceFrequencyWeeks?: number | null
}) {
  const frequency = clean(args.maintenanceFrequency)
  const unit = clean(args.maintenanceFrequencyUnit).toLowerCase()
  const weeks =
    typeof args.maintenanceFrequencyWeeks === 'number' &&
    args.maintenanceFrequencyWeeks > 0
      ? args.maintenanceFrequencyWeeks
      : null

  if (frequency === 'monthly' || unit === 'monthly') {
    return addMonthsToDate(args.baseDate, 1)
  }

  if (frequency === 'weekly') return addDaysToDate(args.baseDate, 7)
  if (frequency === 'fortnightly') return addDaysToDate(args.baseDate, 14)
  if (frequency === 'every_3_weeks') return addDaysToDate(args.baseDate, 21)
  if (weeks) return addDaysToDate(args.baseDate, weeks * 7)

  return null
}

async function ensureFutureRecurringMaintenanceJobs(args: {
  job: {
    id: number
    title: string
    customerId: number
    address: string
    notes: string | null
    jobType: string
    visitDate: Date | null
    durationMinutes: number | null
    visitPattern: string | null
    isRegularMaintenance: boolean | null
    maintenanceFrequency: string | null
    maintenanceFrequencyUnit: string | null
    maintenanceFrequencyWeeks: number | null
    timePreferenceMode: string | null
    preferredDay: string | null
    preferredTimeBand: string | null
    assignments: Array<{ workerId: number }>
  }
}) {
  const job = args.job

  if (!isRegularMaintenanceJob(job)) {
    return []
  }

  const horizonStart = new Date()
  const horizonEnd = addDaysToDate(horizonStart, RECURRING_HORIZON_DAYS)

  const existingFutureJobs = await prisma.job.findMany({
    where: {
      customerId: job.customerId,
      title: job.title,
      jobType: job.jobType,
      visitPattern: job.visitPattern,
      isRegularMaintenance: true,
      maintenanceFrequency: job.maintenanceFrequency,
      maintenanceFrequencyUnit: job.maintenanceFrequencyUnit,
      maintenanceFrequencyWeeks: job.maintenanceFrequencyWeeks,
      visitDate: {
        gte: horizonStart,
        lte: horizonEnd,
      },
      status: {
        notIn: ['cancelled', 'archived'],
      },
    },
    orderBy: {
      visitDate: 'asc',
    },
    select: {
      id: true,
      visitDate: true,
    },
  })

  const existingDates = new Set(
    existingFutureJobs
      .filter((existingJob) => existingJob.visitDate)
      .map((existingJob) => londonDateOnlyString(existingJob.visitDate as Date))
  )

  let seedDate = job.visitDate ?? new Date()
  const createdJobs = []

  while (true) {
    const nextVisitDate = calculateNextMaintenanceVisitDate({
      baseDate: seedDate,
      maintenanceFrequency: job.maintenanceFrequency,
      maintenanceFrequencyUnit: job.maintenanceFrequencyUnit,
      maintenanceFrequencyWeeks: job.maintenanceFrequencyWeeks,
    })

    if (!nextVisitDate) break
    if (nextVisitDate > horizonEnd) break

    const nextVisitKey = londonDateOnlyString(nextVisitDate)

    if (!existingDates.has(nextVisitKey)) {
      const created = await prisma.job.create({
        data: {
          title: job.title,
          customerId: job.customerId,
          address: job.address,
          notes: job.notes,
          jobType: job.jobType,
          visitDate: nextVisitDate,
          startTime: null,
          durationMinutes: job.durationMinutes ?? DEFAULT_JOB_DURATION_MINUTES,
          overrunMins: 0,
          pausedMinutes: 0,
          status: 'unscheduled',
          visitPattern: job.visitPattern,
          isRegularMaintenance: true,
          maintenanceFrequency: job.maintenanceFrequency,
          maintenanceFrequencyUnit: job.maintenanceFrequencyUnit,
          maintenanceFrequencyWeeks: job.maintenanceFrequencyWeeks,
          timePreferenceMode: job.timePreferenceMode,
          preferredDay: job.preferredDay,
          preferredTimeBand: job.preferredTimeBand,
          assignments:
            job.assignments.length > 0
              ? {
                  create: job.assignments.map((assignment) => ({
                    workerId: assignment.workerId,
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

      createdJobs.push(created)
      existingDates.add(nextVisitKey)
    }

    seedDate = nextVisitDate
  }

  return createdJobs
}

async function buildNotesLog(jobId: number) {
  const notes = await prisma.jobNote.findMany({
    where: { jobId },
    orderBy: { createdAt: 'asc' },
    include: {
      worker: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  })

  const notesLog = notes
    .map((note) => {
      const author = note.worker
        ? `${note.worker.firstName} ${note.worker.lastName}`.trim()
        : 'Unknown'

      return `[${note.createdAt.toLocaleString('en-GB')}] ${author}: ${note.note}`
    })
    .join('\n')

  return { notes, notesLog }
}

async function findTrevWorkerIds() {
  const workers = await prisma.worker.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  })

  return workers
    .filter((worker) => {
      const firstName = clean(worker.firstName).toLowerCase()
      const lastName = clean(worker.lastName).toLowerCase()
      const email = clean(worker.email).toLowerCase()

      const firstMatches = firstName === 'trevor' || firstName === 'trev'
      const lastMatches = lastName.includes('fudger')
      const emailMatches = email.includes('trevor.fudger')

      return (firstMatches && lastMatches) || emailMatches
    })
    .map((worker) => worker.id)
}

async function resolveTrevQuoteVisitSchedule(params: {
  jobId: number
  visitDate: Date | null
  startTime: string | null
  jobType: string
  assignedWorkerIds: number[]
  allowQuoteTimeOverride: boolean
}) {
  const {
    jobId,
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

  const existingJobsForTrevThatDay = await prisma.job.findMany({
    where: {
      id: {
        not: jobId,
      },
      visitDate: {
        gte: dayStart,
        lt: dayEnd,
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
      jobType: true,
      startTime: true,
      status: true,
    },
  })

  const existingTrevQuoteJobs = existingJobsForTrevThatDay.filter(
    (job) =>
      clean(job.jobType).toLowerCase() === 'quote' &&
      !['cancelled', 'archived'].includes(clean(job.status).toLowerCase())
  )

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
          error:
            'Trev already has a quote visit booked at that time on that day.',
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

function normaliseScheduleState(params: {
  requestedStatus: string | undefined
  visitDate: Date | null
  startTime: string | null
  hasAssignedWorkers: boolean
  isTrevQuoteJob: boolean
}) {
  const { requestedStatus, visitDate, startTime, hasAssignedWorkers } = params
  const cleanStatus = normaliseJobStatus(requestedStatus)

  if (startTime && !visitDate) {
    throw new Error('A start time cannot be saved without a visit date.')
  }

  if (!visitDate && !startTime) {
    if (cleanStatus === 'quoted') {
      return {
        visitDate: null,
        startTime: null,
        status: 'quoted',
      }
    }

    return {
      visitDate: null,
      startTime: null,
      status: 'unscheduled',
    }
  }

  if (visitDate && !startTime) {
    return {
      visitDate,
      startTime: null,
      status: cleanStatus || 'unscheduled',
    }
  }

  if (visitDate && startTime && hasAssignedWorkers) {
    return {
      visitDate,
      startTime,
      status:
        cleanStatus && cleanStatus !== 'unscheduled' ? cleanStatus : 'todo',
    }
  }

  return {
    visitDate,
    startTime,
    status: cleanStatus || 'todo',
  }
}

function shouldTriggerSchedulerRepair(
  body: Record<string, unknown>,
  existingAssignedWorkerIds: number[],
  nextAssignedWorkerIds: number[]
) {
  const changedAssignedWorkers =
    existingAssignedWorkerIds.length !== nextAssignedWorkerIds.length ||
    existingAssignedWorkerIds.some(
      (workerId, index) => workerId !== nextAssignedWorkerIds[index]
    )

  return (
    'visitDate' in body ||
    'startTime' in body ||
    'durationMinutes' in body ||
    'durationMins' in body ||
    'assignedTo' in body ||
    'assignedWorkerIds' in body ||
    changedAssignedWorkers
  )
}

function buildJobAuditSnapshot(job: {
  id: number
  title: string
  customerId: number
  address: string
  notes: string | null
  visitDate: Date | null
  startTime: string | null
  durationMinutes: number | null
  status: string
  jobType: string
  arrivedAt?: Date | null
  finishedAt?: Date | null
  pausedAt?: Date | null
  pausedMinutes?: number | null
  overrunMins?: number | null
  paymentStatus?: string | null
  paymentNotes?: string | null
  visitPattern?: string | null
  isRegularMaintenance?: boolean | null
  maintenanceFrequency?: string | null
  maintenanceFrequencyUnit?: string | null
  maintenanceFrequencyWeeks?: number | null
  timePreferenceMode?: string | null
  preferredDay?: string | null
  preferredTimeBand?: string | null
  assignments?: Array<{ workerId: number }>
}) {
  return {
    id: job.id,
    title: job.title,
    customerId: job.customerId,
    address: job.address,
    notes: job.notes,
    visitDate: job.visitDate,
    startTime: job.startTime,
    durationMinutes: job.durationMinutes,
    status: job.status,
    jobType: job.jobType,
    arrivedAt: job.arrivedAt ?? null,
    finishedAt: job.finishedAt ?? null,
    pausedAt: job.pausedAt ?? null,
    pausedMinutes: job.pausedMinutes ?? 0,
    overrunMins: job.overrunMins ?? 0,
    paymentStatus: job.paymentStatus ?? null,
    paymentNotes: job.paymentNotes ?? null,
    visitPattern: job.visitPattern ?? null,
    isRegularMaintenance: job.isRegularMaintenance ?? false,
    maintenanceFrequency: job.maintenanceFrequency ?? null,
    maintenanceFrequencyUnit: job.maintenanceFrequencyUnit ?? null,
    maintenanceFrequencyWeeks: job.maintenanceFrequencyWeeks ?? null,
    timePreferenceMode: job.timePreferenceMode ?? null,
    preferredDay: job.preferredDay ?? null,
    preferredTimeBand: job.preferredTimeBand ?? null,
    assignedWorkerIds: (job.assignments ?? []).map((assignment) => assignment.workerId),
  }
}

export async function GET(_: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const jobId = parseInt(id, 10)

    if (!jobId || Number.isNaN(jobId)) {
      return NextResponse.json(
        { error: 'Invalid job id', received: id },
        { status: 400 }
      )
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
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

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const { notes, notesLog } = await buildNotesLog(jobId)

    return NextResponse.json({
      ...job,
      jobNotes: notes,
      notesLog,
      assignedWorkerIds: job.assignments.map((assignment) => assignment.workerId),
    })
  } catch (error) {
    console.error('GET /api/jobs/[id] failed:', error)

    return NextResponse.json(
      { error: 'Failed to load job' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const jobId = parseInt(id, 10)

    if (!jobId || Number.isNaN(jobId)) {
      return NextResponse.json(
        { error: 'Invalid job id', received: id },
        { status: 400 }
      )
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>))

    const existing = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        assignments: true,
        customer: {
          select: {
            postcode: true,
          },
        },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const existingSnapshot = buildJobAuditSnapshot(existing)

    const action = clean(body.action).toLowerCase()
    const requestedStatus = normaliseJobStatus(body.status)
    const appendNote = clean(body.appendNote)
    const noteAuthor = clean(body.noteAuthor)
    const allowQuoteTimeOverride = isTrue(body.allowQuoteTimeOverride)
    const extendMins = parsePositiveInt(body.extendMins)

    const isCancelAction =
      action === 'cancel' || action === 'cancelled' || requestedStatus === 'cancelled'
    const isArchiveAction =
      action === 'archive' || action === 'archived' || requestedStatus === 'archived'

    const now = new Date()

    let statusUpdate: string | undefined = undefined
    let arrivedAtUpdate: Date | null | undefined = undefined
    let finishedAtUpdate: Date | null | undefined = undefined
    let pausedAtUpdate: Date | null | undefined = undefined
    let pausedMinutesUpdate: number | undefined = undefined
    let durationMinutesUpdate: number | undefined = parsePositiveInt(
      body.durationMinutes ?? body.durationMins
    )
    let notesUpdate: string | null | undefined = undefined

    if (requestedStatus) {
      if (!ALLOWED_JOB_STATUSES.has(requestedStatus)) {
        return NextResponse.json(
          { error: 'Invalid job status' },
          { status: 400 }
        )
      }

      statusUpdate = requestedStatus
    }

    if (body.toggleStatus === true) {
      statusUpdate = existing.status === 'done' ? 'unscheduled' : 'done'

      if (statusUpdate === 'done') {
        finishedAtUpdate = now
      } else {
        finishedAtUpdate = null
      }
    }

    if (action === 'start') {
      arrivedAtUpdate = existing.arrivedAt ?? now
      finishedAtUpdate = null
      pausedAtUpdate = null
      statusUpdate = statusUpdate ?? 'in_progress'
    }

    if (action === 'pause') {
      if (existing.arrivedAt && !existing.finishedAt && !existing.pausedAt) {
        pausedAtUpdate = now
        statusUpdate = statusUpdate ?? 'paused'
      }
    }

    if (action === 'resume') {
      if (existing.pausedAt) {
        const additionalPausedMinutes =
          Math.max(0, Math.round((now.getTime() - existing.pausedAt.getTime()) / 60000))
        pausedMinutesUpdate = (existing.pausedMinutes ?? 0) + additionalPausedMinutes
      }

      if (!existing.arrivedAt) {
        arrivedAtUpdate = now
      }

      pausedAtUpdate = null
      statusUpdate = statusUpdate ?? 'in_progress'
    }

    if (action === 'finish') {
      let finalPausedMinutes = existing.pausedMinutes ?? 0

      if (existing.pausedAt) {
        finalPausedMinutes += Math.max(
          0,
          Math.round((now.getTime() - existing.pausedAt.getTime()) / 60000)
        )
        pausedAtUpdate = null
      }

      pausedMinutesUpdate = finalPausedMinutes
      finishedAtUpdate = now
      statusUpdate = statusUpdate ?? 'done'
    }

    if (action === 'cannot_complete') {
      const workerName = clean(body.workerName) || 'Unknown worker'
      const reason = clean(body.reason)
      const details = clean(body.details)
      const recordedAt = new Date().toLocaleString('en-GB')

      if (!reason) {
        return NextResponse.json(
          { error: 'Reason is required when marking a job as could not complete' },
          { status: 400 }
        )
      }

      const existingNotes = existing.notes?.trim() || ''
      const cannotCompleteLine = [
        `Job could not be completed: ${reason}`,
        `Details: ${details || 'None'}`,
        `Reported by: ${workerName}`,
        `Recorded at: ${recordedAt}`,
      ].join(' | ')

      notesUpdate = existingNotes
        ? `${existingNotes}\n${cannotCompleteLine}`
        : cannotCompleteLine

      if (existing.pausedAt) {
        const additionalPausedMinutes = Math.max(
          0,
          Math.round((now.getTime() - existing.pausedAt.getTime()) / 60000)
        )
        pausedMinutesUpdate = (existing.pausedMinutes ?? 0) + additionalPausedMinutes
        pausedAtUpdate = null
      }

      finishedAtUpdate = null
      statusUpdate = 'paused'
    }

    if (extendMins) {
      const currentDuration = existing.durationMinutes ?? DEFAULT_JOB_DURATION_MINUTES
      durationMinutesUpdate = currentDuration + extendMins
    }

    if ('arrivedAt' in body) {
      if (body.arrivedAt === null || body.arrivedAt === '') {
        arrivedAtUpdate = null
      } else {
        const parsedArrivedAt = parseDateValue(body.arrivedAt)
        if (parsedArrivedAt !== undefined) {
          arrivedAtUpdate = parsedArrivedAt
        }
      }
    }

    if ('finishedAt' in body) {
      if (body.finishedAt === null || body.finishedAt === '') {
        finishedAtUpdate = null
      } else {
        const parsedFinishedAt = parseDateValue(body.finishedAt)
        if (parsedFinishedAt !== undefined) {
          finishedAtUpdate = parsedFinishedAt
        }
      }
    }

    if ('pausedAt' in body) {
      if (body.pausedAt === null || body.pausedAt === '') {
        pausedAtUpdate = null
      } else {
        const parsedPausedAt = parseDateValue(body.pausedAt)
        if (parsedPausedAt !== undefined) {
          pausedAtUpdate = parsedPausedAt
        }
      }
    }

    if ('pausedMinutes' in body) {
      const parsedPausedMinutes = parseNonNegativeInt(body.pausedMinutes)
      if (parsedPausedMinutes !== undefined) {
        pausedMinutesUpdate = parsedPausedMinutes
      } else if (body.pausedMinutes === 0) {
        pausedMinutesUpdate = 0
      }
    }

    const visitDateUpdate = parseDateValue(body.visitDate)

    let startTimeUpdate: string | null | undefined = undefined
    if ('startTime' in body) {
      if (body.startTime === null || clean(body.startTime) === '') {
        startTimeUpdate = null
      } else if (typeof body.startTime === 'string') {
        const trimmedStartTime = body.startTime.trim()

        if (!isValidHHMM(trimmedStartTime)) {
          return NextResponse.json(
            { error: 'startTime must be HH:MM' },
            { status: 400 }
          )
        }

        startTimeUpdate = trimmedStartTime
      } else {
        return NextResponse.json(
          { error: 'startTime must be a string in HH:MM format' },
          { status: 400 }
        )
      }
    }

    const overrunMinsUpdate = parseNonNegativeInt(body.overrunMins)

    const customerIdUpdate =
      body.customerId === null
        ? undefined
        : parsePositiveInt(body.customerId)

    let proposedAssignedWorkerIds =
      existing.assignments.map((assignment) => assignment.workerId)
    let assignedWorkerIdsForResponse: number[] | undefined = undefined

    if (body.assignedTo !== undefined || body.assignedWorkerIds !== undefined) {
      const cleanedWorkerIds = getAssignedWorkerIdsFromBody(body)

      const existingWorkers = cleanedWorkerIds.length
        ? await prisma.worker.findMany({
            where: {
              id: {
                in: cleanedWorkerIds,
              },
            },
            select: { id: true },
          })
        : []

      const existingWorkerIds = new Set(existingWorkers.map((worker) => worker.id))

      const missingWorkerIds = cleanedWorkerIds.filter(
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

      proposedAssignedWorkerIds = cleanedWorkerIds
      assignedWorkerIdsForResponse = cleanedWorkerIds
    }

    if ('paymentStatus' in body && body.paymentStatus !== null) {
      const paymentStatusRaw = clean(body.paymentStatus).toLowerCase()
      if (paymentStatusRaw && !ALLOWED_PAYMENT_STATUSES.has(paymentStatusRaw)) {
        return NextResponse.json(
          { error: 'paymentStatus must be cash_paid or invoice_needed' },
          { status: 400 }
        )
      }
    }

    if (isCancelAction || isArchiveAction) {
      const finalStatus = isCancelAction ? 'cancelled' : 'archived'

      const updated = await prisma.$transaction(async (tx) => {
        if (body.assignedTo !== undefined || body.assignedWorkerIds !== undefined) {
          await tx.jobAssignment.deleteMany({
            where: { jobId },
          })

          if (proposedAssignedWorkerIds.length > 0) {
            await tx.jobAssignment.createMany({
              data: proposedAssignedWorkerIds.map((workerId) => ({
                jobId,
                workerId,
              })),
              skipDuplicates: true,
            })
          }
        }

        const result = await tx.job.update({
          where: { id: jobId },
          data: {
            status: finalStatus,
            visitDate: null,
            startTime: null,
            arrivedAt: null,
            finishedAt: null,
            pausedAt: null,
            pausedMinutes: 0,
            ...(isCancelAction
              ? {
                  cancelledAt: now,
                  cancellationReason:
                    typeof body.cancellationReason === 'string'
                      ? body.cancellationReason.trim() || null
                      : null,
                }
              : {
                  archivedAt: now,
                }),
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

        await tx.jobAuditLog.create({
          data: {
            jobId,
            action: finalStatus,
            beforeJson: JSON.stringify(existingSnapshot),
            afterJson: JSON.stringify(buildJobAuditSnapshot(result)),
          },
        })

        return result
      })

      const { notes, notesLog } = await buildNotesLog(jobId)

      try {
        await cancelJobAlerts(jobId)
      } catch (alertError) {
        console.error(`Failed to cancel alerts after job ${finalStatus}:`, alertError)
      }

      try {
        await runLocalRepairForJob({
          jobId,
          reason: 'cancel',
        })
      } catch (schedulerError) {
        console.error(
          `Local scheduler repair failed after job ${finalStatus}:`,
          schedulerError
        )
      }

      return NextResponse.json({
        ...updated,
        jobNotes: notes,
        notesLog,
        assignedWorkerIds:
          assignedWorkerIdsForResponse ??
          updated.assignments.map((assignment) => assignment.workerId),
      })
    }

    const proposedJobType =
      typeof body.jobType === 'string' ? body.jobType : existing.jobType

    const proposedVisitDate =
      visitDateUpdate !== undefined ? visitDateUpdate : existing.visitDate

    const proposedStartTime =
      startTimeUpdate !== undefined ? startTimeUpdate : existing.startTime

    const isExplicitQuoteComplete =
      isQuoteJobType(proposedJobType) &&
      requestedStatus === 'quoted' &&
      visitDateUpdate === null &&
      startTimeUpdate === null

    let finalVisitDate = proposedVisitDate
    let finalStartTime = proposedStartTime

    if (!isExplicitQuoteComplete) {
      const resolvedQuoteSchedule = await resolveTrevQuoteVisitSchedule({
        jobId,
        visitDate: proposedVisitDate,
        startTime: proposedStartTime,
        jobType: proposedJobType,
        assignedWorkerIds: proposedAssignedWorkerIds,
        allowQuoteTimeOverride,
      })

      if ('error' in resolvedQuoteSchedule) {
        return resolvedQuoteSchedule.error
      }

      finalVisitDate = resolvedQuoteSchedule.visitDate
      finalStartTime = resolvedQuoteSchedule.startTime
    }

    const isTrevQuoteJob =
      isQuoteJobType(proposedJobType) && finalVisitDate !== null

    let scheduleState
    try {
      scheduleState = normaliseScheduleState({
        requestedStatus: statusUpdate ?? existing.status,
        visitDate: finalVisitDate,
        startTime: finalStartTime,
        hasAssignedWorkers: proposedAssignedWorkerIds.length > 0,
        isTrevQuoteJob,
      })
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : 'Invalid scheduling state',
        },
        { status: 400 }
      )
    }

    let titleUpdate: string | undefined = undefined

    if (customerIdUpdate !== undefined) {
      const targetCustomer = await prisma.customer.findUnique({
        where: { id: customerIdUpdate },
        select: { name: true },
      })

      if (!targetCustomer) {
        return NextResponse.json(
          { error: 'Customer not found' },
          { status: 404 }
        )
      }

      titleUpdate = clean(targetCustomer.name)
    }

    const maintenanceInputProvided =
      'visitPattern' in body ||
      'isRegularMaintenance' in body ||
      'maintenanceFrequency' in body ||
      'maintenanceFrequencyUnit' in body ||
      'maintenanceFrequencyWeeks' in body ||
      'timePreferenceMode' in body ||
      'preferredDay' in body ||
      'preferredTimeBand' in body ||
      ('jobType' in body && !isMaintenanceJob(proposedJobType))

    let maintenanceSettings:
      | {
          visitPattern: string | null
          isRegularMaintenance: boolean
          maintenanceFrequency: string | null
          maintenanceFrequencyUnit: string | null
          maintenanceFrequencyWeeks: number | null
          timePreferenceMode: string | null
          preferredDay: string | null
          preferredTimeBand: string | null
        }
      | undefined = undefined

    if (maintenanceInputProvided) {
      try {
        maintenanceSettings = normaliseMaintenanceSettings({
          jobType: proposedJobType,
          visitPattern:
            body.visitPattern !== undefined ? body.visitPattern : existing.visitPattern,
          isRegularMaintenance:
            body.isRegularMaintenance !== undefined
              ? body.isRegularMaintenance
              : existing.isRegularMaintenance,
          maintenanceFrequency:
            body.maintenanceFrequency !== undefined
              ? body.maintenanceFrequency
              : existing.maintenanceFrequency,
          maintenanceFrequencyUnit:
            body.maintenanceFrequencyUnit !== undefined
              ? body.maintenanceFrequencyUnit
              : existing.maintenanceFrequencyUnit,
          maintenanceFrequencyWeeks:
            body.maintenanceFrequencyWeeks !== undefined
              ? body.maintenanceFrequencyWeeks
              : existing.maintenanceFrequencyWeeks,
          timePreferenceMode:
            body.timePreferenceMode !== undefined
              ? body.timePreferenceMode
              : existing.timePreferenceMode,
          preferredDay:
            body.preferredDay !== undefined ? body.preferredDay : existing.preferredDay,
          preferredTimeBand:
            body.preferredTimeBand !== undefined
              ? body.preferredTimeBand
              : existing.preferredTimeBand,
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
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (body.assignedTo !== undefined || body.assignedWorkerIds !== undefined) {
        await tx.jobAssignment.deleteMany({
          where: { jobId },
        })

        if (proposedAssignedWorkerIds.length > 0) {
          await tx.jobAssignment.createMany({
            data: proposedAssignedWorkerIds.map((workerId) => ({
              jobId,
              workerId,
            })),
            skipDuplicates: true,
          })
        }
      }

      const result = await tx.job.update({
        where: { id: jobId },
        data: {
          title: titleUpdate,
          address: typeof body.address === 'string' ? body.address : undefined,
          notes:
            notesUpdate !== undefined
              ? notesUpdate
              : body.notes === null
                ? null
                : typeof body.notes === 'string'
                  ? body.notes
                  : undefined,
          jobType: typeof body.jobType === 'string' ? body.jobType : undefined,
          customerId: customerIdUpdate,
          visitDate: scheduleState.visitDate,
          startTime: scheduleState.startTime,
          durationMinutes: durationMinutesUpdate,
          overrunMins: overrunMinsUpdate,
          status: scheduleState.status,
          arrivedAt: arrivedAtUpdate,
          finishedAt: finishedAtUpdate,
          pausedAt: pausedAtUpdate,
          pausedMinutes: pausedMinutesUpdate,
          paymentStatus:
            body.paymentStatus === null
              ? null
              : typeof body.paymentStatus === 'string'
                ? clean(body.paymentStatus).toLowerCase() || null
                : undefined,
          paymentNotes:
            body.paymentNotes === null
              ? null
              : typeof body.paymentNotes === 'string'
                ? body.paymentNotes
                : undefined,

          visitPattern: maintenanceSettings?.visitPattern,
          isRegularMaintenance: maintenanceSettings?.isRegularMaintenance,
          maintenanceFrequency: maintenanceSettings?.maintenanceFrequency,
          maintenanceFrequencyUnit: maintenanceSettings?.maintenanceFrequencyUnit,
          maintenanceFrequencyWeeks: maintenanceSettings?.maintenanceFrequencyWeeks,
          timePreferenceMode: maintenanceSettings?.timePreferenceMode,
          preferredDay: maintenanceSettings?.preferredDay,
          preferredTimeBand: maintenanceSettings?.preferredTimeBand,
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

      if (appendNote) {
        let createdByWorkerId: number | null = null

        if (noteAuthor) {
          const authorParts = noteAuthor.trim().split(/\s+/).filter(Boolean)

          if (authorParts.length > 0) {
            const possibleWorkers = await tx.worker.findMany({
              select: { id: true, firstName: true, lastName: true },
            })

            const authorLower = noteAuthor.trim().toLowerCase()

            const match = possibleWorkers.find((worker) => {
              const fullName = `${worker.firstName} ${worker.lastName}`.trim().toLowerCase()
              const firstName = worker.firstName.trim().toLowerCase()
              const lastName = worker.lastName.trim().toLowerCase()

              if (fullName === authorLower) return true
              if (firstName === authorLower) return true
              if (lastName === authorLower) return true

              if (authorParts.length >= 2) {
                return (
                  firstName === authorParts[0].toLowerCase() &&
                  lastName === authorParts.slice(1).join(' ').toLowerCase()
                )
              }

              return false
            })

            if (match) {
              createdByWorkerId = match.id
            }
          }
        }

        await tx.jobNote.create({
          data: {
            jobId,
            note: appendNote,
            createdByWorkerId,
          },
        })
      }

      await tx.jobAuditLog.create({
        data: {
          jobId,
          action: action || 'updated',
          beforeJson: JSON.stringify(existingSnapshot),
          afterJson: JSON.stringify(buildJobAuditSnapshot(result)),
        },
      })

      return result
    })

    let nextRecurringJobs: unknown[] = []

    if (updated.status === 'done') {
      nextRecurringJobs = await ensureFutureRecurringMaintenanceJobs({
        job: {
          id: updated.id,
          title: updated.title,
          customerId: updated.customerId,
          address: updated.address,
          notes: updated.notes,
          jobType: updated.jobType,
          visitDate: updated.visitDate,
          durationMinutes: updated.durationMinutes,
          visitPattern: updated.visitPattern,
          isRegularMaintenance: updated.isRegularMaintenance,
          maintenanceFrequency: updated.maintenanceFrequency,
          maintenanceFrequencyUnit: updated.maintenanceFrequencyUnit,
          maintenanceFrequencyWeeks: updated.maintenanceFrequencyWeeks,
          timePreferenceMode: updated.timePreferenceMode,
          preferredDay: updated.preferredDay,
          preferredTimeBand: updated.preferredTimeBand,
          assignments: updated.assignments.map((assignment) => ({
            workerId: assignment.workerId,
          })),
        },
      })
    }

    const refreshed = await prisma.job.findUnique({
      where: { id: jobId },
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

    const { notes, notesLog } = await buildNotesLog(jobId)

    try {
      const existingAssignedWorkerIds = existing.assignments
        .map((assignment) => assignment.workerId)
        .sort((a, b) => a - b)
      const nextAssignedWorkerIds = proposedAssignedWorkerIds
        .slice()
        .sort((a, b) => a - b)

      if (
        shouldTriggerSchedulerRepair(body, existingAssignedWorkerIds, nextAssignedWorkerIds)
      ) {
        await runLocalRepairForJob({
          jobId,
          reason: 'edit',
        })
      }
    } catch (schedulerError) {
      console.error('Local scheduler repair failed after job patch:', schedulerError)
    }

    try {
      await syncJobAlerts(jobId)
    } catch (alertError) {
      console.error('Failed to sync alerts after job patch:', alertError)
    }

    return NextResponse.json({
      ...(refreshed ?? updated),
      jobNotes: notes,
      notesLog,
      assignedWorkerIds:
        assignedWorkerIdsForResponse ??
        (refreshed ?? updated).assignments.map((assignment) => assignment.workerId),
      nextRecurringJobs,
    })
  } catch (error) {
    console.error('PATCH /api/jobs/[id] failed:', error)

    return NextResponse.json(
      { error: 'Failed to update job' },
      { status: 500 }
    )
  }
}