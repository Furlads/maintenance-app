'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type AssignmentStatus = 'not_linked' | 'confirmed' | 'transport_required' | null

export default function OpportunityActions({ token, initialStatus }: { token: string; initialStatus: string }) {
  const router = useRouter()
  const [status, setStatus] = useState(initialStatus)
  const [assignmentStatus, setAssignmentStatus] = useState<AssignmentStatus>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [counterOffer, setCounterOffer] = useState('')
  const [counterOfferNotes, setCounterOfferNotes] = useState('')
  const [declineReason, setDeclineReason] = useState('Unavailable')
  const [proposedCrewSize, setProposedCrewSize] = useState('1')
  const [attendeeNotes, setAttendeeNotes] = useState('')

  async function respond(action: 'interested' | 'counter' | 'decline' | 'confirm') {
    try {
      setBusy(true)
      setError('')
      const response = await fetch(`/api/contractor/opportunities/${encodeURIComponent(token)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, counterOffer, counterOfferNotes, declineReason, proposedCrewSize, attendeeNotes }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Could not save your response.')
      setStatus(data.status)
      setAssignmentStatus(data.assignmentStatus ?? null)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your response.')
    } finally {
      setBusy(false)
    }
  }

  if (status === 'declined') {
    return <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm font-bold text-zinc-600">Thanks — we’ve recorded that this one isn’t for you.</div>
  }

  if (status === 'expired' || status === 'not_selected') {
    return <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm font-bold text-zinc-600">This opportunity is no longer open to you.</div>
  }

  if (status === 'accepted') {
    if (assignmentStatus === 'transport_required') {
      return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">Confirmed ✓ Your work order is unlocked, but the diary booking will only become confirmed once transport is arranged.</div>
    }
    return <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-800">Work confirmed ✓ Your full work order is open below.</div>
  }

  if (status === 'awarded') {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-900">🎉 Furlads has awarded this work to you. Please confirm you can take it on.</div>
        <button disabled={busy} onClick={() => respond('confirm')} className="w-full rounded-2xl bg-[#91b83d] px-5 py-4 font-black text-[#17220f] disabled:opacity-60">Confirm & open work order</button>
        {error ? <div className="text-sm font-bold text-red-700">{error}</div> : null}
      </div>
    )
  }

  if (status === 'interested' || status === 'countered') {
    return <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-900">{status === 'countered' ? 'Counter-price sent ✓' : 'Interest recorded ✓'} The office will review the responses and confirm separately if the work is awarded to you.</div>
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-zinc-50 p-4">
        <div className="text-xs font-black uppercase tracking-wide text-zinc-500">If interested, who would attend?</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-bold text-zinc-700">Crew size<input type="number" min="1" value={proposedCrewSize} onChange={(e) => setProposedCrewSize(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-3" /></label>
          <label className="text-sm font-bold text-zinc-700">Who would attend?<input value={attendeeNotes} onChange={(e) => setAttendeeNotes(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-3" placeholder="e.g. me + labourer" /></label>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button disabled={busy} onClick={() => respond('interested')} className="rounded-2xl bg-[#91b83d] px-5 py-4 font-black text-[#17220f] disabled:opacity-60">I’m interested</button>
        <button disabled={busy} onClick={() => respond('decline')} className="rounded-2xl border border-zinc-300 bg-white px-5 py-4 font-black text-zinc-700 disabled:opacity-60">Not for me</button>
      </div>

      <div className="rounded-2xl border border-zinc-200 p-4">
        <div className="text-sm font-black text-zinc-900">Need a different price?</div>
        <p className="mt-1 text-xs font-semibold text-zinc-500">Send a counter-price instead of declining.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[.4fr_.6fr]">
          <input value={counterOffer} onChange={(e) => setCounterOffer(e.target.value)} className="rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm font-bold" inputMode="decimal" placeholder="£" />
          <input value={counterOfferNotes} onChange={(e) => setCounterOfferNotes(e.target.value)} className="rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm font-semibold" placeholder="What does your price cover?" />
        </div>
        <button disabled={busy || !counterOffer} onClick={() => respond('counter')} className="mt-3 w-full rounded-xl border border-[#91b83d] bg-[#f4f8e9] px-4 py-3 text-sm font-black text-[#405820] disabled:opacity-50">Send counter-price</button>
      </div>

      <label className="block text-sm font-bold text-zinc-700">If declining, reason<select value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-3"><option>Unavailable</option><option>Too far away</option><option>Price too low</option><option>Wrong type of work</option><option>Timing does not work</option><option>Other</option></select></label>
      {error ? <div className="text-sm font-bold text-red-700">{error}</div> : null}
    </div>
  )
}
