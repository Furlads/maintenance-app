import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import {
  requestTypeLabel,
  unscheduleImpactedJobsForApprovedBlock,
  cleanString,
} from '@/lib/time-off'
import { runAutoScheduler } from '@/lib/auto-scheduler'

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
        worker: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        availabilityBlock: true,
      },
    })

    if (!request) {
      return NextResponse.json({ ok: false, error: 'Request not found.' }, { status: 404 })
    }

    if (request.status !== 'pending') {
      return NextResponse.json(
        { ok: false, error: 'Only pending requests can be approved.' },
        { status: 400 }
      )
    }

    const updatedRequest = await prisma.timeOffRequest.update({
      where: { id: requestId },
      data: {
        status: 'approved',
        reviewedByName,
        reviewNotes,
        reviewedAt: new Date(),
      },
    })

    const block =
      request.availabilityBlock ??
      (await prisma.workerAvailabilityBlock.create({
        data: {
          workerId: request.workerId,
          requestId: request.id,
          source: 'time_off_request',
          title: requestTypeLabel(request.requestType),
          startDate: request.startDate,
          endDate: request.endDate,
          startTime: request.isFullDay ? null : request.startTime,
          endTime: request.isFullDay ? null : request.endTime,
          isFullDay: request.isFullDay,
          notes: request.reason,
          active: true,
        },
      }))

    if (request.availabilityBlock) {
      await prisma.workerAvailabilityBlock.update({
        where: { id: request.availabilityBlock.id },
        data: {
          active: true,
          title: requestTypeLabel(request.requestType),
          startDate: request.startDate,
          endDate: request.endDate,
          startTime: request.isFullDay ? null : request.startTime,
          endTime: request.isFullDay ? null : request.endTime,
          isFullDay: request.isFullDay,
          notes: request.reason,
        },
      })
    }

    const impactedJobIds = await unscheduleImpactedJobsForApprovedBlock({
      workerId: request.workerId,
      block: {
        startDate: block.startDate,
        endDate: block.endDate,
        startTime: block.startTime,
        endTime: block.endTime,
        isFullDay: block.isFullDay,
      },
    })

    const schedulerResult = await runAutoScheduler()

    return NextResponse.json({
      ok: true,
      request: updatedRequest,
      impactedJobIds,
      schedulerResult,
    })
  } catch (error) {
    console.error('POST /api/kelly/time-off/[id]/approve failed:', error)

    return NextResponse.json(
      { ok: false, error: 'Failed to approve request.' },
      { status: 500 }
    )
  }
}