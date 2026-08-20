'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  jobId: number
  opportunityId: string
  quoteId: number | null
  status: 'open' | 'quote_created' | 'dismissed'
}

export default function OpportunityActions({ jobId, opportunityId, quoteId, status }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function act(action: 'create_quote' | 'dismiss' | 'reopen') {
    try {
      setBusy(true)
      setError('')
      const response = await fetch(`/api/maintenance/opportunities/${jobId}/${encodeURIComponent(opportunityId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Could not update opportunity.')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update opportunity.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {!quoteId && status !== 'dismissed' ? (
        <button type="button" onClick={() => void act('create_quote')} disabled={busy} className="rounded-xl bg-zinc-950 px-3 py-2 text-xs font-black text-white disabled:opacity-50">Create quote draft</button>
      ) : null}
      {status !== 'dismissed' ? (
        <button type="button" onClick={() => void act('dismiss')} disabled={busy} className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-black text-zinc-700 disabled:opacity-50">Dismiss</button>
      ) : (
        <button type="button" onClick={() => void act('reopen')} disabled={busy} className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-black text-amber-900 disabled:opacity-50">Reopen</button>
      )}
      {error ? <div className="w-full text-xs font-bold text-red-700">{error}</div> : null}
    </div>
  )
}
