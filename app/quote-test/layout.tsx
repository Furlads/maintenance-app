import type { ReactNode } from 'react'
import QuoteDraftAutosave from './QuoteDraftAutosave'
import QuoteResultPolish from './QuoteResultPolish'
import QuoteResultReadability from './QuoteResultReadability'
import QuoteWorkingStatus from './QuoteWorkingStatus'

export default function QuoteTestLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <QuoteDraftAutosave />
      <QuoteResultPolish />
      <QuoteResultReadability />
      <QuoteWorkingStatus />
      {children}
    </>
  )
}
