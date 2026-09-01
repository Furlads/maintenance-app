'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'

type Recipient = {
  recipientId: number
  opportunityId: number
  workerId: number
  workerName: string
  status: string
  fixedPrice: number | null
  pricingMode: string
}

type StatusPayload = {
  jobId: number
  overallStatus: string
  recipients: Recipient[]
}

function labelForStatus(value: string) {
  if (value === 'accepted') return 'Subcontractor accepted'
  if (value === 'interested') return 'Subcontractor interested'
  if (value === 'awaiting_response') return 'Awaiting subcontractor response'
  if (value === 'declined') return 'Subcontractor declined'
  if (value === 'awaiting_signoff') return 'Awaiting subcontractor sign-off'
  if (value === 'snag') return 'Subcontractor snag open'
  if (value === 'signed_off') return 'Subcontractor signed off'
  if (value === 'paid') return 'Subcontractor paid'
  return 'No subcontractor offer sent'
}

function classForStatus(value: string) {
  if (['accepted', 'signed_off', 'paid'].includes(value)) return 'border-green-200 bg-green-50 text-green-900'
  if (value === 'snag') return 'border-amber-300 bg-amber-50 text-amber-950'
  if (value === 'declined') return 'border-red-200 bg-red-50 text-red-800'
  if (['interested', 'awaiting_response', 'awaiting_signoff'].includes(value)) return 'border-blue-200 bg-blue-50 text-blue-900'
  return 'border-zinc-200 bg-white text-zinc-800'
}

export default function JobSubcontractorControl() {
  const pathname = usePathname()
  const jobId = useMemo(() => {
    const match = pathname.match(/^\/jobs\/(\d+)\/?$/)
    if (!match) return null
    const parsed = Number(match[1])
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null
  }, [pathname])

  const [data, setData] = useState<StatusPayload | null>(null)

  useEffect(() => {
    if (!jobId) {
      setData(null)
      return
    }

    let cancelled = false
    fetch(`/api/admin/subcontractor-opportunities/job/${jobId}`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return null
        return response.json()
      })
      .then((payload) => {
        if (!cancelled) setData(payload)
      })
      .catch(() => {
        if (!cancelled) setData(null)
      })

    return () => {
      cancelled = true
    }
  }, [jobId])

  if (!jobId) return null

  const status = data?.overallStatus || 'not_offered'
  const acceptedNames = (data?.recipients || []).filter((item) => item.status === 'accepted').map((item) => item.workerName)

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(12px,env(safe-area-inset-bottom))] z-[70] px-3 sm:px-5">
      <div className={`pointer-events-auto mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border p-3 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:justify-between ${classForStatus(status)}`}>
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.15em] opacity-70">Subcontractor</div>
          <div className="mt-1 text-sm font-black">{labelForStatus(status)}</div>
          {acceptedNames.length ? <div className="mt-1 truncate text-xs font-semibold opacity-80">{acceptedNames.join(', ')}</div> : null}
        </div>
        <Link href={`/admin/subcontractors/new?jobId=${jobId}`} className="inline-flex min-h-11 flex-none items-center justify-center rounded-xl bg-zinc-950 px-4 text-sm font-black text-white">
          {status === 'not_offered' || status === 'declined' ? 'Offer to subcontractor' : 'Manage subcontractor'}
        </Link>
      </div>
    </div>
  )
}
