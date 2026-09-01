import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getLatestLandscapingPlan } from '@/lib/landscaping-plan'
import { contractorSessionMatchesWorker } from '@/lib/contractor-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ token: string }> }

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function parseAmount(value: unknown) {
  if (value == null || value === '') return null
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

type RecipientRow = {
  recipientId: number
  opportunityId: number
  workerId: number
  status: string
  sourceJobId: number | null
  fixedPrice: number | null
  cisDeductionRate: number | null
}

async function getRecipient(token: string) {
  const rows = await prisma.$queryRaw<RecipientRow[]>`
    SELECT r."id" AS "recipientId", r."opportunityId", r."workerId", r."status",
      o."sourceJobId", o."fixedPrice", w."cisDeductionRate"
    FROM "SubcontractorOpportunityRecipient" r
    JOIN "SubcontractorOpportunity" o ON o."id" = r."opportunityId"
    JOIN "Worker" w ON w."id" = r."workerId"
    WHERE r."token" = ${token}
    LIMIT 1
  `
  return rows[0] ?? null
}

async function ensureWorkOrder(recipient: RecipientRow) {
  const existing = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT "id" FROM "SubcontractorWorkOrder"
    WHERE "recipientId" = ${recipient.recipientId}
    LIMIT 1
  `
  if (existing[0]) return existing[0].id

  const rows = await prisma.$queryRaw<Array<{ id: number }>>`
    INSERT INTO "SubcontractorWorkOrder"
      ("recipientId", "opportunityId", "jobId", "workerId", "agreedPrice", "cisDeductionRate")
    VALUES
      (${recipient.recipientId}, ${recipient.opportunityId}, ${recipient.sourceJobId}, ${recipient.workerId}, ${recipient.fixedPrice}, ${recipient.cisDeductionRate})
    RETURNING "id"
  `
  return rows[0].id
}

async function authorise(token: string) {
  const recipient = await getRecipient(clean(token))
  if (!recipient) return { recipient: null, response: NextResponse.json({ error: 'Opportunity not found.' }, { status: 404 }) }
  if (!(await contractorSessionMatchesWorker(recipient.workerId))) {
    return { recipient: null, response: NextResponse.json({ error: 'Please log in to open this work order.' }, { status: 401 }) }
  }
  return { recipient, response: null }
}

export async function GET(_: Request, ctx: Ctx) {
  const { token } = await ctx.params
  const auth = await authorise(token)
  if (!auth.recipient) return auth.response!
  const recipient = auth.recipient
  if (recipient.status !== 'accepted') return NextResponse.json({ error: 'Accept the opportunity before opening the work order.' }, { status: 403 })

  const workOrderId = await ensureWorkOrder(recipient)

  const workOrders = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT wo.*, o."title", o."trade", o."publicDescription", o."timingText", o."durationText",
      j."address", j."notes" AS "jobNotes", j."visitDate", j."startTime", j."status" AS "jobStatus", j."jobType",
      c."name" AS "customerName", c."phone" AS "customerPhone", c."email" AS "customerEmail",
      c."address" AS "customerAddress", c."postcode" AS "customerPostcode"
    FROM "SubcontractorWorkOrder" wo
    JOIN "SubcontractorOpportunity" o ON o."id" = wo."opportunityId"
    LEFT JOIN "Job" j ON j."id" = wo."jobId"
    LEFT JOIN "Customer" c ON c."id" = j."customerId"
    WHERE wo."id" = ${workOrderId}
    LIMIT 1
  `

  const variations = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT "id", "description", "amount", "status", "requestedAt", "approvedAt"
    FROM "SubcontractorVariation"
    WHERE "workOrderId" = ${workOrderId}
    ORDER BY "requestedAt" DESC
  `

  const photos = recipient.sourceJobId
    ? await prisma.jobPhoto.findMany({
        where: { jobId: recipient.sourceJobId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, label: true, imageUrl: true, createdAt: true, uploadedByWorkerId: true },
      })
    : []

  const workOrder = workOrders[0] || null
  if (!workOrder) return NextResponse.json({ error: 'Work order not found.' }, { status: 404 })

  const closed = ['signed_off'].includes(clean(workOrder.status).toLowerCase()) || clean(workOrder.paymentStatus).toLowerCase() === 'paid'

  const safeWorkOrder = closed
    ? {
        ...workOrder,
        address: null,
        customerPhone: null,
        customerEmail: null,
        customerAddress: null,
        customerPostcode: null,
      }
    : workOrder

  const jobType = clean(workOrder.jobType).toLowerCase()
  const landscapingPlan = recipient.sourceJobId && jobType.includes('land')
    ? await getLatestLandscapingPlan(recipient.sourceJobId)
    : null

  const operationalPlan = landscapingPlan
    ? {
        totalDays: landscapingPlan.totalDays,
        teamSize: landscapingPlan.teamSize,
        workerSummary: landscapingPlan.workerSummary,
        dayPlan: landscapingPlan.dayPlan.map((day) => ({
          day: day.day,
          heading: day.heading,
          target: day.target,
          tasks: day.tasks,
          ifAhead: day.ifAhead,
          checkpoint: day.checkpoint,
        })),
        materials: landscapingPlan.materials.map((item) => ({
          item: item.item,
          quantity: item.neededQuantity || item.quantity,
          orderFor: item.orderFor,
          note: item.note,
        })),
        plantTools: landscapingPlan.plantTools,
        siteChecks: landscapingPlan.siteChecks,
        risks: landscapingPlan.risks,
      }
    : null

  return NextResponse.json({ workOrder: safeWorkOrder, variations, photos: closed ? [] : photos, operationalPlan: closed ? null : operationalPlan })
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { token } = await ctx.params
  const auth = await authorise(token)
  if (!auth.recipient) return auth.response!
  const recipient = auth.recipient
  if (recipient.status !== 'accepted') return NextResponse.json({ error: 'Opportunity must be accepted first.' }, { status: 403 })

  const workOrderId = await ensureWorkOrder(recipient)
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const action = clean(body.action).toLowerCase()

  const current = await prisma.$queryRaw<Array<{ status: string; paymentStatus: string }>>`
    SELECT "status", "paymentStatus" FROM "SubcontractorWorkOrder" WHERE "id" = ${workOrderId} LIMIT 1
  `
  if (current[0] && (current[0].status === 'signed_off' || current[0].paymentStatus === 'paid')) {
    return NextResponse.json({ error: 'This work order is closed.' }, { status: 410 })
  }

  if (action === 'request_variation') {
    const description = clean(body.description)
    const amount = parseAmount(body.amount)
    if (!description) return NextResponse.json({ error: 'Describe the extra work requested.' }, { status: 400 })

    const rows = await prisma.$queryRaw<Array<{ id: number }>>`
      INSERT INTO "SubcontractorVariation" ("workOrderId", "description", "amount")
      VALUES (${workOrderId}, ${description}, ${amount})
      RETURNING "id"
    `
    return NextResponse.json({ ok: true, variationId: rows[0].id, status: 'requested' })
  }

  if (action === 'submit_completion') {
    const completionNotes = clean(body.completionNotes) || null
    const issuesNotes = clean(body.issuesNotes) || null

    const completionPhotoCount = recipient.sourceJobId
      ? await prisma.jobPhoto.count({
          where: {
            jobId: recipient.sourceJobId,
            uploadedByWorkerId: recipient.workerId,
            label: { startsWith: 'Subcontractor completion' },
          },
        })
      : 0

    if (recipient.sourceJobId && completionPhotoCount < 1) {
      return NextResponse.json({ error: 'Upload at least one completion photo before submitting the job.' }, { status: 400 })
    }

    await prisma.$executeRaw`
      UPDATE "SubcontractorWorkOrder"
      SET "status" = 'awaiting_signoff',
          "completionNotes" = ${completionNotes},
          "issuesNotes" = ${issuesNotes},
          "submittedAt" = CURRENT_TIMESTAMP,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${workOrderId}
    `

    return NextResponse.json({ ok: true, status: 'awaiting_signoff' })
  }

  if (action === 'customer_signoff') {
    const signerName = clean(body.signerName)
    if (!signerName) return NextResponse.json({ error: 'Enter the name of the person signing off the work.' }, { status: 400 })

    if (current[0]?.status !== 'awaiting_signoff') {
      return NextResponse.json({ error: 'Completion must be submitted before sign-off.' }, { status: 400 })
    }

    await prisma.$executeRaw`
      UPDATE "SubcontractorWorkOrder"
      SET "status" = 'signed_off',
          "signoffStatus" = 'signed',
          "signerName" = ${signerName},
          "signerRole" = 'customer',
          "signedAt" = CURRENT_TIMESTAMP,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${workOrderId}
    `

    return NextResponse.json({ ok: true, status: 'signed_off' })
  }

  if (action === 'raise_snag') {
    const snagNotes = clean(body.snagNotes)
    if (!snagNotes) return NextResponse.json({ error: 'Describe the snag or outstanding item.' }, { status: 400 })

    await prisma.$executeRaw`
      UPDATE "SubcontractorWorkOrder"
      SET "status" = 'snag',
          "signoffStatus" = 'snag',
          "snagNotes" = ${snagNotes},
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${workOrderId}
    `
    return NextResponse.json({ ok: true, status: 'snag' })
  }

  return NextResponse.json({ error: 'Invalid work order action.' }, { status: 400 })
}
