import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import {
  cleanString,
  requestTypeLabel,
  unscheduleImpactedJobsForApprovedBlock,
} from '@/lib/time-off'
import { runAutoScheduler } from '@/lib/auto-scheduler'

type Ctx = { params: Promise<{ id: string }> }

function isAdminRole(role: string | null | undefined) {
  return ['admin', 'office', 'manager', 'owner'].includes(cleanString(role).toLowerCase())
}

function dateValue(value: unknown) {
  const clean = cleanString(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return null
  const date = new Date(`${clean}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

function validTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthenticated.' }, { status: 401 })
    }
    if (!isAdminRole(session.role)) {
      return NextResponse.json({ ok: false, error: 'Forbidden.' }, { status: 403 })
    }

    const { id } = await ctx.params
    const requestId = Number(id)
    const body = await req.json().catch(() => ({}))
    const workerId = Number(body.workerId)
    const requestType = cleanString(body.requestType) || 'holiday'
    const isFullDay = Boolean(body.isFullDay)
    const startDate = dateValue(body.startDate)
    const endDate = dateValue(body.endDate)
    const startTime = cleanString(body.startTime)
    const endTime = cleanString(body.endTime)
    const reason = cleanString(body.reason)
    const reviewedByName = cleanString(body.reviewedByName) || 'Kelly'

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return NextResponse.json({ ok: false, error: 'Invalid request id.' }, { status: 400 })
    }
    if (!Number.isInteger(workerId) || workerId <= 0) {
      return NextResponse.json({ ok: false, error: 'Please choose a worker.' }, { status: 400 })
    }
    if (!startDate || !endDate) {
      return NextResponse.json({ ok: false, error: 'Please choose valid start and end dates.' }, { status: 400 })
    }
    if (endDate < startDate) {
      return NextResponse.json({ ok: false, error: 'End date cannot be before start date.' }, { status: 400 })
    }
    if (!isFullDay && (!validTime(startTime) || !validTime(endTime) || endTime <= startTime)) {
      return NextResponse.json({ ok: false, error: 'Please choose valid start and end times.' }, { status: 400 })
    }

    const existing = await prisma.timeOffRequest.findUnique({
      where: { id: requestId },
      include: { availabilityBlock: true },
    })

    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Holiday request not found.' }, { status: 404 })
    }
    if (existing.status !== 'approved') {
      return NextResponse.json({ ok: false, error: 'Only accepted holidays can be edited here.' }, { status: 400 })
    }

    const worker = await prisma.worker.findFirst({ where: { id: workerId, active: true }, select: { id: true } })
    if (!worker) {
      return NextResponse.json({ ok: false, error: 'Worker not found.' }, { status: 404 })
    }

    const block = await prisma.$transaction(async (tx) => {
      await tx.timeOffRequest.update({
        where: { id: requestId },
        data: {
          workerId,
          requestType,
          isFullDay,
          startDate,
          endDate,
          startTime: isFullDay ? null : startTime,
          endTime: isFullDay ? null : endTime,
          reason: reason || null,
          reviewedByName,
          reviewedAt: new Date(),
        },
      })

      const blockData = {
        workerId,
        title: requestTypeLabel(requestType),
        startDate,
        endDate,
        startTime: isFullDay ? null : startTime,
        endTime: isFullDay ? null : endTime,
        isFullDay,
        notes: reason || null,
        active: true,
      }

      if (existing.availabilityBlock) {
        return tx.workerAvailabilityBlock.update({
          where: { id: existing.availabilityBlock.id },
          data: blockData,
        })
      }

      return tx.workerAvailabilityBlock.create({
        data: { ...blockData, requestId, source: 'time_off_request' },
      })
    })

    const impactedJobIds = await unscheduleImpactedJobsForApprovedBlock({
      workerId,
      block: {
        startDate: block.startDate,
        endDate: block.endDate,
        startTime: block.startTime,
        endTime: block.endTime,
        isFullDay: block.isFullDay,
      },
    })
    const schedulerResult = await runAutoScheduler()

    return NextResponse.json({ ok: true, impactedJobIds, schedulerResult })
  } catch (error) {
    console.error('PATCH /api/kelly/time-off/[id] failed:', error)
    return NextResponse.json({ ok: false, error: 'Failed to update the accepted holiday.' }, { status: 500 })
  }
}
