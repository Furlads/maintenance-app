import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  SUBCONTRACTOR_AGREEMENT_ACCEPTANCE,
  SUBCONTRACTOR_AGREEMENT_SECTIONS,
  SUBCONTRACTOR_AGREEMENT_TITLE,
  SUBCONTRACTOR_AGREEMENT_VERSION,
} from '@/lib/subcontractor-agreement'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function GET() {
  const session = await getSession()
  if (!session?.workerId) return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })

  const workerId = Number(session.workerId)
  const worker = await prisma.worker.findUnique({ where: { id: workerId }, select: { id: true, firstName: true, lastName: true, employmentType: true, active: true } })
  if (!worker || !worker.active || worker.employmentType !== 'subcontractor') return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const acceptance = await prisma.$queryRaw<Array<{ typedName: string; acceptedAt: Date }>>`
    SELECT "typedName", "acceptedAt"
    FROM "SubcontractorAgreementAcceptance"
    WHERE "workerId" = ${workerId} AND "version" = ${SUBCONTRACTOR_AGREEMENT_VERSION}
    LIMIT 1
  `

  return NextResponse.json({
    agreement: {
      version: SUBCONTRACTOR_AGREEMENT_VERSION,
      title: SUBCONTRACTOR_AGREEMENT_TITLE,
      sections: SUBCONTRACTOR_AGREEMENT_SECTIONS,
      acceptanceText: SUBCONTRACTOR_AGREEMENT_ACCEPTANCE,
    },
    worker: { fullName: `${worker.firstName} ${worker.lastName}`.trim() },
    accepted: Boolean(acceptance[0]),
    acceptance: acceptance[0] ?? null,
  })
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session?.workerId) return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })

  const workerId = Number(session.workerId)
  const worker = await prisma.worker.findUnique({ where: { id: workerId }, select: { firstName: true, lastName: true, employmentType: true, active: true } })
  if (!worker || !worker.active || worker.employmentType !== 'subcontractor') return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const typedName = clean(body.typedName)
  const agreed = body.agreed === true
  if (!agreed) return NextResponse.json({ error: 'You must agree to the subcontractor agreement.' }, { status: 400 })
  if (typedName.length < 3) return NextResponse.json({ error: 'Enter your full name to accept the agreement.' }, { status: 400 })

  const ipAddress = clean(req.headers.get('x-forwarded-for')?.split(',')[0]) || null
  const userAgent = clean(req.headers.get('user-agent')) || null

  await prisma.$executeRaw`
    INSERT INTO "SubcontractorAgreementAcceptance"
      ("workerId", "version", "agreementTitle", "typedName", "ipAddress", "userAgent")
    VALUES
      (${workerId}, ${SUBCONTRACTOR_AGREEMENT_VERSION}, ${SUBCONTRACTOR_AGREEMENT_TITLE}, ${typedName}, ${ipAddress}, ${userAgent})
    ON CONFLICT ("workerId", "version") DO NOTHING
  `

  return NextResponse.json({ ok: true, redirectTo: '/contractor' })
}
