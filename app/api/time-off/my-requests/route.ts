import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const workerId = Number(searchParams.get('workerId'))

    if (!Number.isInteger(workerId) || workerId <= 0) {
      return NextResponse.json({ ok: false, error: 'Valid workerId is required.' }, { status: 400 })
    }

    const requests = await prisma.timeOffRequest.findMany({
      where: {
        workerId,
      },
      orderBy: [
        { createdAt: 'desc' },
        { startDate: 'desc' },
      ],
    })

    return NextResponse.json({
      ok: true,
      requests,
    })
  } catch (error) {
    console.error('GET /api/time-off/my-requests failed:', error)

    return NextResponse.json(
      { ok: false, error: 'Failed to load requests.' },
      { status: 500 }
    )
  }
}