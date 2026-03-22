import { NextResponse } from 'next/server'
import * as prismaModule from '@/lib/prisma'
import { handleTimeOffApproval } from '@/lib/scheduling/handleTimeOffApproval'

const prisma = ((prismaModule as any).prisma ?? (prismaModule as any).default) as any

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

function safeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const requestId = Number(id)

    if (!requestId) {
      return NextResponse.json({ error: 'Invalid request id' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const reviewedByName = safeString(body?.reviewedByName) || 'Kelly'
    const reviewNotes = safeString(body?.reviewNotes)

    const timeOffRequest = await prisma.timeOffRequest.findUnique({
      where: { id: requestId }
    })

    if (!timeOffRequest) {
      return NextResponse.json({ error: 'Time off request not found' }, { status: 404 })
    }

    if (timeOffRequest.status === 'approved') {
      return NextResponse.json({
        ok: true,
        alreadyApproved: true
      })
    }

    const updatedRequest = await prisma.timeOffRequest.update({
      where: { id: requestId },
      data: {
        status: 'approved',
        reviewedByName,
        reviewNotes: reviewNotes || null,
        reviewedAt: new Date(),
        cancelledAt: null,
        cancellationNote: null
      }
    })

    const existingBlock = await prisma.workerAvailabilityBlock.findUnique({
      where: {
        requestId: updatedRequest.id
      }
    })

    let availabilityBlock = existingBlock

    if (!availabilityBlock) {
      availabilityBlock = await prisma.workerAvailabilityBlock.create({
        data: {
          workerId: updatedRequest.workerId,
          requestId: updatedRequest.id,
          source: 'time_off_request',
          title: updatedRequest.requestType,
          startDate: updatedRequest.startDate,
          endDate: updatedRequest.endDate,
          startTime: updatedRequest.startTime,
          endTime: updatedRequest.endTime,
          isFullDay: updatedRequest.isFullDay,
          notes: updatedRequest.reason || null,
          active: true
        }
      })
    } else if (!availabilityBlock.active) {
      availabilityBlock = await prisma.workerAvailabilityBlock.update({
        where: {
          id: availabilityBlock.id
        },
        data: {
          active: true,
          title: updatedRequest.requestType,
          startDate: updatedRequest.startDate,
          endDate: updatedRequest.endDate,
          startTime: updatedRequest.startTime,
          endTime: updatedRequest.endTime,
          isFullDay: updatedRequest.isFullDay,
          notes: updatedRequest.reason || null
        }
      })
    }

    const clashResult = await handleTimeOffApproval({
      workerId: updatedRequest.workerId,
      requestType: updatedRequest.requestType,
      requestedByName: reviewedByName,
      startDate: updatedRequest.startDate,
      endDate: updatedRequest.endDate,
      startTime: updatedRequest.startTime,
      endTime: updatedRequest.endTime,
      isFullDay: updatedRequest.isFullDay
    })

    return NextResponse.json({
      ok: true,
      requestId: updatedRequest.id,
      availabilityBlockId: availabilityBlock.id,
      conflictsFound: clashResult.conflictsFound,
      results: clashResult.results,
      clashError: clashResult.error
    })
  } catch (error) {
    console.error('POST /api/time-off/[id]/approve failed', error)
    return NextResponse.json({ error: 'Failed to approve request' }, { status: 500 })
  }
}