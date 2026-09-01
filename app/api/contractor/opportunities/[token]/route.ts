import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ token: string }> }

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

type OpportunityView = {
  recipientId: number
  status: string
  workerId: number
  firstName: string
  lastName: string
  company: string
  title: string
  trade: string
  roughArea: string
  publicDescription: string
  durationText: string | null
  timingText: string | null
  pricingMode: string
  fixedPrice: number | null
  quoteGuidance: string | null
}

async function loadOpportunity(token: string) {
  const rows = await prisma.$queryRaw<OpportunityView[]>`
    SELECT r."id" AS "recipientId", r."status", r."workerId",
      w."firstName", w."lastName", o."company", o."title", o."trade", o."roughArea",
      o."publicDescription", o."durationText", o."timingText", o."pricingMode",
      o."fixedPrice", o."quoteGuidance"
    FROM "SubcontractorOpportunityRecipient" r
    JOIN "SubcontractorOpportunity" o ON o."id" = r."opportunityId"
    JOIN "Worker" w ON w."id" = r."workerId"
    WHERE r."token" = ${token}
    LIMIT 1
  `
  return rows[0] ?? null
}

export async function GET(_: Request, ctx: Ctx) {
  const { token } = await ctx.params
  const opportunity = await loadOpportunity(clean(token))
  if (!opportunity) return NextResponse.json({ error: 'Opportunity not found.' }, { status: 404 })

  await prisma.$executeRaw`
    UPDATE "SubcontractorOpportunityRecipient"
    SET "viewedAt" = COALESCE("viewedAt", CURRENT_TIMESTAMP),
        "status" = CASE WHEN "status" = 'sent' THEN 'viewed' ELSE "status" END
    WHERE "id" = ${opportunity.recipientId}
  `

  return NextResponse.json({ opportunity })
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { token } = await ctx.params
  const opportunity = await loadOpportunity(clean(token))
  if (!opportunity) return NextResponse.json({ error: 'Opportunity not found.' }, { status: 404 })

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const action = clean(body.action).toLowerCase()
  const nextStatus = action === 'decline' ? 'declined' : action === 'accept' ? 'accepted' : action === 'interested' ? 'interested' : ''
  if (!nextStatus) return NextResponse.json({ error: 'Invalid response.' }, { status: 400 })

  await prisma.$executeRaw`
    UPDATE "SubcontractorOpportunityRecipient"
    SET "status" = ${nextStatus}, "respondedAt" = CURRENT_TIMESTAMP,
        "viewedAt" = COALESCE("viewedAt", CURRENT_TIMESTAMP)
    WHERE "id" = ${opportunity.recipientId}
  `

  return NextResponse.json({ ok: true, status: nextStatus })
}
