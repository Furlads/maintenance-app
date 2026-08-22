import type { ReactNode } from 'react'
import PhotoUploadProgress from './PhotoUploadProgress'
import PhotoUploadQueue from './PhotoUploadQueue'
import PhotoStripCollapse from './PhotoStripCollapse'
import QuoteResultPolish from './QuoteResultPolish'
import QuoteResultReadability from './QuoteResultReadability'
import QuoteWorkingStatus from './QuoteWorkingStatus'

export default function QuoteTestLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PhotoUploadQueue />
      <QuoteResultPolish />
      <QuoteResultReadability />
      <QuoteWorkingStatus />
      <PhotoStripCollapse />
      {children}
      <PhotoUploadProgress />
    </>
  )
}
