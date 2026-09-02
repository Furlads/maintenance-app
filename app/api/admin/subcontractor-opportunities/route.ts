import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function isAdminLikeRole(role: string | null | undefined) {
  return ['admin', 'office', 'manager', 'owner'].includes(clean(role).toLowerCase())
}

function parseWorkerIds(value: unknown) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map(Number).filter((id) => Number.isInteger(id) && id > 0))]
}

function parsePrice(value: unknown) {
  if (value == null || value === '') return null
  const parsed = Number(String(value).replace(/[^0-9.]/g, ''))
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function parseOptionalPositiveInt(value: unknown) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function parseDate(value: unknown) {
  const raw = clean(value)
  if (!raw) return null
  const date = new Date(`${raw}T23:59:59.999Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

type OpportunityRow = {
  id: number
  company: string
  sourceJobId: number | null
  title: string
  trade: string
  roughArea: string
  pricingMode: string
  fixedPrice: number | null
  status: string
  createdAt: Date
  replyBy: Date | null
  sentCount: bigint
  interestedCount: bigint
  awardedCount: bigint
  acceptedCount: bigint
  declinedCount: bigint
  counterCount: bigint
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
  if (!isAdminLikeRole(session.role)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  await prisma.$executeRaw`
    UPDATE "SubcontractorOpportunityRecipient" r
    SET "status"='expired'
    FROM "SubcontractorOpportunity" o
    WHERE r."opportunityId"=o."id" AND o."replyBy" IS NOT NULL AND o."replyBy" < CURRENT_TIMESTAMP
      AND r."status" IN ('sent','viewed','interested','countered')
  `

  const opportunities = await prisma.$queryRaw<OpportunityRow[]>`
    SELECT o."id", o."company", o."sourceJobId", o."title", o."trade", o."roughArea", o."pricingMode",
      o."fixedPrice", o."status", o."createdAt", o."replyBy",
      COUNT(r."id") AS "sentCount",
      COUNT(r."id") FILTER (WHERE r."status" = 'interested') AS "interestedCount",
      COUNT(r."id") FILTER (WHERE r."status" = 'awarded') AS "awardedCount",
      COUNT(r."id") FILTER (WHERE r."status" = 'accepted') AS "acceptedCount",
      COUNT(r."id") FILTER (WHERE r."status" = 'declined') AS "declinedCount",
      COUNT(r."id") FILTER (WHERE r."status" = 'countered') AS "counterCount"
    FROM "SubcontractorOpportunity" o
    LEFT JOIN "SubcontractorOpportunityRecipient" r ON r."opportunityId" = o."id"
    GROUP BY o."id"
    ORDER BY o."createdAt" DESC
    LIMIT 100
  `

  return NextResponse.json({
    opportunities: opportunities.map((item) => ({
      ...item,
      sentCount: Number(item.sentCount),
      interestedCount: Number(item.interestedCount),
      awardedCount: Number(item.awardedCount),
      acceptedCount: Number(item.acceptedCount),
      declinedCount: Number(item.declinedCount),
      counterCount: Number(item.counterCount),
    })),
  })
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
  if (!isAdminLikeRole(session.role)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const company = clean(body.company) || 'furlads'
  const sourceJobId = parseOptionalPositiveInt(body.sourceJobId)
  const sourceType = sourceJobId ? 'job' : clean(body.sourceType) || 'manual'
  const title = clean(body.title)
  const trade = clean(body.trade)
  const roughArea = clean(body.roughArea)
  const publicDescription = clean(body.publicDescription)
  const durationText = clean(body.durationText) || null
  const timingText = clean(body.timingText) || null
  const pricingMode = clean(body.pricingMode) === 'quote' ? 'quote' : 'price'
  const fixedPrice = pricingMode === 'price' ? parsePrice(body.fixedPrice) : null
  const quoteGuidance = pricingMode === 'quote' ? clean(body.quoteGuidance) || null : null
  const workerIds = parseWorkerIds(body.workerIds)
  const createdByWorkerId = Number(session.workerId)
  const replyBy = parseDate(body.replyBy) || new Date(Date.now() + 7 * 86400000)
  const priceIncludesVat = body.priceIncludesVat !== false
  const workBasis = ['labour_only', 'labour_materials'].includes(clean(body.workBasis)) ? clean(body.workBasis) : 'labour_only'
  const materialsResponsibility = clean(body.materialsResponsibility) || null
  const plantResponsibility = clean(body.plantResponsibility) || null
  const wasteResponsibility = clean(body.wasteResponsibility) || null
  const siteNotes = clean(body.siteNotes) || null

  if (!title || !trade || !roughArea || !publicDescription) return NextResponse.json({ error: 'Title, trade, rough area and description are required.' }, { status: 400 })
  if (!workerIds.length) return NextResponse.json({ error: 'Choose at least one subcontractor.' }, { status: 400 })
  if (pricingMode === 'price' && fixedPrice == null) return NextResponse.json({ error: 'Enter a valid subcontractor price.' }, { status: 400 })

  if (sourceJobId) {
    const sourceJob = await prisma.job.findUnique({ where: { id: sourceJobId }, select: { id: true, status: true } })
    if (!sourceJob) return NextResponse.json({ error: 'The linked job could not be found.' }, { status: 404 })
    if (['cancelled', 'archived', 'done'].includes(clean(sourceJob.status).toLowerCase())) return NextResponse.json({ error: 'This job is not open for subcontractor assignment.' }, { status: 400 })
  }

  const workers = await prisma.$queryRaw<Array<{
    id: number; firstName: string; lastName: string; phone: string | null; publicLiabilityExpiresAt: Date | null;
    availabilityStatus: string; unavailableUntil: Date | null; doNotUse: boolean; vatRegistered: boolean;
  }>>`
    SELECT "id", "firstName", "lastName", "phone", "publicLiabilityExpiresAt", "availabilityStatus", "unavailableUntil", "doNotUse", "vatRegistered"
    FROM "Worker"
    WHERE "id" = ANY(${workerIds}::int[]) AND "active"=TRUE AND "employmentType"='subcontractor'
  `

  if (workers.length !== workerIds.length) return NextResponse.json({ error: 'One or more selected workers are not active subcontractors.' }, { status: 400 })

  const blocked = workers.filter((worker) => worker.doNotUse || worker.availabilityStatus === 'unavailable' || (worker.unavailableUntil && worker.unavailableUntil.getTime() > Date.now()))
  if (blocked.length) {
    return NextResponse.json({ error: `Cannot send this opportunity to ${blocked.map((worker) => `${worker.firstName} ${worker.lastName}`.trim()).join(', ')} because they are unavailable or restricted.` }, { status: 400 })
  }

  const expiredWorkers = workers.filter((worker) => worker.publicLiabilityExpiresAt && worker.publicLiabilityExpiresAt.getTime() < Date.now())
  if (expiredWorkers.length) {
    return NextResponse.json({ error: `Cannot send new work until public liability insurance is updated for ${expiredWorkers.map((worker) => `${worker.firstName} ${worker.lastName}`.trim()).join(', ')}.` }, { status: 400 })
  }

  const opportunity = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: number }>>`
      INSERT INTO "SubcontractorOpportunity"
        ("company", "sourceType", "sourceJobId", "title", "trade", "roughArea", "publicDescription", "durationText", "timingText", "pricingMode", "fixedPrice", "quoteGuidance", "createdByWorkerId", "replyBy", "priceIncludesVat", "workBasis", "materialsResponsibility", "plantResponsibility", "wasteResponsibility", "siteNotes")
      VALUES
        (${company}, ${sourceType}, ${sourceJobId}, ${title}, ${trade}, ${roughArea}, ${publicDescription}, ${durationText}, ${timingText}, ${pricingMode}, ${fixedPrice}, ${quoteGuidance}, ${Number.isInteger(createdByWorkerId) ? createdByWorkerId : null}, ${replyBy}, ${priceIncludesVat}, ${workBasis}, ${materialsResponsibility}, ${plantResponsibility}, ${wasteResponsibility}, ${siteNotes})
      RETURNING "id"
    `
    const id = rows[0].id
    for (const worker of workers) {
      const token = crypto.randomBytes(24).toString('hex')
      await tx.$executeRaw`INSERT INTO "SubcontractorOpportunityRecipient" ("opportunityId", "workerId", "token") VALUES (${id}, ${worker.id}, ${token})`
    }
    return { id }
  })

  const recipients = await prisma.$queryRaw<Array<{ workerId: number; token: string }>>`
    SELECT "workerId", "token" FROM "SubcontractorOpportunityRecipient" WHERE "opportunityId" = ${opportunity.id}
  `

  const origin = new URL(req.url).origin
  const links = recipients.map((recipient) => {
    const worker = workers.find((item) => item.id === recipient.workerId)!
    const url = `${origin}/contractor/opportunity/${recipient.token}`
    const name = worker.firstName || 'there'
    const vatText = pricingMode === 'price' ? (priceIncludesVat ? ' including any VAT' : ' plus VAT if applicable') : ''
    const message = `Hi ${name} — we have a new ${trade} opportunity around ${roughArea}. Reply by ${replyBy.toLocaleDateString('en-GB')}. Have a look here${vatText}: ${url}`
    const phone = clean(worker.phone).replace(/[^0-9+]/g, '')
    return {
      workerId: worker.id,
      workerName: `${worker.firstName} ${worker.lastName}`.trim(),
      phone: worker.phone,
      url,
      whatsappUrl: `https://wa.me/${phone.replace(/^0/, '44').replace('+', '')}?text=${encodeURIComponent(message)}`,
    }
  })

  return NextResponse.json({ opportunityId: opportunity.id, sourceJobId, links }, { status: 201 })
}
