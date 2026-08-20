import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { createMaintenanceOpportunity } from '@/lib/maintenance-opportunities'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: { id: string } }

function validId(value: string) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const jobId = validId(params.id)
    if (!jobId) return NextResponse.json({ ok: false, error: 'Invalid job id.' }, { status: 400 })

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, jobType: true },
    })
    if (!job || String(job.jobType || '').trim().toLowerCase() !== 'maintenance') {
      return NextResponse.json({ ok: false, error: 'Maintenance job not found.' }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const description = cleanText(body.description)
    if (!description) {
      return NextResponse.json({ ok: false, error: 'Describe the extra work first.' }, { status: 400 })
    }

    const source = body.source === 'customer_requested' ? 'customer_requested' : 'worker_spotted'
    const session = await getSession()
    const workerId = session?.workerId ? Number(session.workerId) : null
    const workerName = String(session?.workerName || 'Worker').trim() || 'Worker'

    const result = await createMaintenanceOpportunity(
      jobId,
      {
        description,
        source,
        reportedBy: workerName,
        photoUrl: cleanText(body.photoUrl),
      },
      Number.isInteger(workerId) ? workerId : null
    )

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('CREATE MAINTENANCE OPPORTUNITY ERROR', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Could not create maintenance opportunity.' },
      { status: 500 }
    )
  }
}
