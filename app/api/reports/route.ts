export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

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

function startOfLondonDayUtc(date: Date) {
  return new Date(`${londonDateOnlyString(date)}T00:00:00.000Z`)
}

function nextLondonDayUtc(date: Date) {
  const start = startOfLondonDayUtc(date)
  return new Date(start.getTime() + 24 * 60 * 60 * 1000)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function parseDateOnly(value: string | null) {
  const raw = clean(value)

  if (!raw) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null

  return new Date(`${raw}T00:00:00.000Z`)
}

function getStartOfWeekLondon(date: Date) {
  const londonStart = startOfLondonDayUtc(date)
  const weekday = londonStart.getUTCDay()
  const offsetToMonday = weekday === 0 ? -6 : 1 - weekday
  return addDays(londonStart, offsetToMonday)
}

function getStartOfMonthLondon(date: Date) {
  const { year, month } = getLondonDateParts(date)
  return new Date(`${year}-${month}-01T00:00:00.000Z`)
}

function fullName(worker?: { firstName?: string | null; lastName?: string | null } | null) {
  if (!worker) return null

  const first = typeof worker.firstName === 'string' ? worker.firstName.trim() : ''
  const last = typeof worker.lastName === 'string' ? worker.lastName.trim() : ''
  const full = `${first} ${last}`.trim()

  return full || null
}

function extractCannotCompleteInfo(text: string) {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const matchingLine = [...lines]
    .reverse()
    .find((line) => line.toLowerCase().startsWith('job could not be completed:'))

  if (!matchingLine) return null

  const parts = matchingLine.split(' | ').map((part) => part.trim())

  const reasonPart =
    parts.find((part) =>
      part.toLowerCase().startsWith('job could not be completed:')
    ) || ''

  const detailsPart =
    parts.find((part) => part.toLowerCase().startsWith('details:')) || ''

  const reportedByPart =
    parts.find((part) => part.toLowerCase().startsWith('reported by:')) || ''

  const recordedAtPart =
    parts.find((part) => part.toLowerCase().startsWith('recorded at:')) || ''

  return {
    reason: reasonPart.replace(/^job could not be completed:\s*/i, '').trim(),
    details: detailsPart.replace(/^details:\s*/i, '').trim(),
    reportedBy: reportedByPart.replace(/^reported by:\s*/i, '').trim(),
    recordedAt: recordedAtPart.replace(/^recorded at:\s*/i, '').trim(),
  }
}

function stripCannotCompleteLines(value?: string | null) {
  if (!value) return ''

  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(
      (line) =>
        line && !line.toLowerCase().startsWith('job could not be completed:')
    )
    .join('\n')
}

function resolveRange(searchParams: URLSearchParams) {
  const preset = clean(searchParams.get('preset')).toLowerCase()
  const fromRaw = searchParams.get('from')
  const toRaw = searchParams.get('to')

  const now = new Date()

  if (preset === 'week') {
    const from = getStartOfWeekLondon(now)
    return {
      from,
      toExclusive: addDays(from, 7),
      label: 'This week',
      preset: 'week',
    }
  }

  if (preset === 'month') {
    const from = getStartOfMonthLondon(now)
    const { year, month } = getLondonDateParts(now)
    const nextMonth =
      Number(month) === 12
        ? new Date(`${Number(year) + 1}-01-01T00:00:00.000Z`)
        : new Date(
            `${year}-${String(Number(month) + 1).padStart(2, '0')}-01T00:00:00.000Z`
          )

    return {
      from,
      toExclusive: nextMonth,
      label: 'This month',
      preset: 'month',
    }
  }

  if (preset === 'custom') {
    const from = parseDateOnly(fromRaw)
    const to = parseDateOnly(toRaw)

    if (!from || !to) {
      return null
    }

    const toExclusive = addDays(startOfLondonDayUtc(to), 1)

    return {
      from: startOfLondonDayUtc(from),
      toExclusive,
      label: 'Custom',
      preset: 'custom',
    }
  }

  const from = startOfLondonDayUtc(now)

  return {
    from,
    toExclusive: nextLondonDayUtc(now),
    label: 'Today',
    preset: 'today',
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const range = resolveRange(searchParams)

    if (!range) {
      return NextResponse.json(
        { error: 'Custom reports require valid from and to dates.' },
        { status: 400 }
      )
    }

    const jobs = await prisma.job.findMany({
      where: {
        status: {
          notIn: ['cancelled', 'archived'],
        },
        OR: [
          {
            finishedAt: {
              gte: range.from,
              lt: range.toExclusive,
            },
          },
          {
            status: 'done',
            visitDate: {
              gte: range.from,
              lt: range.toExclusive,
            },
          },
        ],
      },
      orderBy: [{ finishedAt: 'desc' }, { visitDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        customer: true,
        assignments: {
          include: {
            worker: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        jobNotes: {
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            worker: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        photos: {
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            uploadedByWorker: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    })

    const reports = jobs.map((job) => {
      const assignedWorkers = job.assignments
        .map((assignment) => fullName(assignment.worker))
        .filter((value): value is string => Boolean(value))

      const cleanedJobNotes = stripCannotCompleteLines(job.notes)
      const noteTexts = job.jobNotes.map((note) => note.note).join('\n')
      const cannotCompleteInfo =
        extractCannotCompleteInfo(job.notes || '') ||
        extractCannotCompleteInfo(noteTexts)

      return {
        id: job.id,
        title: job.title,
        jobType: job.jobType,
        status: job.status,
        address: job.address,
        visitDate: job.visitDate ? job.visitDate.toISOString() : null,
        finishedAt: job.finishedAt ? job.finishedAt.toISOString() : null,
        createdAt: job.createdAt.toISOString(),
        customer: {
          id: job.customer.id,
          name: job.customer.name,
          phone: job.customer.phone,
          email: job.customer.email,
          address: job.customer.address,
          postcode: job.customer.postcode,
        },
        assignedWorkers,
        notes: cleanedJobNotes || null,
        cannotCompleteInfo,
        reportNotes: job.jobNotes.map((note) => ({
          id: note.id,
          note: stripCannotCompleteLines(note.note),
          createdAt: note.createdAt.toISOString(),
          createdByWorkerName: fullName(note.worker),
        })),
        photos: job.photos.map((photo) => ({
          id: photo.id,
          imageUrl: photo.imageUrl,
          label: photo.label,
          createdAt: photo.createdAt.toISOString(),
          uploadedByWorkerName: fullName(photo.uploadedByWorker),
        })),
      }
    })

    return NextResponse.json({
      preset: range.preset,
      label: range.label,
      from: range.from.toISOString(),
      toExclusive: range.toExclusive.toISOString(),
      totalReports: reports.length,
      totalPhotos: reports.reduce((sum, report) => sum + report.photos.length, 0),
      totalReportNotes: reports.reduce(
        (sum, report) => sum + report.reportNotes.length,
        0
      ),
      reports,
    })
  } catch (error) {
    console.error('GET /api/reports failed:', error)

    return NextResponse.json(
      { error: 'Failed to load reports' },
      { status: 500 }
    )
  }
}