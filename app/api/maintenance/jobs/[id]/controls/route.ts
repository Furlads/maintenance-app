import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import {
  getMaintenanceControls,
  saveMaintenanceControls,
  type MaintenanceExtraWork,
} from '@/lib/maintenance-controls'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: { id: string } }

function validId(value: string) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

function isMaintenance(jobType: string | null | undefined) {
  return String(jobType || '').trim().toLowerCase() === 'maintenance'
}

function withReporter(value: unknown, reporter: string): MaintenanceExtraWork[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) return []

  return value.map((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return row
    const item = row as Record<string, unknown>
    return {
      ...item,
      reportedBy: typeof item.reportedBy === 'string' && item.reportedBy.trim()
        ? item.reportedBy
        : reporter,
    }
  }) as MaintenanceExtraWork[]
}

async function getJob(id: number) {
  return prisma.job.findUnique({
    where: { id },
    select: { id: true, jobType: true },
  })
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const session = await getSession()
    if (!session?.workerId) {
      return NextResponse.json({ ok: false, error: 'Unauthenticated.' }, { status: 401 })
    }

    const id = validId(params.id)
    if (!id) return NextResponse.json({ ok: false, error: 'Invalid job id.' }, { status: 400 })

    const job = await getJob(id)
    if (!job) return NextResponse.json({ ok: false, error: 'Job not found.' }, { status: 404 })
    if (!isMaintenance(job.jobType)) {
      return NextResponse.json({ ok: false, error: 'This is not a maintenance job.' }, { status: 400 })
    }

    const controls = await getMaintenanceControls(id)
    return NextResponse.json({ ok: true, controls })
  } catch (error) {
    console.error('GET MAINTENANCE CONTROLS ERROR', error)
    return NextResponse.json({ ok: false, error: 'Could not load maintenance visit details.' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const session = await getSession()
    if (!session?.workerId) {
      return NextResponse.json({ ok: false, error: 'Unauthenticated.' }, { status: 401 })
    }

    const id = validId(params.id)
    if (!id) return NextResponse.json({ ok: false, error: 'Invalid job id.' }, { status: 400 })

    const job = await getJob(id)
    if (!job) return NextResponse.json({ ok: false, error: 'Job not found.' }, { status: 404 })
    if (!isMaintenance(job.jobType)) {
      return NextResponse.json({ ok: false, error: 'This is not a maintenance job.' }, { status: 400 })
    }

    const workerId = Number(session.workerId)
    const workerName = String(session.workerName || 'Worker').trim() || 'Worker'
    const body = await request.json().catch(() => ({}))

    const controls = await saveMaintenanceControls(
      id,
      {
        propertyMemory: body.propertyMemory,
        nextVisitNote: body.nextVisitNote,
        extraWork: withReporter(body.extraWork, workerName),
        outcome: body.outcome,
        completionReason: body.completionReason,
        completionNote: body.completionNote,
        completedAt: body.completedAt,
      },
      Number.isInteger(workerId) ? workerId : null
    )

    return NextResponse.json({ ok: true, controls })
  } catch (error) {
    console.error('SAVE MAINTENANCE CONTROLS ERROR', error)
    return NextResponse.json({ ok: false, error: 'Could not save maintenance visit details.' }, { status: 500 })
  }
}
