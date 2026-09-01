import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { createSessionForWorker } from '@/lib/auth'
import { verifyContractorAccessToken } from '@/lib/subcontractor-access-token'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function clean(value: unknown) { return typeof value === 'string' ? value.trim() : '' }

async function validateAccessToken(token: string) {
  const bodyPart = token.split('.')[0]
  let workerId = 0
  try { workerId = Number(JSON.parse(Buffer.from(bodyPart, 'base64url').toString('utf8')).workerId) } catch {}
  if (!workerId) return null

  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    select: { id: true, firstName: true, lastName: true, accessLevel: true, active: true, employmentType: true, phone: true, passwordHash: true },
  })
  if (!worker || !worker.active || worker.employmentType !== 'subcontractor') return null

  const payload = verifyContractorAccessToken(token, worker)
  if (!payload) return null
  return { worker, payload }
}

export async function GET(req: Request) {
  const token = clean(new URL(req.url).searchParams.get('token'))
  if (!token) return NextResponse.json({ valid: false }, { status: 400 })
  const result = await validateAccessToken(token)
  if (!result) return NextResponse.json({ valid: false, error: 'This link is invalid or has expired.' }, { status: 400 })
  return NextResponse.json({ valid: true, purpose: result.payload.purpose })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const token = clean(body.token)
  const password = clean(body.password)
  if (!token || password.length < 8) return NextResponse.json({ error: 'Use a password of at least 8 characters.' }, { status: 400 })

  const result = await validateAccessToken(token)
  if (!result) return NextResponse.json({ error: 'This link is invalid or has expired.' }, { status: 400 })
  const { worker, payload } = result

  const passwordHash = await bcrypt.hash(password, 12)
  await prisma.worker.update({ where: { id: worker.id }, data: { passwordHash, mustChangePassword: false, failedLoginAttempts: 0, lockedUntil: null } })

  if (payload.purpose === 'reset') {
    await prisma.$executeRaw`
      UPDATE "SubcontractorPasswordResetRequest"
      SET "status"='completed', "resolvedAt"=CURRENT_TIMESTAMP
      WHERE "workerId"=${worker.id} AND "status" IN ('pending','sent')
    `
  }

  await createSessionForWorker(worker)
  return NextResponse.json({ ok: true, redirectTo: payload.purpose === 'onboarding' ? '/contractor/agreement?next=/contractor' : '/contractor' })
}
