import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }
function clean(value: unknown) { return typeof value === 'string' ? value.trim() : '' }
function isAdminLikeRole(role: string | null | undefined) { return ['admin', 'office', 'manager', 'owner'].includes(clean(role).toLowerCase()) }

async function auth() {
  const session = await getSession()
  if (!session) return { session: null, error: NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 }) }
  if (!isAdminLikeRole(session.role)) return { session: null, error: NextResponse.json({ error: 'Forbidden.' }, { status: 403 }) }
  return { session, error: null }
}

export async function GET(_: Request, ctx: Ctx) {
  const gate = await auth()
  if (gate.error) return gate.error
  const { id } = await ctx.params
  const opportunityId = Number(id)
  if (!Number.isInteger(opportunityId) || opportunityId <= 0) return NextResponse.json({ error: 'Invalid opportunity.' }, { status: 400 })

  const opportunities = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT * FROM "SubcontractorOpportunity" WHERE "id"=${opportunityId} LIMIT 1
  `
  const opportunity = opportunities[0]
  if (!opportunity) return NextResponse.json({ error: 'Opportunity not found.' }, { status: 404 })

  const recipients = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT r.*, w."firstName", w."lastName", w."tradingName", w."dayRate", w."teamDayRate", w."teamSize",
      w."workSetup", w."vatRegistered", w."availabilityStatus", w."publicLiabilityExpiresAt"
    FROM "SubcontractorOpportunityRecipient" r
    JOIN "Worker" w ON w."id"=r."workerId"
    WHERE r."opportunityId"=${opportunityId}
    ORDER BY CASE r."status" WHEN 'awarded' THEN 0 WHEN 'accepted' THEN 0 WHEN 'countered' THEN 1 WHEN 'interested' THEN 2 ELSE 3 END,
      r."respondedAt" ASC NULLS LAST
  `

  return NextResponse.json({ opportunity, recipients })
}

export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await auth()
  if (gate.error) return gate.error
  const { id } = await ctx.params
  const opportunityId = Number(id)
  if (!Number.isInteger(opportunityId) || opportunityId <= 0) return NextResponse.json({ error: 'Invalid opportunity.' }, { status: 400 })

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const action = clean(body.action).toLowerCase()
  const recipientId = Number(body.recipientId)
  if (action !== 'award') return NextResponse.json({ error: 'Invalid action.' }, { status: 400 })
  if (!Number.isInteger(recipientId) || recipientId <= 0) return NextResponse.json({ error: 'Choose a subcontractor to award.' }, { status: 400 })

  const rows = await prisma.$queryRaw<Array<{ id: number; workerId: number; status: string }>>`
    SELECT "id", "workerId", "status" FROM "SubcontractorOpportunityRecipient"
    WHERE "id"=${recipientId} AND "opportunityId"=${opportunityId} LIMIT 1
  `
  const recipient = rows[0]
  if (!recipient) return NextResponse.json({ error: 'Recipient not found.' }, { status: 404 })
  if (!['interested', 'countered', 'viewed', 'sent'].includes(recipient.status)) return NextResponse.json({ error: 'This response cannot be awarded in its current state.' }, { status: 409 })

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "SubcontractorOpportunityRecipient"
      SET "status"='not_selected'
      WHERE "opportunityId"=${opportunityId} AND "id"<>${recipientId} AND "status" IN ('sent','viewed','interested','countered')
    `
    await tx.$executeRaw`
      UPDATE "SubcontractorOpportunityRecipient"
      SET "status"='awarded', "awardedAt"=CURRENT_TIMESTAMP
      WHERE "id"=${recipientId}
    `
    await tx.$executeRaw`UPDATE "SubcontractorOpportunity" SET "status"='awarded', "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${opportunityId}`
  })

  return NextResponse.json({ ok: true, status: 'awarded', recipientId })
}
