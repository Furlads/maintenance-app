import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { createSessionForWorker } from '@/lib/auth'
import { normaliseUkPhone } from '@/lib/contractor-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_FAILED_LOGIN_ATTEMPTS = 5
const LOCKOUT_MINUTES = 15

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const token = clean(body.token)
  const phone = normaliseUkPhone(clean(body.phone))
  const password = clean(body.password)

  if (!token || !phone || !password) {
    return NextResponse.json({ error: 'Mobile number and password are required.' }, { status: 400 })
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
    failedLoginAttempts: number
    lockedUntil: Date | null
  }>>`
    SELECT w."id" AS "workerId", w."phone", w."firstName", w."lastName", w."accessLevel",
      w."employmentType", w."active", w."passwordHash", w."failedLoginAttempts", w."lockedUntil"
    FROM "SubcontractorOpportunityRecipient" r
    JOIN "Worker" w ON w."id" = r."workerId"
    WHERE r."token" = ${token}
    LIMIT 1
  `

  const worker = rows[0]
  if (!worker || !worker.active || worker.employmentType !== 'subcontractor') {
    return NextResponse.json({ error: 'Invalid login details.' }, { status: 401 })
  }
  if (normaliseUkPhone(worker.phone || '') !== phone) {
    return NextResponse.json({ error: 'Invalid login details.' }, { status: 401 })
  }
  if (worker.lockedUntil && worker.lockedUntil.getTime() > Date.now()) {
    return NextResponse.json({ error: 'Account temporarily locked after too many failed attempts.' }, { status: 423 })
  }
  if (!worker.passwordHash) {
    return NextResponse.json({ error: 'This account has not been registered yet.' }, { status: 403 })
  }

  const valid = await bcrypt.compare(password, worker.passwordHash)
  if (!valid) {
    const nextAttempts = (worker.failedLoginAttempts || 0) + 1
    const shouldLock = nextAttempts >= MAX_FAILED_LOGIN_ATTEMPTS
    await prisma.worker.update({
      where: { id: worker.workerId },
      data: {
        failedLoginAttempts: nextAttempts,
        lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null,
      },
    })
    return NextResponse.json({ error: shouldLock ? `Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.` : 'Invalid login details.' }, { status: 401 })
  }

  await prisma.worker.update({
    where: { id: worker.workerId },
    data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  })

  await createSessionForWorker({
    id: worker.workerId,
    firstName: worker.firstName,
    lastName: worker.lastName,
    accessLevel: worker.accessLevel || 'worker',
  })

  return NextResponse.json({ ok: true, redirectTo: `/contractor/opportunity/${encodeURIComponent(token)}` })
}
