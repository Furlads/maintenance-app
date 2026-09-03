'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

type Props = {
  quoteId: number
  currentStatus: string
  jobId: number | null
  sentAt: string | null
  acceptedAt: string | null
  declinedAt: string | null
}

const STATUSES = [
  { key: 'ready_to_send', label: 'Ready to send', className: 'border-yellow-300 bg-yellow-50 text-yellow-900' },
  { key: 'sent', label: 'Quote sent', className: 'border-blue-300 bg-blue-50 text-blue-800' },
  { key: 'accepted', label: 'Accepted', className: 'border-green-300 bg-green-50 text-green-800' },
  { key: 'declined', label: 'Declined', className: 'border-red-300 bg-red-50 text-red-800' },
]

function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function addDays(value: string | null, days: number) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

export default function QuoteStatusControls({
  quoteId,
  currentStatus,
  jobId,
  sentAt,
  acceptedAt,
  declinedAt,
}: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const noReplyDate = useMemo(() => addDays(sentAt, 30), [sentAt])

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
      <div>
        <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Quote status</div>
        <h2 className="mt-1 text-xl font-black leading-tight text-zinc-950">What has happened with the customer?</h2>
        <p className="mt-1 text-sm leading-5 text-zinc-600">
          Customer status is the source of truth — a planning job does not mean the quote is accepted.
        </p>
        {jobId && currentStatus !== 'accepted' ? (
          <p className="mt-2 text-xs font-bold text-amber-700">Job #{jobId} exists for planning only.</p>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-4">
        {STATUSES.map((status) => {
          const active = currentStatus === status.key
          const locked = currentStatus === 'accepted' && status.key !== 'accepted'
          return (
            <button
              key={status.key}
              type="button"
              onClick={() => void setStatus(status.key)}
              disabled={Boolean(busy) || active || locked}
              className={`min-h-14 rounded-xl border px-3 py-2 text-left text-sm font-black shadow-sm disabled:cursor-default ${status.className} ${active ? 'ring-2 ring-zinc-900 ring-offset-1' : ''} ${locked ? 'opacity-35' : 'disabled:opacity-70'}`}
            >
              <div className="leading-tight">{busy === status.key ? 'Updating…' : active ? `✓ ${status.label}` : status.label}</div>
              <div className="mt-0.5 text-[11px] font-semibold opacity-70">
                {status.key === 'sent' && sentAt ? formatDate(sentAt) : ''}
                {status.key === 'accepted' && acceptedAt ? formatDate(acceptedAt) : ''}
                {status.key === 'declined' && declinedAt ? formatDate(declinedAt) : ''}
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-zinc-200 pt-3 text-xs font-semibold text-zinc-500">
        <span>Sent: <strong className="text-zinc-800">{formatDate(sentAt)}</strong></span>
        <span>No reply: <strong className="text-zinc-800">{formatDate(noReplyDate)}</strong></span>
        {(acceptedAt || declinedAt) ? (
          <span>Resolved: <strong className="text-zinc-800">{formatDate(acceptedAt || declinedAt)}</strong></span>
        ) : null}
      </div>

      {error ? <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</div> : null}
    </section>
  )
}
