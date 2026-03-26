import { NextResponse } from 'next/server'
import { runLocalWorkerDayRepair } from '@/lib/auto-scheduler'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))

    const workerId = Number(body.workerId)
    const dateValue = typeof body.date === 'string' ? body.date : ''
    const date = dateValue ? new Date(dateValue) : null

    if (!Number.isInteger(workerId) || workerId <= 0) {
      return NextResponse.json(
        { ok: false, error: 'Invalid workerId.' },
        { status: 400 }
      )
    }

    if (!date || Number.isNaN(date.getTime())) {
      return NextResponse.json(
        { ok: false, error: 'Invalid date.' },
        { status: 400 }
      )
    }

    const result = await runLocalWorkerDayRepair({
      workerId,
      date,
      reason: 'manual',
    })

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('POST /api/scheduler/optimise-day failed:', error)

    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to optimise worker day',
      },
      { status: 500 }
    )
  }
}