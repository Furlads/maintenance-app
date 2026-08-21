import type { ReactNode } from 'react'
import AdminWorkerAvatarEnhancer from './AdminWorkerAvatarEnhancer'

export default function AdminTemplate({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <AdminWorkerAvatarEnhancer />
    </>
  )
}
