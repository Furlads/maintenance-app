import { NextResponse } from 'next/server'
import { runAutoScheduler } from '@/lib/auto-scheduler'

export async function POST() {
  try {
    const result = await runAutoScheduler()

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 })
    }

    return NextResponse.json({
      ok: true,
      scheduled: result.scheduled,
      optimisedDays: result.optimisedDays,
      travelMinutesSaved: result.travelMinutesSaved,
      message: result.message,
    })
  } catch (error) {
    console.error('POST /api/scheduler/run failed:', error)

    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to run scheduler',
        scheduled: 0,
        optimisedDays: 0,
        travelMinutesSaved: 0,
      },
      { status: 500 }
    )
  }
}