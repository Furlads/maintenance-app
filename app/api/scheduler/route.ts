import { NextResponse } from 'next/server'
import { runAutoScheduler } from '@/lib/auto-scheduler'

export async function POST() {
  try {
    const result = await runAutoScheduler()

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('POST /api/scheduler failed:', error)

    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to run scheduler',
      },
      { status: 500 }
    )
  }
}