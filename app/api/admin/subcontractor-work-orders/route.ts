import { NextResponse } from 'next/server'
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

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
  if (!isAdminLikeRole(session.role)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const workOrders = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT wo.*, w."firstName", w."lastName", w."tradingName", w."cisVerified",
      w."cisVerificationNumber", w."publicLiabilityExpiresAt",
      o."title", o."trade", o."company", o."roughArea",
      j."address", c."name" AS "customerName",
      COALESCE((SELECT SUM(v."amount") FROM "SubcontractorVariation" v WHERE v."workOrderId" = wo."id" AND v."status" = 'approved'), 0) AS "approvedVariations"
    FROM "SubcontractorWorkOrder" wo
    JOIN "Worker" w ON w."id" = wo."workerId"
    JOIN "SubcontractorOpportunity" o ON o."id" = wo."opportunityId"
    LEFT JOIN "Job" j ON j."id" = wo."jobId"
    LEFT JOIN "Customer" c ON c."id" = j."customerId"
    ORDER BY wo."updatedAt" DESC
    LIMIT 200
  `

  const variations = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT v.*, wo."workerId", o."title", w."firstName", w."lastName"
    FROM "SubcontractorVariation" v
    JOIN "SubcontractorWorkOrder" wo ON wo."id" = v."workOrderId"
    JOIN "SubcontractorOpportunity" o ON o."id" = wo."opportunityId"
    JOIN "Worker" w ON w."id" = wo."workerId"
    WHERE v."status" = 'requested'
    ORDER BY v."requestedAt" ASC
  `

  return NextResponse.json({ workOrders, variations })
}

export async function PATCH(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
  if (!isAdminLikeRole(session.role)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const actorWorkerId = Number(session.workerId)
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const action = clean(body.action).toLowerCase()
  const workOrderId = Number(body.workOrderId)
  const variationId = Number(body.variationId)

  if (action === 'approve_variation' || action === 'reject_variation') {
    if (!Number.isInteger(variationId) || variationId <= 0) return NextResponse.json({ error: 'Invalid variation.' }, { status: 400 })
    const status = action === 'approve_variation' ? 'approved' : 'rejected'
    await prisma.$executeRaw`
      UPDATE "SubcontractorVariation"
      SET "status" = ${status},
          "approvedAt" = CASE WHEN ${status} = 'approved' THEN CURRENT_TIMESTAMP ELSE NULL END,
          "approvedByWorkerId" = ${Number.isInteger(actorWorkerId) ? actorWorkerId : null}
      WHERE "id" = ${variationId}
    `
    return NextResponse.json({ ok: true, status })
  }

  if (!Number.isInteger(workOrderId) || workOrderId <= 0) return NextResponse.json({ error: 'Invalid work order.' }, { status: 400 })

  if (action === 'office_signoff') {
    const signerName = clean(body.signerName) || 'Office review'
    await prisma.$executeRaw`
      UPDATE "SubcontractorWorkOrder"
      SET "status" = 'signed_off', "signoffStatus" = 'signed',
          "signerName" = ${signerName}, "signerRole" = 'office',
          "signedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${workOrderId} AND "status" IN ('awaiting_signoff', 'snag')
    `
    return NextResponse.json({ ok: true, status: 'signed_off' })
  }

  if (action === 'approve_completion') {
    await prisma.$executeRaw`
      UPDATE "SubcontractorWorkOrder"
      SET "status" = 'approved',
          "officeApprovedByWorkerId" = ${Number.isInteger(actorWorkerId) ? actorWorkerId : null},
          "officeApprovedAt" = CURRENT_TIMESTAMP,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${workOrderId} AND "signoffStatus" = 'signed'
    `
    return NextResponse.json({ ok: true, status: 'approved' })
  }

  if (action === 'approve_payment') {
    const rows = await prisma.$queryRaw<Array<{ agreedPrice: number | null; cisDeductionRate: number | null; approvedVariations: number }>>`
      SELECT wo."agreedPrice", wo."cisDeductionRate",
        COALESCE((SELECT SUM(v."amount") FROM "SubcontractorVariation" v WHERE v."workOrderId" = wo."id" AND v."status" = 'approved'), 0)::float8 AS "approvedVariations"
      FROM "SubcontractorWorkOrder" wo WHERE wo."id" = ${workOrderId} LIMIT 1
    `
    const item = rows[0]
    if (!item) return NextResponse.json({ error: 'Work order not found.' }, { status: 404 })

    const gross = (item.agreedPrice ?? 0) + Number(item.approvedVariations || 0)
    const rate = item.cisDeductionRate ?? 0
    const deduction = Math.round((gross * rate / 100) * 100) / 100
    const net = Math.round((gross - deduction) * 100) / 100

    await prisma.$executeRaw`
      UPDATE "SubcontractorWorkOrder"
      SET "paymentStatus" = 'approved',
          "paymentApprovedAt" = CURRENT_TIMESTAMP,
          "paymentApprovedByWorkerId" = ${Number.isInteger(actorWorkerId) ? actorWorkerId : null},
          "cisDeductionAmount" = ${deduction},
          "netPayable" = ${net},
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${workOrderId} AND "status" = 'approved'
    `
    return NextResponse.json({ ok: true, paymentStatus: 'approved', gross, deduction, net })
  }

  if (action === 'mark_paid') {
    await prisma.$executeRaw`
      UPDATE "SubcontractorWorkOrder"
      SET "paymentStatus" = 'paid', "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${workOrderId} AND "paymentStatus" = 'approved'
    `
    return NextResponse.json({ ok: true, paymentStatus: 'paid' })
  }

  return NextResponse.json({ error: 'Invalid admin action.' }, { status: 400 })
}
