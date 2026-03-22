import prisma from '@/lib/prisma'
import { sendSms } from '@/lib/sms'
import { sendPushNotification } from '@/lib/push'

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function isQuoteJobType(jobType: string | null | undefined) {
  const value = clean(jobType).toLowerCase()
  return value === 'quote' || value === 'quoted'
}

export function londonDateOnlyString(date: Date) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  return formatter.format(date)
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    timeZoneName: 'shortOffset',
    hour: '2-digit',
    minute: '2-digit',
  })

  const parts = formatter.formatToParts(date)
  const zone = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT'

  if (zone === 'GMT' || zone === 'UTC') return 0

  const match = zone.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/)
  if (!match) return 0

  const sign = match[1] === '-' ? -1 : 1
  const hours = Number(match[2] ?? '0')
  const minutes = Number(match[3] ?? '0')

  return sign * (hours * 60 + minutes)
}

export function londonLocalDateTimeToUtc(date: Date, hhmm: string) {
  const dateOnly = londonDateOnlyString(date)
  const [year, month, day] = dateOnly.split('-').map(Number)
  const [hours, minutes] = hhmm.split(':').map(Number)

  const utcGuess = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0))
  const offset = getTimeZoneOffsetMinutes(utcGuess, 'Europe/London')

  return new Date(utcGuess.getTime() - offset * 60_000)
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000)
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60_000)
}

export function formatLondonDateTime(date: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function formatPhoneList(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function getTrevAlertPhones() {
  return formatPhoneList(process.env.TREV_ALERT_PHONE)
}

export function getKellyAlertPhones() {
  return formatPhoneList(process.env.KELLY_ALERT_PHONE)
}

export async function findTrevWorkerIds() {
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
      const first = clean(worker.firstName).toLowerCase()
      const last = clean(worker.lastName).toLowerCase()
      const email = clean(worker.email).toLowerCase()

      const firstMatches = first === 'trevor' || first === 'trev'
      const lastMatches = last.includes('fudger')
      const emailMatches = email.includes('trevor.fudger')

      return (firstMatches && lastMatches) || emailMatches
    })
    .map((worker) => worker.id)
}

export function buildJobSummary(job: {
  title: string
  address: string
  notes: string | null
  jobType: string
  customer?: {
    name: string
    postcode: string | null
  } | null
}) {
  const customerName = clean(job.customer?.name) || clean(job.title) || 'Customer'
  const addressLine = [clean(job.address), clean(job.customer?.postcode)]
    .filter(Boolean)
    .join(', ')
  const scope = clean(job.jobType) || 'Quote'
  const notes = clean(job.notes)

  return {
    customerName,
    addressLine,
    scope,
    notes,
  }
}

