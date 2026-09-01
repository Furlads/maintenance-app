import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { createSessionForWorker } from '@/lib/auth'
import { normaliseUkPhone } from '@/lib/contractor-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const token = clean(body.token)
  const phone = normaliseUkPhone(clean(body.phone))
  const password = clean(body.password)

  if (!token || !phone || !password) {
    return NextResponse.json({ error: 'Invite, mobile number and password are required.' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
  }

  const rows = await prisma.$queryRaw<Array<{
    workerId: number
    phone: string | null
    firstName: string
    lastName: string
    accessLevel: string
    employmentType: string
    active: boolean
    passwordHash: string | null
  }>>`
    SELECT w."id" AS "workerId", w."phone", w."firstName", w."lastName", w."accessLevel",
      w."employmentType", w."active", w."passwordHash"
    FROM "SubcontractorOpportunityRecipient" r
    JOIN "Worker" w ON w."id" = r."workerId"
    WHERE r."token" = ${token}
    LIMIT 1
  `

  const worker = rows[0]
  if (!worker || !worker.active || worker.employmentType !== 'subcontractor') {
    return NextResponse.json({ error: 'This subcontractor invite is not valid.' }, { status: 404 })
  }

  if (normaliseUkPhone(worker.phone || '') !== phone) {
    return NextResponse.json({ error: 'That mobile number does not match the subcontractor this invite was sent to.' }, { status: 403 })
  }

  if (worker.passwordHash) {
    return NextResponse.json({ error: 'This account is already registered. Please log in.' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  await prisma.worker.update({
    where: { id: worker.workerId },
    data: { passwordHash, mustChangePassword: false, failedLoginAttempts: 0, lockedUntil: null },
  })

  await createSessionForWorker({
    id: worker.workerId,
    firstName: worker.firstName,
    lastName: worker.lastName,
    accessLevel: worker.accessLevel || 'worker',
  })

  return NextResponse.json({ ok: true, redirectTo: `/contractor/opportunity/${encodeURIComponent(token)}` })
}
