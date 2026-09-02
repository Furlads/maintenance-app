'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Props = {
  quoteId: number
  currentStatus: string
  jobId: number | null
}

const STATUSES = [
  { key: 'ready_to_send', label: 'Ready to send', className: 'border-yellow-300 bg-yellow-50 text-yellow-900' },
  { key: 'sent', label: 'Quote sent', className: 'border-blue-300 bg-blue-50 text-blue-800' },
  { key: 'accepted', label: 'Quote accepted', className: 'border-green-300 bg-green-50 text-green-800' },
  { key: 'declined', label: 'Quote declined', className: 'border-red-300 bg-red-50 text-red-800' },
]

export default function QuoteStatusControls({ quoteId, currentStatus, jobId }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  async function setStatus(status: string) {
    if (busy || status === currentStatus) return
    if (currentStatus === 'accepted' && status !== 'accepted') return

    try {
      setBusy(status)
      setError('')

      if (status === 'accepted') {
        const response = await fetch(`/api/quotes/${quoteId}/accept`, { method: 'POST' })
        const data = await response.json().catch(() => null)
        if (!response.ok || !data?.ok) throw new Error(data?.error || 'Could not mark quote as accepted.')
      } else {
        const response = await fetch(`/api/quotes/${quoteId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        })
        const data = await response.json().catch(() => null)
        if (!response.ok || !data?.ok) throw new Error(data?.error || `Could not mark quote as ${status.replaceAll('_', ' ')}.`)
      }

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update quote status.')
    } finally {
      setBusy('')
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Quote status</div>
          <h2 className="mt-1 text-lg font-black text-zinc-950">Update what has happened with the customer</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600">
            These buttons are the source of truth. Creating or linking a planning job does not mean the customer has accepted the quotation.
          </p>
          {jobId && currentStatus !== 'accepted' ? (
            <p className="mt-2 text-xs font-bold text-amber-700">Job #{jobId} exists for planning, but this quote is not accepted until “Quote accepted” is pressed.</p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUSES.map((status) => {
            const active = currentStatus === status.key
            const locked = currentStatus === 'accepted' && status.key !== 'accepted'
            return (
              <button
                key={status.key}
                type="button"
                onClick={() => void setStatus(status.key)}
                disabled={Boolean(busy) || active || locked}
                className={`min-h-11 rounded-xl border px-4 text-sm font-black disabled:cursor-default ${status.className} ${active ? 'ring-2 ring-zinc-900 ring-offset-2' : ''} ${locked ? 'opacity-35' : 'disabled:opacity-70'}`}
              >
                {busy === status.key ? 'Updating…' : active ? `✓ ${status.label}` : status.label}
              </button>
            )
          })}
        </div>
      </div>
      {error ? <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</div> : null}
    </section>
  )
}
