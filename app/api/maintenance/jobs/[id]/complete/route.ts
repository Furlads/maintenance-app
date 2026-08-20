import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { getMaintenanceControls, saveMaintenanceControls } from '@/lib/maintenance-controls'

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
    const id = validId(params.id)
    if (!id) return NextResponse.json({ ok: false, error: 'Invalid job id.' }, { status: 400 })

    const job = await prisma.job.findUnique({
      where: { id },
      select: { id: true, jobType: true, status: true },
    })

    if (!job) return NextResponse.json({ ok: false, error: 'Job not found.' }, { status: 404 })
    if (String(job.jobType || '').trim().toLowerCase() !== 'maintenance') {
      return NextResponse.json({ ok: false, error: 'This is not a maintenance job.' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const outcome = body.outcome === 'could_not_complete' ? 'could_not_complete' : 'completed'
    const completionNote = cleanText(body.completionNote)
    const nextVisitNote = cleanText(body.nextVisitNote)

    if (outcome === 'could_not_complete' && !completionNote) {
      return NextResponse.json({ ok: false, error: 'Add a short reason before marking the visit as not completed.' }, { status: 400 })
    }

    const session = await getSession()
    const workerId = session?.workerId ? Number(session.workerId) : null
    const current = await getMaintenanceControls(id)
    const completedAt = new Date().toISOString()

    const controls = await saveMaintenanceControls(
      id,
      {
        nextVisitNote,
        extraWork: current.extraWork,
        outcome,
        completionNote,
        completedAt,
      },
      Number.isInteger(workerId) ? workerId : null
    )

    await prisma.job.update({
      where: { id },
      data: {
        status: outcome === 'completed' ? 'done' : 'todo',
        finishedAt: outcome === 'completed' ? new Date(completedAt) : null,
        pausedAt: null,
      },
    })

    return NextResponse.json({ ok: true, controls, status: outcome === 'completed' ? 'done' : 'todo' })
  } catch (error) {
    console.error('COMPLETE MAINTENANCE VISIT ERROR', error)
    return NextResponse.json({ ok: false, error: 'Could not finish this maintenance visit.' }, { status: 500 })
  }
}
