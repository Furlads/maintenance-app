export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import {
  buildWorkerOverrunSms,
  dispatchNotification,
  getKellyAlertPhones,
  getTrevAlertPhones,
} from '@/lib/notifications'

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

const ALLOWED_RESPONSES = new Set(['on_time', 'need_15', 'need_30', 'problem'])

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const notificationId = Number(body.notificationId)
    const response = clean(body.response)

    if (!Number.isInteger(notificationId) || notificationId <= 0) {
      return NextResponse.json(
        { error: 'Valid notificationId is required' },
        { status: 400 }
      )
    }

    if (!ALLOWED_RESPONSES.has(response)) {
      return NextResponse.json(
        { error: 'Invalid response value' },
        { status: 400 }
      )
    }

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
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: {
        responseValue: response,
        responseAt: new Date(),
      },
    })

    if (!notification.relatedJob || !notification.recipientWorker) {
      return NextResponse.json({ ok: true, notification: updated })
    }

    if (response === 'need_15' || response === 'need_30') {
      const overrun = response === 'need_15' ? 15 : 30

      await prisma.job.update({
        where: { id: notification.relatedJob.id },
        data: {
          overrunMins: Math.max(notification.relatedJob.overrunMins ?? 0, overrun),
        },
      })
    }

    if (response === 'need_15' || response === 'need_30' || response === 'problem') {
      const smsBody = buildWorkerOverrunSms({
        workerName: `${notification.recipientWorker.firstName} ${notification.recipientWorker.lastName}`.trim(),
        response,
        job: notification.relatedJob,
      })

      const phones = [...getTrevAlertPhones(), ...getKellyAlertPhones()]

      for (const phone of phones) {
        const created = await prisma.notification.create({
          data: {
            type: 'worker_response_alert',
            channel: 'sms',
            status: 'pending',
            title: 'Worker alert',
            message: smsBody,
            scheduledFor: new Date(),
            dedupeKey: `worker-response-${notification.id}-${response}-${phone}`,
            relatedJobId: notification.relatedJob.id,
            recipientPhone: phone,
          },
        })

        await dispatchNotification(created.id)
      }
    }

    return NextResponse.json({ ok: true, notification: updated })
  } catch (error) {
    console.error('POST /api/notifications/respond failed:', error)

    return NextResponse.json(
      { error: 'Failed to record notification response' },
      { status: 500 }
    )
  }
}