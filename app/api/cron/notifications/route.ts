export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import {
  addDays,
  addMinutes,
  buildQuoteCreatedSms,
  buildQuoteFollowUpSms,
  buildTrevAppointmentSms,
  dispatchNotification,
  findTrevWorkerIds,
  formatLondonDateTime,
  getKellyAlertPhones,
  getTrevAlertPhones,
  isQuoteJobType,
  londonLocalDateTimeToUtc,
} from '@/lib/notifications'

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function isCronAuthorized(req: Request) {
  const auth = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET?.trim()

  if (cronSecret && auth === `Bearer ${cronSecret}`) {
    return true
  }

  if (req.headers.get('x-vercel-cron') === '1') {
    return true
  }

  return process.env.NODE_ENV !== 'production'
}

async function ensureNotification(args: {
  dedupeKey: string
  type: string
  channel: 'sms' | 'push'
  title: string
  message: string
  scheduledFor: Date
  relatedJobId?: number
  recipientPhone?: string
  recipientWorkerId?: number
  responseRequired?: boolean
  responseOptionsJson?: string
  metadataJson?: string
}) {
  const existing = await prisma.notification.findUnique({
    where: { dedupeKey: args.dedupeKey },
  })

  if (!existing) {
    return prisma.notification.create({
      data: {
        dedupeKey: args.dedupeKey,
        type: args.type,
        channel: args.channel,
        title: args.title,
        message: args.message,
        scheduledFor: args.scheduledFor,
        relatedJobId: args.relatedJobId,
        recipientPhone: args.recipientPhone ?? null,
        recipientWorkerId: args.recipientWorkerId ?? null,
        responseRequired: args.responseRequired ?? false,
        responseOptionsJson: args.responseOptionsJson ?? null,
        metadataJson: args.metadataJson ?? null,
      },
    })
  }

  if (existing.status === 'sent') {
    return existing
  }

  return prisma.notification.update({
    where: { id: existing.id },
    data: {
      title: args.title,
      message: args.message,
      scheduledFor: args.scheduledFor,
      relatedJobId: args.relatedJobId,
      recipientPhone: args.recipientPhone ?? null,
      recipientWorkerId: args.recipientWorkerId ?? null,
      responseRequired: args.responseRequired ?? false,
      responseOptionsJson: args.responseOptionsJson ?? null,
      metadataJson: args.metadataJson ?? null,
      failureReason: null,
      failedAt: null,
      status: existing.responseValue ? existing.status : 'pending',
    },
  })
}

