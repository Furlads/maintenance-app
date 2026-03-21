import { NextResponse } from 'next/server'
import { refitWorkerDay } from '@/lib/repair-scheduler'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const workerId = Number(body.workerId)
    const rawDate = typeof body.date === 'string' ? body.date.trim() : ''

    if (!Number.isInteger(workerId) || workerId <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Valid workerId is required',
        },
        { status: 400 }
      )
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Valid date is required in YYYY-MM-DD format',
        },
        { status: 400 }
      )
    }

    const date = new Date(`${rawDate}T00:00:00.000Z`)
    if (Number.isNaN(date.getTime())) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Invalid date',
        },
        { status: 400 }
      )
    }

    const result = await refitWorkerDay({
      workerId,
      date,
    })

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('POST /api/scheduler/refit-worker-day failed:', error)

    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to re-fit worker day',
      },
      { status: 500 }
    )
  }
}