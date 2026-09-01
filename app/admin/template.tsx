import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import AdminWorkerAvatarEnhancer from './AdminWorkerAvatarEnhancer'
import AdminTrevAvatarEnhancer from './AdminTrevAvatarEnhancer'

export const dynamic = 'force-dynamic'

function normalise(value: string | null | undefined) {
  return String(value || '').trim().toLowerCase()
}

function isAdminLike(session: { workerName?: string | null; role?: string | null }) {
  const role = normalise(session.role)
  const name = normalise(session.workerName)
  return ['admin', 'office', 'manager', 'owner', 'trev'].includes(role)
    || name === 'trevor fudger'
    || name === 'trev fudger'
}

export default async function AdminTemplate({ children }: { children: ReactNode }) {
  const session = await getSession()

  if (!session) redirect('/login')
  if (!isAdminLike(session)) redirect('/worker/home')

  return (
    <>
      {children}
      <AdminWorkerAvatarEnhancer />
      <AdminTrevAvatarEnhancer />
    </>
  )
}