async function buildCandidates() {
  const now = new Date()
  const trevWorkerIds = await findTrevWorkerIds()

  const jobs = await prisma.job.findMany({
    where: {
      status: {
        notIn: ['cancelled', 'archived'],
      },
    },
    include: {
      customer: true,
      assignments: {
        include: {
          worker: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  for (const job of jobs) {
    const isQuote = isQuoteJobType(job.jobType)

    if (isQuote) {
      const quoteCreatedBody = buildQuoteCreatedSms(job)

      for (const phone of [...getTrevAlertPhones(), ...getKellyAlertPhones()]) {
        await ensureNotification({
          dedupeKey: `quote-created-${job.id}-${phone}`,
          type: 'quote_created',
          channel: 'sms',
          title: 'New quote added',
          message: quoteCreatedBody,
          scheduledFor: job.createdAt,
          relatedJobId: job.id,
          recipientPhone: phone,
        })
      }

      const followUpAt =
        job.quoteFollowUpAt ??
        (() => {
          const threeDaysLater = addDays(job.createdAt, 3)
          const londonDate = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Europe/London',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(threeDaysLater)

          return londonLocalDateTimeToUtc(new Date(`${londonDate}T00:00:00.000Z`), '09:00')
        })()

      const followUpBody = buildQuoteFollowUpSms(job)

      for (const phone of [...getTrevAlertPhones(), ...getKellyAlertPhones()]) {
        await ensureNotification({
          dedupeKey: `quote-follow-up-${job.id}-${phone}`,
          type: 'quote_follow_up',
          channel: 'sms',
          title: 'Quote follow-up due',
          message: followUpBody,
          scheduledFor: followUpAt,
          relatedJobId: job.id,
          recipientPhone: phone,
        })
      }

      const assignedToTrev = job.assignments.some((assignment) =>
        trevWorkerIds.includes(assignment.workerId)
      )

      if (assignedToTrev && job.visitDate && clean(job.startTime)) {
        const appointmentAt = londonLocalDateTimeToUtc(job.visitDate, job.startTime as string)

        for (const minutesBefore of [60, 30] as const) {
          const scheduledFor = addMinutes(appointmentAt, -minutesBefore)

          for (const phone of getTrevAlertPhones()) {
            await ensureNotification({
              dedupeKey: `trev-appt-${minutesBefore}-${job.id}-${phone}`,
              type: `trev_appointment_${minutesBefore}`,
              channel: 'sms',
              title: `Trev appointment in ${minutesBefore} mins`,
              message: buildTrevAppointmentSms(job, minutesBefore),
              scheduledFor,
              relatedJobId: job.id,
              recipientPhone: phone,
            })
          }
        }
      }
    }

    if (job.visitDate && clean(job.startTime) && (job.durationMinutes ?? 0) > 0) {
      const assignedWorkers = job.assignments.filter(
        (assignment) => !trevWorkerIds.includes(assignment.workerId)
      )

      if (assignedWorkers.length > 0) {
        const startAt = londonLocalDateTimeToUtc(job.visitDate, job.startTime as string)
        const finishAt = addMinutes(
          startAt,
          (job.durationMinutes ?? 60) + (job.overrunMins ?? 0)
        )
        const promptAt = addMinutes(finishAt, -15)

        const actionOptions = JSON.stringify([
          { action: 'on_time', title: 'On time' },
          { action: 'need_15', title: 'Need 15 more mins' },
          { action: 'need_30', title: 'Need 30 more mins' },
          { action: 'problem', title: 'Problem on site' },
        ])

        for (const assignment of assignedWorkers) {
          await ensureNotification({
            dedupeKey: `worker-time-check-${job.id}-${assignment.workerId}`,
            type: 'worker_time_check',
            channel: 'push',
            title: '15 minutes left on this job',
            message: `You have 15 minutes left on ${job.customer?.name || job.title}. Are you on track to finish on time?`,
            scheduledFor: promptAt,
            relatedJobId: job.id,
            recipientWorkerId: assignment.workerId,
            responseRequired: true,
            responseOptionsJson: actionOptions,
            metadataJson: JSON.stringify({
              kind: 'worker_time_check',
              jobId: job.id,
              jobTitle: job.title,
              scheduledFinish: formatLondonDateTime(finishAt),
            }),
          })
        }
      }
    }
  }

  return {
    ok: true,
    checkedAt: now.toISOString(),
    jobsScanned: jobs.length,
  }
}

async function sendDueNotifications() {
  const due = await prisma.notification.findMany({
    where: {
      status: 'pending',
      scheduledFor: {
        lte: new Date(),
      },
    },
    orderBy: {
      scheduledFor: 'asc',
    },
    take: 100,
  })

  let sent = 0
  let failed = 0

  for (const notification of due) {
    const result = await dispatchNotification(notification.id)
    if (result.ok) {
      sent += 1
    } else {
      failed += 1
    }
  }

  return {
    totalDue: due.length,
    sent,
    failed,
  }
}

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const candidateResult = await buildCandidates()
    const dispatchResult = await sendDueNotifications()

    return NextResponse.json({
      ok: true,
      candidateResult,
      dispatchResult,
      ranAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('GET /api/cron/notifications failed:', error)

    return NextResponse.json(
      {
        error: 'Failed to process notifications',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}