export function buildQuoteCreatedSms(job: {
  title: string
  address: string
  notes: string | null
  jobType: string
  customer?: { name: string; postcode: string | null } | null
}) {
  const summary = buildJobSummary(job)

  return [
    'Furlads: new quote added.',
    `Customer: ${summary.customerName}`,
    `Where: ${summary.addressLine || 'No address saved'}`,
    `Work: ${summary.scope}`,
    summary.notes ? `Notes: ${summary.notes}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

export function buildQuoteFollowUpSms(job: {
  title: string
  address: string
  notes: string | null
  jobType: string
  customer?: { name: string; postcode: string | null } | null
}) {
  const summary = buildJobSummary(job)

  return [
    'Furlads reminder: quote follow-up due today.',
    `Customer: ${summary.customerName}`,
    `Where: ${summary.addressLine || 'No address saved'}`,
    `Work: ${summary.scope}`,
    summary.notes ? `Notes: ${summary.notes}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

export function buildTrevAppointmentSms(
  job: {
    title: string
    address: string
    notes: string | null
    jobType: string
    customer?: { name: string; postcode: string | null } | null
  },
  minutesBefore: 60 | 30
) {
  const summary = buildJobSummary(job)

  return [
    `Furlads reminder: quote visit in ${minutesBefore} mins.`,
    `Customer: ${summary.customerName}`,
    `Where: ${summary.addressLine || 'No address saved'}`,
    `Work: ${summary.scope}`,
    summary.notes ? `Notes: ${summary.notes}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

export function buildWorkerOverrunSms(args: {
  workerName: string
  response: string
  job: {
    title: string
    address: string
    notes: string | null
    jobType: string
    customer?: { name: string; postcode: string | null } | null
  }
}) {
  const summary = buildJobSummary(args.job)

  const responseText =
    args.response === 'need_15'
      ? 'needs 15 more mins'
      : args.response === 'need_30'
        ? 'needs 30 more mins'
        : 'reported a problem on site'

  return [
    `Furlads alert: ${args.workerName} ${responseText}.`,
    `Customer: ${summary.customerName}`,
    `Where: ${summary.addressLine || 'No address saved'}`,
    `Work: ${summary.scope}`,
    summary.notes ? `Notes: ${summary.notes}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

export async function dispatchNotification(notificationId: number) {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    include: {
      recipientWorker: true,
      relatedJob: {
        include: {
          customer: true,
        },
      },
    },
  })

  if (!notification) {
    throw new Error(`Notification ${notificationId} not found`)
  }

  if (notification.status === 'sent') {
    return { ok: true, skipped: true }
  }

  if (notification.channel === 'sms') {
    if (!notification.recipientPhone) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: 'failed',
          failedAt: new Date(),
          failureReason: 'No recipientPhone on SMS notification',
        },
      })

      return { ok: false }
    }

    try {
      await sendSms({
        to: notification.recipientPhone,
        body: notification.message,
      })

      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: 'sent',
          sentAt: new Date(),
          failedAt: null,
          failureReason: null,
        },
      })

      return { ok: true }
    } catch (error) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: 'failed',
          failedAt: new Date(),
          failureReason:
            error instanceof Error ? error.message.slice(0, 500) : 'SMS send failed',
        },
      })

      return { ok: false }
    }
  }

  if (notification.channel === 'push') {
    if (!notification.recipientWorkerId) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: 'failed',
          failedAt: new Date(),
          failureReason: 'No recipientWorkerId on push notification',
        },
      })

      return { ok: false }
    }

    const subscriptions = await prisma.pushSubscription.findMany({
      where: {
        workerId: notification.recipientWorkerId,
        active: true,
      },
    })

    if (subscriptions.length === 0) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: 'failed',
          failedAt: new Date(),
          failureReason: 'No active push subscriptions for worker',
        },
      })

      return { ok: false }
    }

    const parsedActions = (() => {
      try {
        const raw = JSON.parse(notification.responseOptionsJson ?? '[]')
        if (!Array.isArray(raw)) return []
        return raw
          .map((item) => ({
            action: clean(item?.action),
            title: clean(item?.title),
          }))
          .filter((item) => item.action && item.title)
      } catch {
        return []
      }
    })()

    let successCount = 0

    for (const subscription of subscriptions) {
      try {
        await sendPushNotification(
          {
            endpoint: subscription.endpoint,
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
          {
            title: notification.title,
            body: notification.message,
            url: '/today',
            notificationId: notification.id,
            actions: parsedActions,
          }
        )

        successCount += 1
      } catch (error: unknown) {
        const statusCode =
          typeof error === 'object' &&
          error !== null &&
          'statusCode' in error &&
          typeof (error as { statusCode?: unknown }).statusCode === 'number'
            ? (error as { statusCode: number }).statusCode
            : undefined

        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.update({
            where: { id: subscription.id },
            data: { active: false },
          })
        }
      }
    }

    if (successCount > 0) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: 'sent',
          sentAt: new Date(),
          failedAt: null,
          failureReason: null,
        },
      })

      return { ok: true }
    }

    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: 'failed',
        failedAt: new Date(),
        failureReason: 'All push deliveries failed',
      },
    })

    return { ok: false }
  }

  await prisma.notification.update({
    where: { id: notification.id },
    data: {
      status: 'failed',
      failedAt: new Date(),
      failureReason: `Unsupported channel: ${notification.channel}`,
    },
  })

  return { ok: false }
}