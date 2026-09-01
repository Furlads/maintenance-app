import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normaliseUkPhone } from '@/lib/contractor-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const phone = normaliseUkPhone(clean(body.phone))
  if (!phone) return NextResponse.json({ ok: true })

  const workers = await prisma.worker.findMany({
    where: { active: true, employmentType: 'subcontractor', phone: { not: null } },
    select: { id: true, phone: true, passwordHash: true },
  })
  const worker = workers.find((item) => normaliseUkPhone(item.phone || '') === phone)

  if (worker?.passwordHash) {
    const existing = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT "id" FROM "SubcontractorPasswordResetRequest"
      WHERE "workerId"=${worker.id} AND "status"='pending'
      ORDER BY "requestedAt" DESC LIMIT 1
    `
    if (!existing[0]) {
      await prisma.$executeRaw`
        INSERT INTO "SubcontractorPasswordResetRequest" ("workerId") VALUES (${worker.id})
      `
    }
  }

  return NextResponse.json({ ok: true })
}
