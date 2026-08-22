import type { ReactNode } from 'react'
import PhotoUploadProgress from './PhotoUploadProgress'
import PhotoUploadQueue from './PhotoUploadQueue'
import QuoteResultPolish from './QuoteResultPolish'
import QuoteResultReadability from './QuoteResultReadability'

export default function QuoteTestLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PhotoUploadQueue />
      <QuoteResultPolish />
      <QuoteResultReadability />
      {children}
      <PhotoUploadProgress />
    </>
  )
}
