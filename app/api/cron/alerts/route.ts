import prisma from '@/lib/prisma'

const FARM_POSTCODE = 'TF9 4BQ'
const ONE_HOUR_BEFORE_KIND = 'trev_quote_one_hour'
const LEAVE_NOW_KIND = 'trev_quote_leave_now'
const PENDING_STATUS = 'pending'
const SENT_STATUS = 'sent'
const CANCELLED_STATUS = 'cancelled'
const FAILED_STATUS = 'failed'

type JobWithAlertData = {
  id: number
  title: string
  address: string
  jobType: string
  visitDate: Date | null
  startTime: string | null
  status: string
  customer: {
    name: string
    postcode: string | null
  } | null
  assignments: Array<{
    workerId: number
    worker: {
      id: number
      firstName: string | null
      lastName: string | null
      email: string | null
    }
  }>
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalisePostcode(value: unknown) {
  return clean(value).toUpperCase()
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

  if (fromDistrict && toDistrict && fromDistrict.area === toDistrict.area) {
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

function isQuoteJobType(jobType: string) {
  const value = clean(jobType).toLowerCase()
  return value === 'quote' || value === 'quoted'
}

function isTrevWorker(worker: {
  firstName: string | null
  lastName: string | null
  email: string | null
}) {
  const firstName = clean(worker.firstName).toLowerCase()
  const lastName = clean(worker.lastName).toLowerCase()
  const email = clean(worker.email).toLowerCase()

  const firstMatches = firstName === 'trevor' || firstName === 'trev'
  const lastMatches = lastName.includes('fudger')
  const emailMatches = email.includes('trevor.fudger')

  return (firstMatches && lastMatches) || emailMatches
}

function getTrevAlertPhones() {
  const raw = process.env.TREV_ALERT_PHONE || ''
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

function getJobPostcode(job: {
  address?: string | null
  customer?: { postcode?: string | null } | null
}) {
  return normalisePostcode(job.customer?.postcode)
}

function getLondonParts(date: Date) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
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

function parseLondonDateTimeToUtc(date: Date, hhmm: string) {
  const { year, month, day } = getLondonParts(date)
  const [hoursString, minutesString] = hhmm.split(':')
  const hours = Number(hoursString)
  const minutes = Number(minutesString)

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    throw new Error('Invalid HH:MM value')
  }

  const utcGuess = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), hours, minutes, 0))

  const londonAsUtc = new Date(
    utcGuess.toLocaleString('en-US', { timeZone: 'Europe/London' })
  )
  const diffMs = utcGuess.getTime() - londonAsUtc.getTime()

  return new Date(utcGuess.getTime() + diffMs)
}

function formatVisitForSms(date: Date, startTime: string) {
  const visitUtc = parseLondonDateTimeToUtc(date, startTime)

  const dateText = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(visitUtc)

  return `${dateText} at ${startTime}`
}

