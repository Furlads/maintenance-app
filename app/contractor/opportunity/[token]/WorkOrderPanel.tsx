'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'

type WorkOrder = {
  id: number
  status: string
  agreedPrice: number | null
  completionNotes: string | null
  issuesNotes: string | null
  signoffStatus: string
  signerName: string | null
  signedAt: string | null
  snagNotes: string | null
  paymentStatus: string
  title: string
  trade: string
  publicDescription: string
  timingText: string | null
  durationText: string | null
  address: string | null
  jobNotes: string | null
  visitDate: string | null
  startTime: string | null
  customerName: string | null
  customerPhone: string | null
  customerEmail: string | null
  customerAddress: string | null
  customerPostcode: string | null
}

type Photo = { id: number; label: string | null; imageUrl: string; uploadedByWorkerId: number | null }
type Variation = { id: number; description: string; amount: number | null; status: string }

export default function WorkOrderPanel({ token }: { token: string }) {
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [variations, setVariations] = useState<Variation[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [completionNotes, setCompletionNotes] = useState('')
  const [issuesNotes, setIssuesNotes] = useState('')
  const [signerName, setSignerName] = useState('')
  const [snagNotes, setSnagNotes] = useState('')
  const [variationDescription, setVariationDescription] = useState('')
  const [variationAmount, setVariationAmount] = useState('')

  async function load() {
    const response = await fetch(`/api/contractor/opportunities/${encodeURIComponent(token)}/work-order`, { cache: 'no-store' })
    const data = await response.json()
    if (!response.ok) throw new Error(data?.error || 'Could not load work order.')
    setWorkOrder(data.workOrder || null)
    setPhotos(data.photos || [])
    setVariations(data.variations || [])
    setCompletionNotes(data.workOrder?.completionNotes || '')
    setIssuesNotes(data.workOrder?.issuesNotes || '')
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : 'Could not load work order.'))
  }, [token])

  const completionPhotos = useMemo(() => photos.filter((photo) => (photo.label || '').startsWith('Subcontractor completion')), [photos])

  async function action(payload: Record<string, unknown>) {
    try {
      setBusy(true)
      setError('')
      const response = await fetch(`/api/contractor/opportunities/${encodeURIComponent(token)}/work-order`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Could not update work order.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update work order.')
    } finally {
      setBusy(false)
    }
  }

  async function uploadPhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    try {
      setBusy(true)
      setError('')
      const response = await fetch(`/api/contractor/opportunities/${encodeURIComponent(token)}/photos`, { method: 'POST', body: data })
      const result = await response.json()
      if (!response.ok) throw new Error(result?.error || 'Could not upload photo.')
      form.reset()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload photo.')
    } finally {
      setBusy(false)
    }
  }

  if (!workOrder) return <div className="rounded-3xl bg-white p-5 text-sm font-bold text-zinc-600">{error || 'Loading your work order…'}</div>

  const signedOff = workOrder.status === 'signed_off' || workOrder.signoffStatus === 'signed'
  const awaitingSignoff = workOrder.status === 'awaiting_signoff'
  const snag = workOrder.status === 'snag'

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-[#dfe6d7] bg-white p-5 shadow-sm sm:p-6">
        <div className="text-xs font-black uppercase tracking-[0.15em] text-[#6d852f]">Accepted work order</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Info label="Customer" value={workOrder.customerName || 'See office'} />
          <Info label="Address" value={[workOrder.address || workOrder.customerAddress, workOrder.customerPostcode].filter(Boolean).join(', ') || 'See office'} />
          <Info label="Phone" value={workOrder.customerPhone || 'Not supplied'} link={workOrder.customerPhone ? `tel:${workOrder.customerPhone}` : undefined} />
          <Info label="Agreed subcontract price" value={workOrder.agreedPrice != null ? `£${workOrder.agreedPrice.toLocaleString('en-GB')}` : 'As agreed separately'} />
        </div>
        <div className="mt-4 rounded-2xl bg-zinc-50 p-4">
          <div className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Full scope / job notes</div>
          <div className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-zinc-700">{workOrder.jobNotes || workOrder.publicDescription}</div>
        </div>
      </section>

      {photos.length ? <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm"><div className="text-xs font-black uppercase tracking-wider text-zinc-500">Job photos</div><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{photos.slice(0, 12).map((photo) => <a key={photo.id} href={photo.imageUrl} target="_blank" rel="noreferrer" className="overflow-hidden rounded-2xl border border-zinc-200"><img src={photo.imageUrl} alt={photo.label || 'Job photo'} className="h-36 w-full object-cover" /></a>)}</div></section> : null}

      {!signedOff ? <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="text-xs font-black uppercase tracking-[0.15em] text-[#6d852f]">Completion evidence</div>
        <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">Upload clear finished-work photos. These become part of the permanent job record.</p>
        <form onSubmit={uploadPhoto} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="block"><span className="mb-1 block text-[10px] font-black uppercase text-zinc-500">Photo</span><input required name="file" type="file" accept="image/*" capture="environment" className="w-full text-sm" /></label>
          <label className="block"><span className="mb-1 block text-[10px] font-black uppercase text-zinc-500">What it shows</span><input name="note" className="input" placeholder="e.g. completed patio" /></label>
          <button disabled={busy} className="rounded-xl bg-[#24391b] px-4 py-3 text-sm font-black text-white disabled:opacity-50">Upload</button>
        </form>
        <div className="mt-3 text-xs font-bold text-zinc-500">Completion photos uploaded: {completionPhotos.length}</div>
      </section> : null}

      {!signedOff && !awaitingSignoff ? <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="text-xs font-black uppercase tracking-[0.15em] text-[#6d852f]">Finish the work</div>
        <div className="mt-4 grid gap-3">
          <textarea value={completionNotes} onChange={(e) => setCompletionNotes(e.target.value)} className="input min-h-24" placeholder="Completion notes (optional)" />
          <textarea value={issuesNotes} onChange={(e) => setIssuesNotes(e.target.value)} className="input min-h-20" placeholder="Anything outstanding, damaged or needing attention? Leave blank if none." />
          <button disabled={busy} onClick={() => action({ action: 'submit_completion', completionNotes, issuesNotes })} className="rounded-2xl bg-[#91b83d] px-5 py-4 font-black text-[#17220f] disabled:opacity-50">Submit job for sign-off</button>
        </div>
      </section> : null}

      {!signedOff ? <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
        <div className="text-xs font-black uppercase tracking-[0.15em] text-amber-800">Extra work / variation</div>
        <p className="mt-2 text-sm font-semibold text-amber-900">Do not just carry out chargeable extras. Request approval first.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_140px_auto]">
          <input value={variationDescription} onChange={(e) => setVariationDescription(e.target.value)} className="input" placeholder="Describe the extra work" />
          <input value={variationAmount} onChange={(e) => setVariationAmount(e.target.value)} className="input" inputMode="decimal" placeholder="£ amount" />
          <button disabled={busy || !variationDescription.trim()} onClick={() => action({ action: 'request_variation', description: variationDescription, amount: variationAmount })} className="rounded-xl bg-amber-900 px-4 py-3 text-sm font-black text-white disabled:opacity-50">Request</button>
        </div>
        {variations.length ? <div className="mt-3 space-y-2">{variations.map((variation) => <div key={variation.id} className="rounded-xl bg-white/70 p-3 text-xs font-bold text-amber-950">{variation.description}{variation.amount != null ? ` · £${variation.amount}` : ''} · {variation.status}</div>)}</div> : null}
      </section> : null}

      {awaitingSignoff ? <section className="rounded-3xl border border-green-200 bg-green-50 p-5 sm:p-6">
        <div className="text-xs font-black uppercase tracking-wider text-green-800">Customer sign-off</div>
        <p className="mt-2 text-sm font-semibold leading-6 text-green-900">Hand the phone to the customer once they have had the opportunity to look over the completed work.</p>
        <div className="mt-4 grid gap-3">
          <input value={signerName} onChange={(e) => setSignerName(e.target.value)} className="input" placeholder="Customer name" />
          <button disabled={busy || !signerName.trim()} onClick={() => action({ action: 'customer_signoff', signerName })} className="rounded-2xl bg-green-700 px-5 py-4 font-black text-white disabled:opacity-50">Customer confirms work completed</button>
          <textarea value={snagNotes} onChange={(e) => setSnagNotes(e.target.value)} className="input min-h-20" placeholder="Or describe anything that still needs attention" />
          <button disabled={busy || !snagNotes.trim()} onClick={() => action({ action: 'raise_snag', snagNotes })} className="rounded-2xl border border-amber-300 bg-white px-5 py-3 font-black text-amber-900 disabled:opacity-50">Record snag instead</button>
        </div>
      </section> : null}

      {snag ? <section className="rounded-3xl border border-amber-300 bg-amber-50 p-5"><div className="font-black text-amber-950">Snag recorded</div><p className="mt-2 text-sm font-semibold text-amber-900">{workOrder.snagNotes}</p><p className="mt-2 text-xs font-bold text-amber-800">This work order stays open until the issue is resolved and signed off.</p></section> : null}

      {signedOff ? <section className="rounded-3xl border border-green-200 bg-green-50 p-5"><div className="text-xl font-black text-green-900">Work signed off ✓</div><p className="mt-2 text-sm font-semibold text-green-800">Signed by {workOrder.signerName || 'customer'}. The office can now approve the subcontractor payment.</p></section> : null}

      {error ? <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div> : null}
      <style jsx>{`.input{width:100%;border:1px solid #d8dfd3;background:#fff;border-radius:12px;padding:11px 12px;color:#1f2a1b;font:inherit;font-size:14px;font-weight:650;outline:none;box-sizing:border-box}.input:focus{border-color:#9fbe55;box-shadow:0 0 0 3px rgba(159,190,85,.14)}`}</style>
    </div>
  )
}

function Info({ label, value, link }: { label: string; value: string; link?: string }) {
  const content = link ? <a href={link} className="font-black text-[#476421] underline">{value}</a> : <div className="font-black">{value}</div>
  return <div className="rounded-2xl bg-[#f4f7f0] p-4"><div className="text-[10px] font-black uppercase tracking-wider text-zinc-500">{label}</div><div className="mt-1 text-sm">{content}</div></div>
}
