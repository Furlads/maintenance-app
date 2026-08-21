import type { ReactNode } from 'react'
import AdminWorkerAvatarEnhancer from './AdminWorkerAvatarEnhancer'
import AdminTrevAvatarEnhancer from './AdminTrevAvatarEnhancer'

export default function AdminTemplate({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <AdminWorkerAvatarEnhancer />
      <AdminTrevAvatarEnhancer />
    </>
  )
}
