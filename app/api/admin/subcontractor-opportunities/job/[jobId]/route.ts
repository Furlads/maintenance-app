import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ jobId: string }> }

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function isAdminLikeRole(role: string | null | undefined) {
  return ['admin', 'office', 'manager', 'owner'].includes(clean(role).toLowerCase())
}

type Row = {
  recipientId: number
  opportunityId: number
  workerId: number
  workerName: string
  status: string
  fixedPrice: number | null
  pricingMode: string
  createdAt: Date
}

export async function GET(_: Request, ctx: Ctx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
  if (!isAdminLikeRole(session.role)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const { jobId: rawJobId } = await ctx.params
  const jobId = Number(rawJobId)
  if (!Number.isInteger(jobId) || jobId <= 0) {
    return NextResponse.json({ error: 'Invalid job.' }, { status: 400 })
  }

  const rows = await prisma.$queryRaw<Row[]>`
    SELECT r."id" AS "recipientId", r."opportunityId", r."workerId",
      TRIM(CONCAT(w."firstName", ' ', w."lastName")) AS "workerName",
      r."status", o."fixedPrice", o."pricingMode", o."createdAt"
    FROM "SubcontractorOpportunityRecipient" r
    JOIN "SubcontractorOpportunity" o ON o."id" = r."opportunityId"
    JOIN "Worker" w ON w."id" = r."workerId"
    WHERE o."sourceJobId" = ${jobId}
    ORDER BY o."createdAt" DESC, r."id" DESC
  `

  const latestByWorker = new Map<number, Row>()
  for (const row of rows) {
    if (!latestByWorker.has(row.workerId)) latestByWorker.set(row.workerId, row)
  }

  const recipients = [...latestByWorker.values()]
  const statuses = recipients.map((item) => item.status)

  let overallStatus = 'not_offered'
  if (statuses.some((status) => status === 'accepted')) overallStatus = 'accepted'
  else if (statuses.some((status) => status === 'interested')) overallStatus = 'interested'
  else if (statuses.some((status) => ['sent', 'viewed'].includes(status))) overallStatus = 'awaiting_response'
  else if (statuses.length && statuses.every((status) => status === 'declined')) overallStatus = 'declined'

  const workOrders = await prisma.$queryRaw<Array<{ status: string; paymentStatus: string }>>`
    SELECT "status", "paymentStatus"
    FROM "SubcontractorWorkOrder"
    WHERE "jobId" = ${jobId}
    ORDER BY "updatedAt" DESC
  `

  if (workOrders.some((item) => item.status === 'snag')) overallStatus = 'snag'
  else if (workOrders.some((item) => item.status === 'awaiting_signoff')) overallStatus = 'awaiting_signoff'
  else if (workOrders.length && workOrders.every((item) => item.status === 'signed_off')) overallStatus = 'signed_off'
  if (workOrders.length && workOrders.every((item) => item.paymentStatus === 'paid')) overallStatus = 'paid'

  return NextResponse.json({ jobId, overallStatus, recipients, workOrders })
}
