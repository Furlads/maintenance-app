export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>))

    const workerId = Number(body.workerId)
    const endpoint = clean(body.endpoint)
    const p256dh = clean(body.p256dh)
    const auth = clean(body.auth)
    const userAgent = clean(body.userAgent)

    if (!Number.isInteger(workerId) || workerId <= 0) {
      return NextResponse.json({ error: 'Valid workerId is required' }, { status: 400 })
    }

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { error: 'endpoint, p256dh and auth are required' },
        { status: 400 }
      )
    }

    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
      select: { id: true },
    })

    if (!worker) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 })
    }

    const saved = await prisma.pushSubscription.upsert({
      where: {
        workerId_endpoint: {
          workerId,
          endpoint,
        },
      },
      create: {
        workerId,
        endpoint,
        p256dh,
        auth,
        userAgent: userAgent || null,
        active: true,
      },
      update: {
        p256dh,
        auth,
        userAgent: userAgent || null,
        active: true,
      },
    })

    return NextResponse.json({ ok: true, subscription: saved })
  } catch (error) {
    console.error('POST /api/push/subscribe failed:', error)

    return NextResponse.json(
      { error: 'Failed to save push subscription' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const workerId = Number(body.workerId)
    const endpoint = clean(body.endpoint)

    if (!Number.isInteger(workerId) || workerId <= 0 || !endpoint) {
      return NextResponse.json(
        { error: 'workerId and endpoint are required' },
        { status: 400 }
      )
    }

    await prisma.pushSubscription.updateMany({
      where: {
        workerId,
        endpoint,
      },
      data: {
        active: false,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/push/subscribe failed:', error)

    return NextResponse.json(
      { error: 'Failed to deactivate push subscription' },
      { status: 500 }
    )
  }
}