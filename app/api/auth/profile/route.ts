import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const AVATARS: Array<{ match: RegExp; src: string }> = [
  { match: /trevor|trev/i, src: '/uploads/1772185991845-trevor.jpg' },
  { match: /kelly/i, src: '/uploads/1772186026876-kelly.jpg' },
  { match: /steve/i, src: '/uploads/1772185852194-steve.jpg' },
  { match: /jacob/i, src: '/uploads/1772185925962-jacob.jpg' },
]

export async function GET() {
  const session = await getSession()

  if (!session?.workerId) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const name = String(session.workerName || '').trim() || `Worker #${session.workerId}`
  const avatar = AVATARS.find((item) => item.match.test(name))?.src || null

  return NextResponse.json({
    ok: true,
    workerId: Number(session.workerId),
    name,
    role: String(session.role || ''),
    avatar,
  })
}
