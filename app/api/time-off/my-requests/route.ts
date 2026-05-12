import { NextResponse } from 'next/server'
import * as prismaModule from '@/lib/prisma'

const prisma = ((prismaModule as any).prisma ?? (prismaModule as any).default) as any

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)

    const workerId = Number(searchParams.get('workerId'))

    if (!workerId) {
      return NextResponse.json(
        { error: 'Missing workerId' },
        { status: 400 }
      )
    }

    const requests = await prisma.timeOffRequest.findMany({
      where: {
        workerId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        requestType: true,
        status: true,
        startDate: true,
        endDate: true,
        startTime: true,
        endTime: true,
        isFullDay: true,
        reason: true,
        reviewedByName: true,
        reviewNotes: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      ok: true,
      requests,
    })
  } catch (error) {
    console.error(
      'GET /api/time-off/my-requests failed',
      error
    )

    return NextResponse.json(
      {
        error: 'Failed to load requests',
      },
      { status: 500 }
    )
  }
}