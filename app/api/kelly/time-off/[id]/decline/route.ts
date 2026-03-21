import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { cleanString } from '@/lib/time-off'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const requestId = Number(id)

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return NextResponse.json({ ok: false, error: 'Invalid request id.' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const reviewedByName = cleanString(body.reviewedByName) || 'Kelly'
    const reviewNotes = cleanString(body.reviewNotes) || null

    const request = await prisma.timeOffRequest.findUnique({
      where: { id: requestId },
      include: {
        availabilityBlock: true,
      },
    })

    if (!request) {
      return NextResponse.json({ ok: false, error: 'Request not found.' }, { status: 404 })
    }

    if (request.status !== 'pending') {
      return NextResponse.json(
        { ok: false, error: 'Only pending requests can be declined.' },
        { status: 400 }
      )
    }

    const updated = await prisma.timeOffRequest.update({
      where: { id: requestId },
      data: {
        status: 'declined',
        reviewedByName,
        reviewNotes,
        reviewedAt: new Date(),
      },
    })

    if (request.availabilityBlock) {
      await prisma.workerAvailabilityBlock.update({
        where: { id: request.availabilityBlock.id },
        data: {
          active: false,
        },
      })
    }

    return NextResponse.json({
      ok: true,
      request: updated,
    })
  } catch (error) {
    console.error('POST /api/kelly/time-off/[id]/decline failed:', error)

    return NextResponse.json(
      { ok: false, error: 'Failed to decline request.' },
      { status: 500 }
    )
  }
}