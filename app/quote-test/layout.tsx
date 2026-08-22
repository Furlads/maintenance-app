import type { ReactNode } from 'react'
import PhotoUploadProgress from './PhotoUploadProgress'
import PhotoUploadQueue from './PhotoUploadQueue'
import PhotoStripCollapse from './PhotoStripCollapse'
import QuoteDraftAutosave from './QuoteDraftAutosave'
import QuoteResultPolish from './QuoteResultPolish'
import QuoteResultReadability from './QuoteResultReadability'
import QuoteWorkingStatus from './QuoteWorkingStatus'
import SafeLibraryPhotoPreparation from './SafeLibraryPhotoPreparation'

export default function QuoteTestLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SafeLibraryPhotoPreparation />
      <PhotoUploadQueue />
      <QuoteDraftAutosave />
      <QuoteResultPolish />
      <QuoteResultReadability />
      <QuoteWorkingStatus />
      <PhotoStripCollapse />
      {children}
      <PhotoUploadProgress />
    </>
  )
}
