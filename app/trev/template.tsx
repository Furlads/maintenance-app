import type { ReactNode } from 'react'
import TrevWorkerAvatarEnhancer from './TrevWorkerAvatarEnhancer'

export default function TrevTemplate({ children }: { children: ReactNode }) {
  return (
    <>
      <TrevWorkerAvatarEnhancer />
      {children}
    </>
  )
}
