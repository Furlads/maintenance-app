'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type WorkOrder = {
  id: number
  status: string
  agreedPrice: number | null
  paymentStatus: string
  signoffStatus: string
  signerName: string | null
  signedAt: string | null
  snagNotes: string | null
  completionNotes: string | null
  issuesNotes: string | null
  firstName: string
  lastName: string
  tradingName: string | null
  cisVerified: boolean
  cisDeductionRate: number | null
  cisDeductionAmount: number | null
  netPayable: number | null
  publicLiabilityExpiresAt: string | null
  title: string
  trade: string
  company: string
  roughArea: string
  customerName: string | null
  address: string | null
  approvedVariations: number | string
}

type Variation = {
  id: number
  workOrderId: number
  description: string
  amount: number | null
  firstName: string
  lastName: string
  title: string
}

export default function SubcontractorWorkOrdersPage() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [variations, setVariations] = useState<Variation[]>([])
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')

  async function load() {
    const response = await fetch('/api/admin/subcontractor-work-orders', { cache: 'no-store' })
    const data = await response.json()
    if (!response.ok) throw new Error(data?.error || 'Could not load subcontractor work orders.')
    setWorkOrders(data.workOrders || [])
    setVariations(data.variations || [])
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : 'Could not load work orders.'))
  }, [])

  async function act(payload: Record<string, unknown>, key: string) {
    try {
      setBusyId(key)
      setError('')
      const response = await fetch('/api/admin/subcontractor-work-orders', {
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
      setBusyId('')
    }
  }

  const stats = useMemo(() => ({
    awaiting: workOrders.filter((item) => item.status === 'awaiting_signoff').length,
    snags: workOrders.filter((item) => item.status === 'snag').length,
    payment: workOrders.filter((item) => item.status === 'approved' && item.paymentStatus === 'pending').length,
    paid: workOrders.filter((item) => item.paymentStatus === 'paid').length,
  }), [workOrders])

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><Link href="/admin/subcontractors" className="text-sm font-black text-zinc-500">← Subcontractors</Link><h1 className="mt-1 text-3xl font-black tracking-tight">Work orders & sign-off</h1></div>
        <Link href="/admin/subcontractors/new" className="rounded-2xl bg-[#a8ca4a] px-5 py-3 text-sm font-black text-[#18220f]">Send work</Link>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Awaiting sign-off" value={stats.awaiting} />
        <Stat label="Snags open" value={stats.snags} />
        <Stat label="Ready for payment" value={stats.payment} />
        <Stat label="Paid" value={stats.paid} />
      </section>

      {variations.length ? <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
        <div className="text-xs font-black uppercase tracking-wider text-amber-800">Variations needing approval</div>
        <div className="mt-3 space-y-2">{variations.map((variation) => <div key={variation.id} className="grid gap-3 rounded-2xl bg-white p-4 md:grid-cols-[1fr_auto] md:items-center"><div><div className="font-black">{variation.title}</div><div className="mt-1 text-sm font-semibold text-zinc-600">{variation.firstName} {variation.lastName}: {variation.description}{variation.amount != null ? ` · £${variation.amount}` : ''}</div></div><div className="flex gap-2"><button disabled={busyId === `v${variation.id}`} onClick={() => act({ action: 'approve_variation', variationId: variation.id }, `v${variation.id}`)} className="rounded-xl bg-green-700 px-4 py-2 text-sm font-black text-white">Approve</button><button disabled={busyId === `v${variation.id}`} onClick={() => act({ action: 'reject_variation', variationId: variation.id }, `v${variation.id}`)} className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-black">Reject</button></div></div>)}</div>
      </section> : null}

      <section className="space-y-3">
        {workOrders.map((item) => {
          const gross = (item.agreedPrice || 0) + Number(item.approvedVariations || 0)
          const insuranceExpired = item.publicLiabilityExpiresAt ? new Date(item.publicLiabilityExpiresAt).getTime() < Date.now() : false
          return <article key={item.id} className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="grid gap-4 lg:grid-cols-[1.4fr_.8fr_.8fr] lg:items-start">
              <div><div className="text-[10px] font-black uppercase tracking-wider text-zinc-400">#{item.id} · {item.company === 'three-counties' ? 'Three Counties' : 'Furlads'} · {item.status.replaceAll('_', ' ')}</div><h2 className="mt-1 text-xl font-black">{item.title}</h2><div className="mt-1 text-sm font-semibold text-zinc-600">{item.firstName} {item.lastName}{item.tradingName ? ` · ${item.tradingName}` : ''} · {item.trade}</div><div className="mt-2 text-xs font-semibold text-zinc-500">{item.customerName || item.roughArea}{item.address ? ` · ${item.address}` : ''}</div>{item.snagNotes ? <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">Snag: {item.snagNotes}</div> : null}{item.issuesNotes ? <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-800">Contractor issue note: {item.issuesNotes}</div> : null}</div>
              <div className="rounded-2xl bg-zinc-50 p-4"><div className="text-[10px] font-black uppercase text-zinc-400">Cost</div><div className="mt-1 text-2xl font-black">£{gross.toLocaleString('en-GB')}</div><div className="mt-2 text-xs font-bold text-zinc-500">Base £{(item.agreedPrice || 0).toLocaleString('en-GB')} · variations £{Number(item.approvedVariations || 0).toLocaleString('en-GB')}</div>{item.netPayable != null ? <div className="mt-2 text-xs font-black text-green-700">Net payable £{item.netPayable.toLocaleString('en-GB')} · CIS deduction £{(item.cisDeductionAmount || 0).toLocaleString('en-GB')}</div> : null}</div>
              <div className="rounded-2xl bg-[#f2f6ec] p-4 text-xs font-bold text-[#4d632f]"><div>CIS: {item.cisVerified ? 'verified' : 'not verified'}</div><div className="mt-1">Deduction: {item.cisDeductionRate ?? 0}%</div><div className={`mt-1 ${insuranceExpired ? 'text-red-700' : ''}`}>Insurance: {item.publicLiabilityExpiresAt ? (insuranceExpired ? 'expired' : `to ${new Date(item.publicLiabilityExpiresAt).toLocaleDateString('en-GB')}`) : 'not recorded'}</div></div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-100 pt-4">
              {item.status === 'awaiting_signoff' ? <button onClick={() => act({ action: 'office_signoff', workOrderId: item.id, signerName: 'Office review' }, `w${item.id}`)} disabled={busyId === `w${item.id}`} className="rounded-xl border border-green-300 bg-green-50 px-4 py-2 text-sm font-black text-green-800">Office sign-off</button> : null}
              {item.signoffStatus === 'signed' && item.status === 'signed_off' ? <button onClick={() => act({ action: 'approve_completion', workOrderId: item.id }, `w${item.id}`)} disabled={busyId === `w${item.id}`} className="rounded-xl bg-[#25391c] px-4 py-2 text-sm font-black text-white">Approve completion</button> : null}
              {item.status === 'approved' && item.paymentStatus === 'pending' ? <button onClick={() => act({ action: 'approve_payment', workOrderId: item.id }, `w${item.id}`)} disabled={busyId === `w${item.id}`} className="rounded-xl bg-[#a8ca4a] px-4 py-2 text-sm font-black text-[#18220f]">Approve payment</button> : null}
              {item.paymentStatus === 'approved' ? <button onClick={() => act({ action: 'mark_paid', workOrderId: item.id }, `w${item.id}`)} disabled={busyId === `w${item.id}`} className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-black">Mark paid</button> : null}
              {item.signoffStatus === 'signed' ? <span className="rounded-xl bg-green-50 px-3 py-2 text-xs font-black text-green-800">Signed by {item.signerName || 'customer'}</span> : null}
            </div>
          </article>
        })}
        {!workOrders.length && !error ? <div className="rounded-3xl border border-dashed border-zinc-300 p-10 text-center text-sm font-semibold text-zinc-500">No accepted subcontractor work orders yet.</div> : null}
      </section>

      {error ? <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div> : null}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"><div className="text-[10px] font-black uppercase tracking-wider text-zinc-500">{label}</div><div className="mt-2 text-2xl font-black">{value}</div></div>
}
