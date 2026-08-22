import type { ReactNode } from 'react'
import PhotoUploadProgress from './PhotoUploadProgress'

export default function QuoteTestLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <PhotoUploadProgress />
    </>
  )
}
