import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import {
  createQuoteFromMaintenanceOpportunity,
  setMaintenanceOpportunityStatus,
} from '@/lib/maintenance-opportunities'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = {
  params: {
    jobId: string
    opportunityId: string
  }
}

function validId(value: string) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const jobId = validId(params.jobId)
    if (!jobId || !params.opportunityId) {
      return NextResponse.json({ ok: false, error: 'Invalid opportunity.' }, { status: 400 })
    }

    const session = await getSession()
    const workerId = session?.workerId ? Number(session.workerId) : null
    const body = await request.json().catch(() => ({}))
    const action = String(body.action || '')

    if (action === 'create_quote') {
      const result = await createQuoteFromMaintenanceOpportunity(
        jobId,
        params.opportunityId,
        Number.isInteger(workerId) ? workerId : null
      )
      return NextResponse.json({ ok: true, ...result })
    }

    if (action === 'dismiss' || action === 'reopen') {
      const controls = await setMaintenanceOpportunityStatus(
        jobId,
        params.opportunityId,
        action === 'dismiss' ? 'dismissed' : 'open',
        Number.isInteger(workerId) ? workerId : null
      )
      return NextResponse.json({ ok: true, controls })
    }

    return NextResponse.json({ ok: false, error: 'Unknown opportunity action.' }, { status: 400 })
  } catch (error) {
    console.error('MAINTENANCE OPPORTUNITY ACTION ERROR', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Could not update opportunity.' },
      { status: 500 }
    )
  }
}
