import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function clean(value: unknown) { return typeof value === 'string' ? value.trim() : '' }
function isAdmin(role?: string | null) { return ['admin', 'office', 'manager', 'owner'].includes(clean(role).toLowerCase()) }
function digits(value: string) { return value.replace(/\D/g, '') }
function whatsappPhone(value: string) {
  const raw = clean(value)
  if (!raw) return ''
  if (raw.startsWith('+44')) return digits(raw)
  const d = digits(raw)
  return d.startsWith('0') ? `44${d.slice(1)}` : d
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
  if (!isAdmin(session.role)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const workerId = Number(body.workerId)
  if (!Number.isInteger(workerId) || workerId <= 0) return NextResponse.json({ error: 'Invalid subcontractor.' }, { status: 400 })

  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    select: { id: true, firstName: true, phone: true, employmentType: true, active: true },
  })
  if (!worker || !worker.active || worker.employmentType !== 'subcontractor') {
    return NextResponse.json({ error: 'Subcontractor not found.' }, { status: 404 })
  }
  if (!clean(worker.phone)) return NextResponse.json({ error: 'Add a mobile number before sending onboarding.' }, { status: 400 })

  const token = crypto.randomBytes(24).toString('hex')
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

  await prisma.$executeRaw`
    INSERT INTO "SubcontractorOnboardingInvite" ("workerId", "token", "expiresAt")
    VALUES (${worker.id}, ${token}, ${expiresAt})
  `

  const origin = new URL(req.url).origin
  const url = `${origin}/contractor/onboarding/${token}`
  const message = `Hi ${worker.firstName}, your Furlads subcontractor application has been approved. Set up your account and accept the subcontractor agreement here: ${url}`
  const wa = `https://wa.me/${whatsappPhone(worker.phone || '')}?text=${encodeURIComponent(message)}`

  return NextResponse.json({ ok: true, url, whatsappUrl: wa })
}
