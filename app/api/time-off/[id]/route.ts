import { NextResponse } from 'next/server'
import * as prismaModule from '@/lib/prisma'

const prisma = ((prismaModule as any).prisma ?? (prismaModule as any).default) as any

type RouteParams = {
  params: {
    id: string
  }
}

type UpdateBody = {
  workerId?: number
  requestType?: string
  isFullDay?: boolean
  startDate?: string
  endDate?: string
  startTime?: string | null
  endTime?: string | null
  reason?: string
}

function safeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normaliseDateText(value: string) {
  const clean = value.trim()

  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean
  }

  const parsed = new Date(clean)

  if (!Number.isNaN(parsed.getTime())) {
    const yyyy = parsed.getFullYear()
    const mm = String(parsed.getMonth() + 1).padStart(2, '0')
    const dd = String(parsed.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  return ''
}

function isValidTimeText(value: string) {
  return /^\d{2}:\d{2}$/.test(value)
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const id = Number(params.id)
    const body = (await req.json()) as UpdateBody

    const workerId = Number(body.workerId)
    const requestType = safeString(body.requestType) || 'holiday'
    const isFullDay = Boolean(body.isFullDay)
    const startDateText = normaliseDateText(safeString(body.startDate))
    const endDateText = normaliseDateText(safeString(body.endDate))
    const startTime = safeString(body.startTime)
    const endTime = safeString(body.endTime)
    const reason = safeString(body.reason)

    if (!id) {
      return NextResponse.json({ error: 'Missing request id' }, { status: 400 })
    }

    if (!workerId) {
      return NextResponse.json({ error: 'Missing workerId' }, { status: 400 })
    }

    if (!startDateText || !endDateText) {
      return NextResponse.json({ error: 'Missing or invalid start/end date' }, { status: 400 })
    }

    const existing = await prisma.timeOffRequest.findFirst({
      where: {
        id,
        workerId,
      },
      select: {
        id: true,
        status: true,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    if (existing.status !== 'pending') {
      return NextResponse.json(
        { error: 'Only pending requests can be edited' },
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

    const updated = await prisma.timeOffRequest.update({
      where: {
        id,
      },
      data: {
        requestType,
        startDate,
        endDate,
        startTime: isFullDay ? null : startTime,
        endTime: isFullDay ? null : endTime,
        isFullDay,
        reason: reason || null,
      },
    })

    return NextResponse.json({
      ok: true,
      request: {
        id: updated.id,
        status: updated.status,
      },
    })
  } catch (error) {
    console.error('PATCH /api/time-off/[id] failed', error)

    return NextResponse.json(
      { error: 'Failed to update request' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const id = Number(params.id)
    const { searchParams } = new URL(req.url)
    const workerId = Number(searchParams.get('workerId'))

    if (!id) {
      return NextResponse.json({ error: 'Missing request id' }, { status: 400 })
    }

    if (!workerId) {
      return NextResponse.json({ error: 'Missing workerId' }, { status: 400 })
    }

    const existing = await prisma.timeOffRequest.findFirst({
      where: {
        id,
        workerId,
      },
      select: {
        id: true,
        status: true,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    if (existing.status !== 'pending') {
      return NextResponse.json(
        { error: 'Only pending requests can be cancelled' },
        { status: 400 }
      )
    }

    const updated = await prisma.timeOffRequest.update({
      where: {
        id,
      },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationNote: 'Cancelled by worker',
      },
    })

    return NextResponse.json({
      ok: true,
      request: {
        id: updated.id,
        status: updated.status,
      },
    })
  } catch (error) {
    console.error('DELETE /api/time-off/[id] failed', error)

    return NextResponse.json(
      { error: 'Failed to cancel request' },
      { status: 500 }
    )
  }
}