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
      daysToScan: 1,
    })

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 })
    }

    return NextResponse.json({
      ok: true,
      workerId: result.workerId,
      date: result.date,
      repaired: result.repaired,
      remaining: result.remaining,
      repairedJobIds: result.repairedJobIds,
      remainingJobIds: result.remainingJobIds,
      optimised: result.repaired > 0,
      travelMinutesSaved: 0,
      reorderedJobs: result.repaired,
      warning:
        result.remaining > 0
          ? `${result.remaining} job${result.remaining === 1 ? '' : 's'} could not be fitted back into this day.`
          : null,
      message:
        result.remaining > 0
          ? `Rebuilt this day. ${result.repaired} job${result.repaired === 1 ? '' : 's'} re-timed, but ${result.remaining} still would not fit into this day.`
          : `Rebuilt this day and updated ${result.repaired} job${result.repaired === 1 ? '' : 's'}.`,
    })
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