import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)

    const workerId = Number(body?.workerId)
    const pin = String(body?.pin || '').trim()

    if (!Number.isFinite(workerId) || workerId <= 0) {
      return NextResponse.json(
        { ok: false, error: 'Invalid worker.' },
        { status: 400 }
      )
    }

    if (!pin) {
      return NextResponse.json(
        { ok: false, error: 'PIN is required.' },
        { status: 400 }
      )
    }

    const worker = await prisma.worker.findUnique({
      where: {
        id: workerId
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        active: true,
        pinHash: true
      }
    })

    if (!worker || !worker.active) {
      return NextResponse.json(
        { ok: false, error: 'Worker not found.' },
        { status: 404 }
      )
    }

    if (!worker.pinHash) {
      return NextResponse.json(
        { ok: false, error: 'PIN has not been set for this worker yet.' },
        { status: 400 }
      )
    }

    const pinOk = worker.pinHash === pin

    if (!pinOk) {
      return NextResponse.json(
        { ok: false, error: 'Incorrect PIN.' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      ok: true,
      worker: {
        id: worker.id,
        name: `${worker.firstName} ${worker.lastName}`.trim()
      }
    })
  } catch (error) {
    console.error('PIN LOGIN ERROR:', error)

    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to verify PIN.'
      },
      { status: 500 }
    )
  }
}