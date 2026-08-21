import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function normalise(value: string | null | undefined) {
  return String(value || '').trim().toLowerCase()
}

function isTrevSession(session: { workerName?: string | null; role?: string | null }) {
  const workerName = normalise(session.workerName)
  const role = normalise(session.role)

  return workerName === 'trevor fudger' || workerName === 'trev fudger' || role === 'trev'
}

function isAdminLikeRole(role: string | null | undefined) {
  return ['admin', 'office', 'manager', 'owner'].includes(normalise(role))
}

export default async function HomePage() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  if (isTrevSession(session)) {
    redirect('/trev')
  }

  if (isAdminLikeRole(session.role)) {
    redirect('/admin')
  }

  redirect('/worker/home')
}
