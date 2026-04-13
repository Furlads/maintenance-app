import { NextResponse } from 'next/server'
import * as prismaModule from '@/lib/prisma'

const prisma = ((prismaModule as any).prisma ?? (prismaModule as any).default) as any

type TimeOffRequestBody = {
  workerId?: number
  requestType?: string
  isFullDay?: boolean
  startDate?: string
  endDate?: string
  startTime?: string | null
  endTime?: string | null
  reason?: string
  requestedByName?: string
}

function safeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function isValidDateText(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function isValidTimeText(value: string) {
  return /^\d{2}:\d{2}$/.test(value)
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as TimeOffRequestBody

    const workerId = Number(body.workerId)
    const requestType = safeString(body.requestType) || 'holiday'
    const isFullDay = Boolean(body.isFullDay)
    const startDateText = safeString(body.startDate)
    const endDateText = safeString(body.endDate)
    const startTime = safeString(body.startTime)
    const endTime = safeString(body.endTime)
    const reason = safeString(body.reason)
    const requestedByName = safeString(body.requestedByName) || null

    if (!workerId) {
      return NextResponse.json({ error: 'Missing workerId' }, { status: 400 })
    }

    if (!startDateText || !endDateText) {
      return NextResponse.json({ error: 'Missing start or end date' }, { status: 400 })
    }

    if (!isValidDateText(startDateText) || !isValidDateText(endDateText)) {
      return NextResponse.json(
        { error: 'Dates must be in YYYY-MM-DD format' },
        { status: 400 }
      )
    }

    const startDate = new Date(`${startDateText}T00:00:00.000Z`)
    const endDate = new Date(`${endDateText}T00:00:00.000Z`)

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return NextResponse.json({ error: 'Invalid dates' }, { status: 400 })
    }

    if (endDate.getTime() < startDate.getTime()) {
      return NextResponse.json(
        { error: 'End date cannot be before start date' },
        { status: 400 }
      )
    }

    if (!isFullDay) {
      if (!startTime || !endTime) {
        return NextResponse.json(
          { error: 'Start and end times are required for part-day requests' },
          { status: 400 }
        )
      }

      if (!isValidTimeText(startTime) || !isValidTimeText(endTime)) {
        return NextResponse.json(
          { error: 'Times must be in HH:mm format' },
          { status: 400 }
        )
      }

      if (endTime <= startTime) {
        return NextResponse.json(
          { error: 'End time must be after start time' },
          { status: 400 }
        )
      }
    }

    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        active: true,
      },
    })

    if (!worker) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 })
    }

    const created = await prisma.timeOffRequest.create({
      data: {
        workerId,
        requestType,
        status: 'pending',
        startDate,
        endDate,
        startTime: isFullDay ? null : startTime,
        endTime: isFullDay ? null : endTime,
        isFullDay,
        reason: reason || null,
        requestedByName:
          requestedByName ||
          `${worker.firstName || ''} ${worker.lastName || ''}`.trim() ||
          null,
        reviewedByName: null,
        reviewNotes: null,
        reviewedAt: null,
        cancelledAt: null,
        cancellationNote: null,
      },
    })

    return NextResponse.json({
      ok: true,
      request: {
        id: created.id,
        status: created.status,
      },
    })
  } catch (error) {
    console.error('POST /api/time-off/request failed', error)
    return NextResponse.json(
      { error: 'Failed to send request' },
      { status: 500 }
    )
  }
}