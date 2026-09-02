import type { ReactNode } from 'react'
import QuoteDraftAutosave from './QuoteDraftAutosave'
import QuoteResultPolish from './QuoteResultPolish'
import QuoteResultReadability from './QuoteResultReadability'
import QuoteWorkingStatus from './QuoteWorkingStatus'
import IPhonePhotoPickerFix from './IPhonePhotoPickerFix'
import PhotoUploadQueue from './PhotoUploadQueue'
import SafeLibraryPhotoPreparation from './SafeLibraryPhotoPreparation'

export default function QuoteTestLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        /* Keep photo feedback visible only while it is useful. Ready photos stay
           attached in React state and are still sent to CHAS, but their cards
           disappear from the composer so they do not take over the screen. */
        footer > div > div.mb-3.flex.gap-2.overflow-x-auto {
          gap: 6px !important;
          margin-bottom: 6px !important;
          padding-bottom: 0 !important;
          max-height: 48px;
        }

        footer > div > div.mb-3.flex.gap-2.overflow-x-auto > div {
          width: 44px !important;
          height: 44px !important;
          border-radius: 10px !important;
        }

        footer > div > div.mb-3.flex.gap-2.overflow-x-auto > div:has(> div[class*="bg-green-700"]) {
          display: none !important;
        }

        footer > div > div.mb-3.flex.gap-2.overflow-x-auto > div > button {
          width: 18px !important;
          height: 18px !important;
          right: 2px !important;
          top: 2px !important;
          font-size: 10px !important;
        }

        footer > div > div.mb-3.flex.gap-2.overflow-x-auto > div > div {
          padding-top: 1px !important;
          padding-bottom: 1px !important;
          font-size: 7px !important;
          line-height: 9px !important;
        }

        @media (max-width: 640px) {
          section.flex-1.overflow-y-auto {
            padding-top: 12px !important;
            padding-bottom: 12px !important;
          }

          section.flex-1.overflow-y-auto .whitespace-pre-wrap {
            max-width: 96% !important;
          }
        }
      `}</style>
      <QuoteDraftAutosave />
      <QuoteResultPolish />
      <QuoteResultReadability />
      <QuoteWorkingStatus />
      <SafeLibraryPhotoPreparation />
      <PhotoUploadQueue />
      <IPhonePhotoPickerFix />
      {children}
    </>
  )
}
