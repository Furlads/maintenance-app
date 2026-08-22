import type { ReactNode } from 'react'
import PhotoUploadProgress from './PhotoUploadProgress'
import PhotoUploadQueue from './PhotoUploadQueue'
import QuoteResultPolish from './QuoteResultPolish'

export default function QuoteTestLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PhotoUploadQueue />
      <QuoteResultPolish />
      {children}
      <PhotoUploadProgress />
    </>
  )
}
