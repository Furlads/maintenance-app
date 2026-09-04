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
    <div className="space-y-3 pb-8 sm:space-y-4">
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href="/admin/subcontractors" className="text-xs font-black text-zinc-500 sm:text-sm">← Subcontractors</Link>
            <h1 className="mt-1.5 text-2xl font-black tracking-tight text-zinc-950 sm:text-3xl">Work orders & sign-off</h1>
            <p className="mt-1 text-sm leading-5 text-zinc-600">Completion, variations, sign-off, CIS and payment in one place.</p>
          </div>
          <Link href="/admin/subcontractors/new" className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-yellow-300 px-3 text-xs font-black text-zinc-950 sm:min-h-11 sm:rounded-xl sm:px-4 sm:text-sm">Send work</Link>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Stat label="Awaiting sign-off" value={stats.awaiting} />
        <Stat label="Snags open" value={stats.snags} />
        <Stat label="Ready for payment" value={stats.payment} />
        <Stat label="Paid" value={stats.paid} />
      </section>

      {variations.length ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm sm:p-5">
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-800 sm:text-xs">Variations needing approval</div>
          <div className="mt-3 space-y-2">
            {variations.map((variation) => (
              <div key={variation.id} className="rounded-xl bg-white p-3 ring-1 ring-inset ring-amber-200 sm:rounded-2xl sm:p-4">
                <div className="font-black text-zinc-950">{variation.title}</div>
                <div className="mt-1 text-sm leading-5 text-zinc-600">{variation.firstName} {variation.lastName}: {variation.description}{variation.amount != null ? ` · £${variation.amount}` : ''}</div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:flex">
                  <button disabled={busyId === `v${variation.id}`} onClick={() => act({ action: 'approve_variation', variationId: variation.id }, `v${variation.id}`)} className="min-h-10 rounded-lg bg-green-700 px-3 text-xs font-black text-yellow-100 disabled:opacity-50 sm:rounded-xl sm:px-4 sm:text-sm">Approve</button>
                  <button disabled={busyId === `v${variation.id}`} onClick={() => act({ action: 'reject_variation', variationId: variation.id }, `v${variation.id}`)} className="min-h-10 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-black text-zinc-800 disabled:opacity-50 sm:rounded-xl sm:px-4 sm:text-sm">Reject</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-2.5 sm:space-y-3">
        {workOrders.map((item) => {
          const gross = (item.agreedPrice || 0) + Number(item.approvedVariations || 0)
          const insuranceExpired = item.publicLiabilityExpiresAt ? new Date(item.publicLiabilityExpiresAt).getTime() < Date.now() : false
          return (
            <article key={item.id} className="rounded-2xl border border-zinc-200 bg-white p-3.5 shadow-sm sm:p-5">
              <div className="grid gap-3 lg:grid-cols-[1.4fr_.8fr_.8fr] lg:items-start lg:gap-4">
                <div className="min-w-0">
                  <div className="text-[9px] font-black uppercase tracking-wider text-zinc-400 sm:text-[10px]">#{item.id} · {item.company === 'three-counties' ? 'Three Counties' : 'Furlads'} · {item.status.replaceAll('_', ' ')}</div>
                  <h2 className="mt-1 truncate text-lg font-black text-zinc-950 sm:text-xl">{item.title}</h2>
                  <div className="mt-1 line-clamp-2 text-xs font-semibold text-zinc-600 sm:text-sm">{item.firstName} {item.lastName}{item.tradingName ? ` · ${item.tradingName}` : ''} · {item.trade}</div>
                  <div className="mt-1.5 line-clamp-2 text-xs font-semibold text-zinc-500">{item.customerName || item.roughArea}{item.address ? ` · ${item.address}` : ''}</div>
                  {item.snagNotes ? <div className="mt-2 rounded-xl bg-amber-50 p-2.5 text-xs font-bold text-amber-900 sm:mt-3 sm:p-3 sm:text-sm">Snag: {item.snagNotes}</div> : null}
                  {item.issuesNotes ? <div className="mt-2 rounded-xl bg-red-50 p-2.5 text-xs font-bold text-red-800 sm:mt-3 sm:p-3 sm:text-sm">Contractor issue: {item.issuesNotes}</div> : null}
                </div>

                <div className="rounded-xl bg-zinc-50 p-3 ring-1 ring-inset ring-zinc-200 sm:rounded-2xl sm:p-4">
                  <div className="text-[9px] font-black uppercase text-zinc-400 sm:text-[10px]">Cost</div>
                  <div className="mt-1 text-2xl font-black text-zinc-950">£{gross.toLocaleString('en-GB')}</div>
                  <div className="mt-1.5 text-[11px] font-bold leading-4 text-zinc-500 sm:text-xs">Base £{(item.agreedPrice || 0).toLocaleString('en-GB')} · variations £{Number(item.approvedVariations || 0).toLocaleString('en-GB')}</div>
                  {item.netPayable != null ? <div className="mt-1.5 text-[11px] font-black leading-4 text-green-700 sm:text-xs">Net £{item.netPayable.toLocaleString('en-GB')} · CIS £{(item.cisDeductionAmount || 0).toLocaleString('en-GB')}</div> : null}
                </div>

                <div className="rounded-xl bg-[#f2f6ec] p-3 text-xs font-bold text-[#4d632f] ring-1 ring-inset ring-[#dde8cc] sm:rounded-2xl sm:p-4">
                  <div>CIS: {item.cisVerified ? 'verified' : 'not verified'}</div>
                  <div className="mt-1">Deduction: {item.cisDeductionRate ?? 0}%</div>
                  <div className={`mt-1 ${insuranceExpired ? 'text-red-700' : ''}`}>Insurance: {item.publicLiabilityExpiresAt ? (insuranceExpired ? 'expired' : `to ${new Date(item.publicLiabilityExpiresAt).toLocaleDateString('en-GB')}`) : 'not recorded'}</div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-zinc-100 pt-3 sm:mt-4 sm:flex sm:flex-wrap sm:pt-4">
                {item.status === 'awaiting_signoff' ? <button onClick={() => act({ action: 'office_signoff', workOrderId: item.id, signerName: 'Office review' }, `w${item.id}`)} disabled={busyId === `w${item.id}`} className="min-h-10 rounded-lg border border-green-300 bg-green-50 px-3 text-xs font-black text-green-800 disabled:opacity-50 sm:rounded-xl sm:px-4 sm:text-sm">Office sign-off</button> : null}
                {item.signoffStatus === 'signed' && item.status === 'signed_off' ? <button onClick={() => act({ action: 'approve_completion', workOrderId: item.id }, `w${item.id}`)} disabled={busyId === `w${item.id}`} className="min-h-10 rounded-lg bg-zinc-900 px-3 text-xs font-black text-yellow-300 disabled:opacity-50 sm:rounded-xl sm:px-4 sm:text-sm">Approve completion</button> : null}
                {item.status === 'approved' && item.paymentStatus === 'pending' ? <button onClick={() => act({ action: 'approve_payment', workOrderId: item.id }, `w${item.id}`)} disabled={busyId === `w${item.id}`} className="min-h-10 rounded-lg bg-yellow-300 px-3 text-xs font-black text-zinc-950 disabled:opacity-50 sm:rounded-xl sm:px-4 sm:text-sm">Approve payment</button> : null}
                {item.paymentStatus === 'approved' ? <button onClick={() => act({ action: 'mark_paid', workOrderId: item.id }, `w${item.id}`)} disabled={busyId === `w${item.id}`} className="min-h-10 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-black text-zinc-800 disabled:opacity-50 sm:rounded-xl sm:px-4 sm:text-sm">Mark paid</button> : null}
                {item.signoffStatus === 'signed' ? <span className="col-span-2 inline-flex min-h-10 items-center rounded-lg bg-green-50 px-3 text-xs font-black text-green-800 sm:rounded-xl">Signed by {item.signerName || 'customer'}</span> : null}
              </div>
            </article>
          )
        })}

        {!workOrders.length && !error ? <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm font-semibold text-zinc-500 sm:p-8">No accepted subcontractor work orders yet.</div> : null}
      </section>

      {error ? <div className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700 sm:rounded-2xl sm:p-4">{error}</div> : null}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-4"><div className="text-[9px] font-black uppercase tracking-wider text-zinc-500 sm:text-[10px]">{label}</div><div className="mt-1.5 text-2xl font-black text-zinc-950 sm:mt-2">{value}</div></div>
}
