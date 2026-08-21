import type { ReactNode } from "react"
import WorkerHomeCleanup from "./WorkerHomeCleanup"

export default function WorkerHomeLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <WorkerHomeCleanup />
    </>
  )
}
