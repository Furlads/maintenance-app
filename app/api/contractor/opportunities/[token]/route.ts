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
  opportunityId: number
  sourceJobId: number | null
  status: string
  workerId: number
  firstName: string
  lastName: string
  transportRequired: boolean
  canDrive: boolean
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

type AcceptedRecipient = {
  workerId: number
  transportRequired: boolean
  canDrive: boolean
}

async function loadOpportunity(token: string) {
  const rows = await prisma.$queryRaw<OpportunityView[]>`
    SELECT r."id" AS "recipientId", r."opportunityId", r."status", r."workerId",
      o."sourceJobId", w."firstName", w."lastName", w."transportRequired", w."canDrive",
      o."company", o."title", o."trade", o."roughArea", o."publicDescription",
      o."durationText", o."timingText", o."pricingMode", o."fixedPrice", o."quoteGuidance"
    FROM "SubcontractorOpportunityRecipient" r
    JOIN "SubcontractorOpportunity" o ON o."id" = r."opportunityId"
    JOIN "Worker" w ON w."id" = r."workerId"
    WHERE r."token" = ${token}
    LIMIT 1
  `
  return rows[0] ?? null
}

async function syncAcceptedJobAssignments(jobId: number) {
  const acceptedRecipients = await prisma.$queryRaw<AcceptedRecipient[]>`
    SELECT DISTINCT r."workerId", w."transportRequired", w."canDrive"
    FROM "SubcontractorOpportunityRecipient" r
    JOIN "SubcontractorOpportunity" o ON o."id" = r."opportunityId"
    JOIN "Worker" w ON w."id" = r."workerId"
    WHERE o."sourceJobId" = ${jobId}
      AND r."status" = 'accepted'
      AND w."active" = TRUE
  `

  const existingAssignments = await prisma.jobAssignment.findMany({
    where: { jobId },
    include: {
      worker: {
        select: { id: true, canDrive: true },
      },
    },
  })

  const assignedIds = new Set(existingAssignments.map((item) => item.workerId))
  let hasDriver = existingAssignments.some((item) => item.worker.canDrive)

  const noTransportNeeded = acceptedRecipients.filter((item) => !item.transportRequired)
  const transportNeeded = acceptedRecipients.filter((item) => item.transportRequired)

  for (const recipient of noTransportNeeded) {
    if (!assignedIds.has(recipient.workerId)) {
      await prisma.jobAssignment.create({
        data: { jobId, workerId: recipient.workerId },
      })
      assignedIds.add(recipient.workerId)
    }
    if (recipient.canDrive) hasDriver = true
  }

  for (const recipient of transportNeeded) {
    if (assignedIds.has(recipient.workerId)) continue
    if (!hasDriver) continue

    await prisma.jobAssignment.create({
      data: { jobId, workerId: recipient.workerId },
    })
    assignedIds.add(recipient.workerId)
  }

  return {
    assignedWorkerIds: [...assignedIds],
    hasDriver,
  }
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

  let assignmentStatus: 'not_linked' | 'confirmed' | 'transport_required' | null = null

  if (nextStatus === 'accepted' && opportunity.sourceJobId) {
    const job = await prisma.job.findUnique({
      where: { id: opportunity.sourceJobId },
      select: { id: true, status: true },
    })

    if (job && !['cancelled', 'archived', 'done'].includes(clean(job.status).toLowerCase())) {
      const result = await syncAcceptedJobAssignments(job.id)
      assignmentStatus = result.assignedWorkerIds.includes(opportunity.workerId)
        ? 'confirmed'
        : opportunity.transportRequired
          ? 'transport_required'
          : 'confirmed'
    }
  } else if (nextStatus === 'accepted') {
    assignmentStatus = 'not_linked'
  }

  return NextResponse.json({ ok: true, status: nextStatus, assignmentStatus })
}
