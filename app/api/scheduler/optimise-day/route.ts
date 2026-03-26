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
        {
          ok: false,
          error: 'Invalid workerId.',
        },
        { status: 400 }
      )
    }

    if (!date || Number.isNaN(date.getTime())) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Invalid date.',
        },
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

    return NextResponse.json({
      ok: true,
      workerId: result.workerId,
      date: result.date,
      repaired: result.repaired,
      remaining: result.remaining,
      unplacedJobIds: result.unplacedJobIds,
      optimised: result.optimised ?? false,
      travelMinutesSaved: result.travelMinutesSaved ?? 0,
      reorderedJobs: result.reorderedJobs ?? 0,
      warning: result.warning ?? null,
      message:
        result.message ||
        (result.optimised
          ? `Saved ${result.travelMinutesSaved ?? 0} mins travel by reordering ${
              result.reorderedJobs ?? 0
            } job${(result.reorderedJobs ?? 0) === 1 ? '' : 's'}.`
          : 'No better route found for this worker/day.'),
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