async function getJobForAlerts(jobId: number): Promise<JobWithAlertData | null> {
  return prisma.job.findUnique({
    where: { id: jobId },
    include: {
      customer: {
        select: {
          name: true,
          postcode: true,
        },
      },
      assignments: {
        include: {
          worker: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
    },
  }) as Promise<JobWithAlertData | null>
}

async function getPreviousTrevStopPostcode(job: JobWithAlertData) {
  const trevAssignment = job.assignments.find((assignment) => isTrevWorker(assignment.worker))
  if (!trevAssignment || !job.visitDate || !job.startTime) {
    return FARM_POSTCODE
  }

  const previousJob = await prisma.job.findFirst({
    where: {
      id: { not: job.id },
      visitDate: job.visitDate,
      status: {
        notIn: ['cancelled', 'archived', 'quoted', 'done', 'unscheduled'],
      },
      assignments: {
        some: {
          workerId: trevAssignment.workerId,
        },
      },
      startTime: {
        lt: job.startTime,
      },
    },
    orderBy: {
      startTime: 'desc',
    },
    include: {
      customer: {
        select: {
          postcode: true,
        },
      },
    },
  })

  if (!previousJob) return FARM_POSTCODE

  return normalisePostcode(previousJob.customer?.postcode) || FARM_POSTCODE
}

function shouldHaveAlerts(job: JobWithAlertData) {
  if (!isQuoteJobType(job.jobType)) return false
  if (!job.visitDate || !job.startTime) return false
  if (clean(job.status).toLowerCase() === 'cancelled') return false
  if (clean(job.status).toLowerCase() === 'archived') return false
  if (clean(job.status).toLowerCase() === 'quoted') return false

  return job.assignments.some((assignment) => isTrevWorker(assignment.worker))
}

async function cancelPendingAlertsForJob(jobId: number) {
  await prisma.notification.updateMany({
    where: {
      jobId,
      status: PENDING_STATUS,
      kind: {
        in: [ONE_HOUR_BEFORE_KIND, LEAVE_NOW_KIND],
      },
    },
    data: {
      status: CANCELLED_STATUS,
      failureReason: 'Superseded or no longer needed',
    },
  })
}

export async function syncJobAlerts(jobId: number) {
  const phones = getTrevAlertPhones()
  const job = await getJobForAlerts(jobId)

  if (!job) return

  await cancelPendingAlertsForJob(jobId)

  if (!shouldHaveAlerts(job)) return
  if (phones.length === 0) return

  const visitUtc = parseLondonDateTimeToUtc(job.visitDate as Date, job.startTime as string)
  const oneHourBeforeUtc = new Date(visitUtc.getTime() - 60 * 60 * 1000)

  const fromPostcode = await getPreviousTrevStopPostcode(job)
  const toPostcode = getJobPostcode(job)
  const travelMinutes = getTravelMinutes(fromPostcode, toPostcode)
  const leaveNowUtc = new Date(visitUtc.getTime() - travelMinutes * 60 * 1000)

  const customerName = clean(job.customer?.name) || clean(job.title) || 'quote visit'
  const destination = toPostcode || clean(job.address) || 'customer address'
  const visitText = formatVisitForSms(job.visitDate as Date, job.startTime as string)

  const records = phones.flatMap((phone) => [
    {
      jobId,
      kind: ONE_HOUR_BEFORE_KIND,
      channel: 'sms',
      recipientPhone: phone,
      scheduledFor: oneHourBeforeUtc,
      body: `Reminder: quote visit for ${customerName} is in 1 hour (${visitText}) at ${destination}.`,
      metaJson: JSON.stringify({
        kind: ONE_HOUR_BEFORE_KIND,
        travelMinutes,
        fromPostcode,
        toPostcode,
      }),
    },
    {
      jobId,
      kind: LEAVE_NOW_KIND,
      channel: 'sms',
      recipientPhone: phone,
      scheduledFor: leaveNowUtc,
      body: `Time to leave: quote visit for ${customerName} is at ${job.startTime}. Allow about ${travelMinutes} mins from ${fromPostcode} to ${destination}.`,
      metaJson: JSON.stringify({
        kind: LEAVE_NOW_KIND,
        travelMinutes,
        fromPostcode,
        toPostcode,
      }),
    },
  ])

  if (records.length > 0) {
    await prisma.notification.createMany({
      data: records,
    })
  }
}

export async function cancelJobAlerts(jobId: number) {
  await cancelPendingAlertsForJob(jobId)
}

async function sendSms(to: string, body: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_FROM_NUMBER

  if (!accountSid) throw new Error('Missing TWILIO_ACCOUNT_SID')
  if (!authToken) throw new Error('Missing TWILIO_AUTH_TOKEN')
  if (!fromNumber) throw new Error('Missing TWILIO_FROM_NUMBER')

  const form = new URLSearchParams()
  form.set('To', to)
  form.set('From', fromNumber)
  form.set('Body', body)

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    }
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Twilio send failed: ${response.status} ${text}`)
  }
}

export async function processDueAlerts(limit = 50) {
  const now = new Date()

  const due = await prisma.notification.findMany({
    where: {
      status: PENDING_STATUS,
      channel: 'sms',
      scheduledFor: {
        lte: now,
      },
      kind: {
        in: [ONE_HOUR_BEFORE_KIND, LEAVE_NOW_KIND],
      },
    },
    orderBy: {
      scheduledFor: 'asc',
    },
    take: limit,
  })

  let sent = 0
  let failed = 0

  for (const notification of due) {
    try {
      await sendSms(notification.recipientPhone, notification.body || 'Reminder')
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: SENT_STATUS,
          sentAt: new Date(),
          failureReason: null,
        },
      })
      sent += 1
    } catch (error) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: FAILED_STATUS,
          failureReason: error instanceof Error ? error.message : 'Unknown SMS failure',
        },
      })
      failed += 1
    }
  }

  return {
    ok: true,
    processed: due.length,
    sent,
    failed,
  }
}