'use client'

import { useState } from 'react'

export default function OpportunityActions({ token, initialStatus }: { token: string; initialStatus: string }) {
  const [status, setStatus] = useState(initialStatus)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function respond(action: 'interested' | 'decline' | 'accept') {
    try {
      setBusy(true)
      setError('')
      const response = await fetch(`/api/contractor/opportunities/${encodeURIComponent(token)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Could not save your response.')
      setStatus(data.status)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your response.')
    } finally {
      setBusy(false)
    }
  }

  if (status === 'declined') {
    return <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm font-bold text-zinc-600">Thanks — we’ve recorded that this one isn’t for you.</div>
  }

  if (status === 'accepted') {
    return <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-800">Accepted ✓ We’ve recorded your acceptance against this opportunity.</div>
  }

  if (status === 'interested') {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-800">Interest recorded ✓</div>
        <button disabled={busy} onClick={() => respond('accept')} className="w-full rounded-2xl bg-[#91b83d] px-5 py-4 font-black text-[#17220f] disabled:opacity-60">Accept this opportunity</button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <button disabled={busy} onClick={() => respond('interested')} className="rounded-2xl bg-[#91b83d] px-5 py-4 font-black text-[#17220f] disabled:opacity-60">I’m interested</button>
        <button disabled={busy} onClick={() => respond('decline')} className="rounded-2xl border border-zinc-300 bg-white px-5 py-4 font-black text-zinc-700 disabled:opacity-60">Not for me</button>
      </div>
      {error ? <div className="text-sm font-bold text-red-700">{error}</div> : null}
    </div>
  )
}
