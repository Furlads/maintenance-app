'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function AddCompletedQuote({
  jobId,
  initialScope,
  initialDays,
  initialTeamSize,
}: {
  jobId: number
  initialScope: string
  initialDays: number
  initialTeamSize: number
}) {
  const router = useRouter()
  const [scope, setScope] = useState(initialScope)
  const [priceExVat, setPriceExVat] = useState('')
  const [estimatedDays, setEstimatedDays] = useState(String(initialDays))
  const [estimatedTeamSize, setEstimatedTeamSize] = useState(String(initialTeamSize))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setBusy(true)
      setError('')
      setMessage('')

      const response = await fetch(`/api/landscaping/jobs/${jobId}/completed-quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope,
          priceExVat: Number(priceExVat),
          estimatedDays: Number(estimatedDays),
          estimatedTeamSize: Number(estimatedTeamSize),
        }),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || 'Could not add the completed quote.')
      }

      setMessage(data?.planningWarning || 'Quote linked and worker job sheet created successfully.')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the completed quote.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
      <h2 className="text-xl font-black text-amber-950">Add the completed quote</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-amber-900">
        Use this when the quote was already prepared outside the app. It will be attached to this job and used to create the worker job sheet.
      </p>

      <form onSubmit={submit} className="mt-5 space-y-4">
        <div>
          <label className="mb-2 block text-sm font-black text-amber-950">Agreed work / quote details</label>
          <textarea value={scope} onChange={(event) => setScope(event.target.value)} required rows={6} className="w-full rounded-xl border border-amber-300 bg-white px-3 py-3 text-sm leading-6 text-zinc-900" />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-black text-amber-950">Price before VAT (£)</label>
            <input type="number" min="0.01" step="0.01" value={priceExVat} onChange={(event) => setPriceExVat(event.target.value)} required className="min-h-12 w-full rounded-xl border border-amber-300 bg-white px-3 text-sm text-zinc-900" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-black text-amber-950">Estimated working days</label>
            <input type="number" min="0.5" step="0.5" value={estimatedDays} onChange={(event) => setEstimatedDays(event.target.value)} required className="min-h-12 w-full rounded-xl border border-amber-300 bg-white px-3 text-sm text-zinc-900" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-black text-amber-950">Workers needed</label>
            <input type="number" min="1" step="1" value={estimatedTeamSize} onChange={(event) => setEstimatedTeamSize(event.target.value)} required className="min-h-12 w-full rounded-xl border border-amber-300 bg-white px-3 text-sm text-zinc-900" />
          </div>
        </div>

        {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</div> : null}
        {message ? <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">{message}</div> : null}

        <button type="submit" disabled={busy} className="min-h-12 rounded-xl bg-zinc-950 px-5 text-sm font-black text-white disabled:opacity-50">
          {busy ? 'Adding quote and creating job sheet…' : 'Add quote and create worker job sheet'}
        </button>
      </form>
    </section>
  )
}
