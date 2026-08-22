import type { ReactNode } from 'react'
import PhotoUploadProgress from './PhotoUploadProgress'
import PhotoUploadQueue from './PhotoUploadQueue'

export default function QuoteTestLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PhotoUploadQueue />
      {children}
      <PhotoUploadProgress />
    </>
  )
}
