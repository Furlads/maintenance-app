import prisma from '@/lib/prisma'

const DEFAULT_JOB_DURATION_MINUTES = 60
const RECURRING_HORIZON_DAYS = 42

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
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

function isMaintenanceJob(jobType: string | null | undefined) {
  return clean(jobType).toLowerCase().includes('maint')
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

  if (frequency === 'weekly') {
    return addDaysToDate(args.baseDate, 7)
  }

  if (frequency === 'fortnightly') {
    return addDaysToDate(args.baseDate, 14)
  }

  if (frequency === 'every_3_weeks') {
    return addDaysToDate(args.baseDate, 21)
  }

  if (frequency === '4-weekly') {
    return addDaysToDate(args.baseDate, 28)
  }

  if (weeks) {
    return addDaysToDate(args.baseDate, weeks * 7)
  }

  return null
}

type RecurringJobRow = {
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
  status: string
  assignments: Array<{ workerId: number }>
}

function buildSeriesKey(job: RecurringJobRow) {
  const workerIds = [...job.assignments.map((assignment) => assignment.workerId)].sort(
    (a, b) => a - b
  )

  return [
    job.customerId,
    clean(job.title).toLowerCase(),
    clean(job.jobType).toLowerCase(),
    clean(job.visitPattern).toLowerCase(),
    clean(job.maintenanceFrequency).toLowerCase(),
    clean(job.maintenanceFrequencyUnit).toLowerCase(),
    String(job.maintenanceFrequencyWeeks ?? ''),
    clean(job.preferredDay).toLowerCase(),
    clean(job.preferredTimeBand).toLowerCase(),
    workerIds.join(','),
  ].join('::')
}

export async function ensureRollingRecurringMaintenanceJobs() {
  const horizonStart = new Date()
  const horizonEnd = addDaysToDate(horizonStart, RECURRING_HORIZON_DAYS)

  const recurringJobs = await prisma.job.findMany({
    where: {
      isRegularMaintenance: true,
      visitPattern: 'regular-maintenance',
      status: {
        notIn: ['cancelled', 'archived'],
      },
    },
    orderBy: [
      { customerId: 'asc' },
      { title: 'asc' },
      { visitDate: 'asc' },
      { createdAt: 'asc' },
    ],
    select: {
      id: true,
      title: true,
      customerId: true,
      address: true,
      notes: true,
      jobType: true,
      visitDate: true,
      durationMinutes: true,
      visitPattern: true,
      isRegularMaintenance: true,
      maintenanceFrequency: true,
      maintenanceFrequencyUnit: true,
      maintenanceFrequencyWeeks: true,
      timePreferenceMode: true,
      preferredDay: true,
      preferredTimeBand: true,
      status: true,
      assignments: {
        select: {
          workerId: true,
        },
      },
    },
  })

  if (recurringJobs.length === 0) {
    return { createdCount: 0, createdJobs: [] as Awaited<ReturnType<typeof prisma.job.create>>[] }
  }

  const jobsBySeries = new Map<string, RecurringJobRow[]>()

  for (const job of recurringJobs) {
    if (!isRegularMaintenanceJob(job)) {
      continue
    }

    const key = buildSeriesKey(job)
    const current = jobsBySeries.get(key) || []
    current.push(job)
    jobsBySeries.set(key, current)
  }

  const createdJobs: Awaited<ReturnType<typeof prisma.job.create>>[] = []

  for (const seriesJobs of jobsBySeries.values()) {
    const datedJobs = seriesJobs
      .filter((job) => job.visitDate !== null)
      .sort((a, b) => {
        const aTime = a.visitDate ? a.visitDate.getTime() : 0
        const bTime = b.visitDate ? b.visitDate.getTime() : 0
        return aTime - bTime
      })

    const template = datedJobs[datedJobs.length - 1] ?? seriesJobs[0]

    if (!template || !template.visitDate) {
      continue
    }

    const existingDates = new Set(
      datedJobs
        .filter((job) => job.visitDate)
        .map((job) => londonDateOnlyString(job.visitDate as Date))
    )

    let seedDate = template.visitDate

    while (true) {
      const nextVisitDate = calculateNextMaintenanceVisitDate({
        baseDate: seedDate,
        maintenanceFrequency: template.maintenanceFrequency,
        maintenanceFrequencyUnit: template.maintenanceFrequencyUnit,
        maintenanceFrequencyWeeks: template.maintenanceFrequencyWeeks,
      })

      if (!nextVisitDate) {
        break
      }

      if (nextVisitDate > horizonEnd) {
        break
      }

      const nextVisitKey = londonDateOnlyString(nextVisitDate)

      if (!existingDates.has(nextVisitKey)) {
        const created = await prisma.job.create({
          data: {
            title: template.title,
            customerId: template.customerId,
            address: template.address,
            notes: template.notes,
            jobType: template.jobType,
            visitDate: nextVisitDate,
            startTime: null,
            durationMinutes: template.durationMinutes ?? DEFAULT_JOB_DURATION_MINUTES,
            overrunMins: 0,
            pausedMinutes: 0,
            status: 'unscheduled',

            visitPattern: template.visitPattern,
            isRegularMaintenance: true,
            maintenanceFrequency: template.maintenanceFrequency,
            maintenanceFrequencyUnit: template.maintenanceFrequencyUnit,
            maintenanceFrequencyWeeks: template.maintenanceFrequencyWeeks,
            timePreferenceMode: template.timePreferenceMode,
            preferredDay: template.preferredDay,
            preferredTimeBand: template.preferredTimeBand,

            assignments:
              template.assignments.length > 0
                ? {
                    create: template.assignments.map((assignment) => ({
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
  }

  return {
    createdCount: createdJobs.length,
    createdJobs,
  }
}