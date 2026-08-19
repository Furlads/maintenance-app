'use client'

import { useState } from 'react'

type Variation = {
  id: string
  request: string
  requestedBy: string
  requestedAt: string
  status: 'pending' | 'agreed' | 'declined'
  agreedPriceExVat: number | null
  customerAgreed: boolean
  agreementNote: string
}

type Props = {
  jobId: number
  initialVariations: Variation[]
}

export default function VariationApprovalPanel({ jobId, initialVariations }: Props) {
  const [variations, setVariations] = useState(initialVariations)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  function update(id: string, patch: Partial<Variation>) {
    setVariations((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item))
    setMessage('')
  }

  async function save() {
    try {
      setSaving(true)
      setError('')
      setMessage('')
      const response = await fetch(`/api/landscaping/jobs/${jobId}/controls`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variations }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Could not save variations.')
      setVariations(data.controls?.variations || variations)
      setMessage('Variation decisions saved — worker sheet updated.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save variations.')
    } finally {
      setSaving(false)
    }
  }

  if (!variations.length) return null

  return (
    <section className="rounded-3xl border border-purple-200 bg-purple-50 p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.16em] text-purple-700">Customer variations</div>
          <h2 className="mt-1 text-xl font-black text-purple-950">Price and agree extras before the lads do them</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-purple-900">
            Pending extras stay blocked on the worker sheet. Record the agreed price and confirm the customer has accepted it before changing the status to agreed.
          </p>
        </div>
        <button type="button" onClick={() => void save()} disabled={saving} className="min-h-11 rounded-xl bg-purple-900 px-4 text-sm font-black text-white disabled:opacity-50">
          {saving ? 'Saving…' : 'Save variations'}
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {variations.map((variation) => (
          <div key={variation.id} className="rounded-2xl bg-white p-4 ring-1 ring-inset ring-purple-200">
            <div className="font-black text-zinc-950">{variation.request}</div>
            <div className="mt-1 text-xs text-zinc-500">Submitted by {variation.requestedBy || 'worker'}</div>
            <div className="mt-3 grid gap-3 lg:grid-cols-[160px_180px_1fr]">
              <label className="text-xs font-bold text-zinc-600">
                Status
                <select value={variation.status} onChange={(event) => update(variation.id, { status: event.target.value as Variation['status'] })} className="mt-1 min-h-10 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm font-bold">
                  <option value="pending">Pending — do not start</option>
                  <option value="agreed">Agreed</option>
                  <option value="declined">Declined</option>
                </select>
              </label>
              <label className="text-xs font-bold text-zinc-600">
                Agreed price ex VAT
                <input type="number" min="0" step="0.01" value={variation.agreedPriceExVat ?? ''} onChange={(event) => update(variation.id, { agreedPriceExVat: event.target.value === '' ? null : Number(event.target.value) })} className="mt-1 min-h-10 w-full rounded-xl border border-zinc-300 px-3 text-sm" />
              </label>
              <label className="text-xs font-bold text-zinc-600">
                Agreement note
                <input value={variation.agreementNote} onChange={(event) => update(variation.id, { agreementNote: event.target.value })} placeholder="e.g. Customer agreed by WhatsApp on 19 Aug" className="mt-1 min-h-10 w-full rounded-xl border border-zinc-300 px-3 text-sm" />
              </label>
            </div>
            <label className="mt-3 flex items-start gap-3 rounded-xl bg-purple-50 px-3 py-3 text-sm font-bold text-purple-950">
              <input type="checkbox" checked={variation.customerAgreed} onChange={(event) => update(variation.id, { customerAgreed: event.target.checked })} className="mt-0.5 h-5 w-5" />
              <span>Customer has agreed the extra and the price before work starts</span>
            </label>
            {variation.status === 'agreed' && (!variation.customerAgreed || variation.agreedPriceExVat == null) ? (
              <div className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-black text-amber-900">Agreed status is incomplete until both the price and customer agreement are recorded.</div>
            ) : null}
          </div>
        ))}
      </div>
      {message ? <div className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-sm font-bold text-green-800">{message}</div> : null}
      {error ? <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-800">{error}</div> : null}
    </section>
  )
}
