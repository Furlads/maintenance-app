import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const status = (searchParams.get('status') || 'all').trim().toLowerCase()

    const where =
      status === 'all'
        ? {}
        : {
            status,
          }

    const requests = await prisma.timeOffRequest.findMany({
      where,
      include: {
        worker: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            active: true,
          },
        },
        availabilityBlock: true,
      },
      orderBy: [
        { status: 'asc' },
        { createdAt: 'desc' },
      ],
    })

    return NextResponse.json({
      ok: true,
      requests,
    })
  } catch (error) {
    console.error('GET /api/kelly/time-off failed:', error)

    return NextResponse.json(
      { ok: false, error: 'Failed to load time off requests.' },
      { status: 500 }
    )
  }
}