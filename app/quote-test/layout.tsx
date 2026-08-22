import type { ReactNode } from 'react'
import QuoteDraftAutosave from './QuoteDraftAutosave'
import QuoteResultPolish from './QuoteResultPolish'
import QuoteResultReadability from './QuoteResultReadability'
import QuoteWorkingStatus from './QuoteWorkingStatus'

export default function QuoteTestLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        /* Keep uploaded site photos available without letting them dominate the
           mobile quote screen. This is CSS-only so it cannot interfere with
           React's upload state. */
        footer > div > div.mb-3.flex.gap-2.overflow-x-auto {
          gap: 6px !important;
          margin-bottom: 8px !important;
          padding-bottom: 0 !important;
          max-height: 48px;
        }

        footer > div > div.mb-3.flex.gap-2.overflow-x-auto > div {
          width: 44px !important;
          height: 44px !important;
          border-radius: 10px !important;
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
      {children}
    </>
  )
}
