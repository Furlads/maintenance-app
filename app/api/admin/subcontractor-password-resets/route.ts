import { NextResponse } from 'next/server'
import { getBaseUrl, getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createContractorAccessToken } from '@/lib/subcontractor-access-token'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function clean(value: unknown) { return typeof value === 'string' ? value.trim() : '' }
function isAdmin(role?: string | null) { return ['admin', 'office', 'manager', 'owner'].includes(clean(role).toLowerCase()) }

export async function GET() {
  const session = await getSession()
  if (!session || !isAdmin(session.role)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const requests = await prisma.$queryRaw<Array<{
    id: number; workerId: number; status: string; requestedAt: Date; firstName: string; lastName: string; phone: string | null
  }>>`
    SELECT r."id", r."workerId", r."status", r."requestedAt", w."firstName", w."lastName", w."phone"
    FROM "SubcontractorPasswordResetRequest" r
    JOIN "Worker" w ON w."id"=r."workerId"
    WHERE r."status"='pending'
    ORDER BY r."requestedAt" ASC
  `
  return NextResponse.json({ requests })
}

export async function PATCH(req: Request) {
  const session = await getSession()
  if (!session?.workerId || !isAdmin(session.role)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const requestId = Number(body.requestId)
  if (!Number.isInteger(requestId) || requestId <= 0) return NextResponse.json({ error: 'Invalid reset request.' }, { status: 400 })

  const rows = await prisma.$queryRaw<Array<{
    id: number; workerId: number; firstName: string; phone: string | null; passwordHash: string | null
  }>>`
    SELECT r."id", r."workerId", w."firstName", w."phone", w."passwordHash"
    FROM "SubcontractorPasswordResetRequest" r
    JOIN "Worker" w ON w."id"=r."workerId"
    WHERE r."id"=${requestId} AND r."status"='pending'
    LIMIT 1
  `
  const row = rows[0]
  if (!row?.passwordHash) return NextResponse.json({ error: 'Reset request is no longer valid.' }, { status: 404 })

  const token = createContractorAccessToken({ workerId: row.workerId, purpose: 'reset', phone: row.phone, passwordHash: row.passwordHash, ttlSeconds: 60 * 60 * 24 })
  const resetUrl = `${await getBaseUrl()}/contractor/access/${encodeURIComponent(token)}`
  const message = `Hi ${row.firstName}, here is your secure Furlads subcontractor password reset link. It expires in 24 hours: ${resetUrl}`

  await prisma.$executeRaw`
    UPDATE "SubcontractorPasswordResetRequest"
    SET "status"='sent', "resolvedAt"=CURRENT_TIMESTAMP, "resolvedByWorkerId"=${Number(session.workerId)}
    WHERE "id"=${requestId}
  `

  return NextResponse.json({ ok: true, phone: row.phone, resetUrl, message })
}
