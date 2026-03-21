import { NextResponse } from 'next/server'
import { refitSingleAssignedJob } from '@/lib/repair-scheduler'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const jobId = Number(body.jobId)

    if (!Number.isInteger(jobId) || jobId <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Valid jobId is required',
        },
        { status: 400 }
      )
    }

    const result = await refitSingleAssignedJob({ jobId })

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('POST /api/scheduler/refit-job failed:', error)

    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to re-fit job',
      },
      { status: 500 }
    )
  }
}