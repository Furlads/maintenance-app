import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'
import { createSessionForWorker } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normaliseUkPhone } from '@/lib/contractor-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function clean(value: unknown) { return typeof value === 'string' ? value.trim() : '' }

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
    inviteId: number
    workerId: number
    expiresAt: Date
    usedAt: Date | null
    firstName: string
    lastName: string
    phone: string | null
    accessLevel: string
    employmentType: string
    active: boolean
    passwordHash: string | null
  }>>`
    SELECT i."id" AS "inviteId", i."workerId", i."expiresAt", i."usedAt",
      w."firstName", w."lastName", w."phone", w."accessLevel", w."employmentType", w."active", w."passwordHash"
    FROM "SubcontractorOnboardingInvite" i
    JOIN "Worker" w ON w."id" = i."workerId"
    WHERE i."token" = ${token}
    LIMIT 1
  `
  const item = rows[0]
  if (!item || !item.active || item.employmentType !== 'subcontractor') {
    return NextResponse.json({ error: 'This onboarding invite is not valid.' }, { status: 404 })
  }
  if (item.usedAt) return NextResponse.json({ error: 'This onboarding invite has already been used. Please log in.' }, { status: 409 })
  if (new Date(item.expiresAt).getTime() < Date.now()) return NextResponse.json({ error: 'This onboarding invite has expired. Ask the office for a new one.' }, { status: 410 })
  if (normaliseUkPhone(item.phone || '') !== phone) return NextResponse.json({ error: 'That mobile number does not match the approved subcontractor.' }, { status: 403 })

  if (!item.passwordHash) {
    const passwordHash = await bcrypt.hash(password, 12)
    await prisma.worker.update({
      where: { id: item.workerId },
      data: { passwordHash, mustChangePassword: false, failedLoginAttempts: 0, lockedUntil: null },
    })
  }

  await prisma.$executeRaw`
    UPDATE "SubcontractorOnboardingInvite"
    SET "usedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${item.inviteId}
  `

  await createSessionForWorker({
    id: item.workerId,
    firstName: item.firstName,
    lastName: item.lastName,
    accessLevel: item.accessLevel || 'worker',
  })

  return NextResponse.json({ ok: true, redirectTo: '/contractor/agreement?next=%2Fcontractor' })
}
