import type { ReactNode } from 'react'
import TrevWorkerAvatarEnhancer from './TrevWorkerAvatarEnhancer'

// Deployment nudge: keep this template on the latest main build.
export default function TrevTemplate({ children }: { children: ReactNode }) {
  return (
    <>
      <TrevWorkerAvatarEnhancer />
      {children}
    </>
  )
}
