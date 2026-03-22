import { NextResponse } from 'next/server'
import * as prismaModule from '@/lib/prisma'

const prisma = ((prismaModule as any).prisma ?? (prismaModule as any).default) as any

type TimeOffBody = {
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

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as TimeOffBody

    const workerId = Number(body.workerId)
    const requestType = safeString(body.requestType) || 'Unavailable'
    const isFullDay = Boolean(body.isFullDay)
    const startDateText = safeString(body.startDate)
    const endDateText = safeString(body.endDate)
    const startTime = safeString(body.startTime)
    const endTime = safeString(body.endTime)
    const reason = safeString(body.reason)
    const requestedByName = safeString(body.requestedByName) || 'Trev'

    if (!workerId) {
      return NextResponse.json({ error: 'Missing workerId' }, { status: 400 })
    }

    if (!startDateText || !endDateText) {
      return NextResponse.json({ error: 'Missing start or end date' }, { status: 400 })
    }

    const startDate = new Date(`${startDateText}T00:00:00.000Z`)
    const endDate = new Date(`${endDateText}T00:00:00.000Z`)

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return NextResponse.json({ error: 'Invalid dates' }, { status: 400 })
    }

    if (endDate.getTime() < startDate.getTime()) {
      return NextResponse.json({ error: 'End date cannot be before start date' }, { status: 400 })
    }

    if (!isFullDay) {
      if (!startTime || !endTime) {
        return NextResponse.json({ error: 'Start and end times are required for timed blocks' }, { status: 400 })
      }

      if (endTime <= startTime) {
        return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 })
      }
    }

    const request = await prisma.timeOffRequest.create({
      data: {
        workerId,
        requestType,
        status: 'approved',
        startDate,
        endDate,
        startTime: isFullDay ? null : startTime,
        endTime: isFullDay ? null : endTime,
        isFullDay,
        reason: reason || null,
        requestedByName,
        reviewedByName: requestedByName,
        reviewedAt: new Date()
      }
    })

    const availabilityBlock = await prisma.workerAvailabilityBlock.create({
      data: {
        workerId,
        requestId: request.id,
        source: 'time_off_request',
        title: requestType,
        startDate,
        endDate,
        startTime: isFullDay ? null : startTime,
        endTime: isFullDay ? null : endTime,
        isFullDay,
        notes: reason || null,
        active: true
      }
    })

    return NextResponse.json({
      ok: true,
      requestId: request.id,
      availabilityBlockId: availabilityBlock.id
    })
  } catch (error) {
    console.error('POST /api/time-off/self failed', error)
    return NextResponse.json({ error: 'Failed to save blocked time' }, { status: 500 })
  }
}