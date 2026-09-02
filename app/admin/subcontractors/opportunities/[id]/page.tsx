'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

type Recipient = {
  id: number
  workerId: number
  status: string
  firstName: string
  lastName: string
  tradingName?: string | null
  dayRate?: number | null
  teamDayRate?: number | null
  teamSize?: number | null
  workSetup?: string
  vatRegistered?: boolean
  counterOffer?: number | null
  counterOfferNotes?: string | null
  declineReason?: string | null
  proposedCrewSize?: number | null
  attendeeNotes?: string | null
  respondedAt?: string | null
}

type Opportunity = {
  id: number
  title: string
  trade: string
  roughArea: string
  pricingMode: string
  fixedPrice?: number | null
  priceIncludesVat?: boolean
  workBasis?: string
  replyBy?: string | null
  status: string
}

export default function ManageOpportunityPage() {
  const params = useParams<{ id: string }>()
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null)
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState('')

  async function load() {
    setError('')
    const response = await fetch(`/api/admin/subcontractor-opportunities/${params.id}`, { cache: 'no-store' })
    const data = await response.json()
    if (!response.ok) throw new Error(data?.error || 'Could not load opportunity.')
    setOpportunity(data.opportunity)
    setRecipients(data.recipients || [])
  }

  useEffect(() => { load().catch((err) => setError(err instanceof Error ? err.message : 'Could not load opportunity.')) }, [params.id])

  async function award(recipientId: number) {
    if (!window.confirm('Award this work to this subcontractor? Everyone else will be marked not selected.')) return
    setBusy(recipientId); setError('')
    try {
      const response = await fetch(`/api/admin/subcontractor-opportunities/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'award', recipientId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Could not award opportunity.')
      await load()
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not award opportunity.') }
    finally { setBusy(null) }
  }

  if (!opportunity) return <div className="p-6 text-sm font-bold text-zinc-600">{error || 'Loading opportunity…'}</div>

  return <div className="space-y-5 pb-10">
    <div><Link href="/admin/subcontractors" className="text-sm font-black text-zinc-500">← Subcontractors</Link><div className="mt-2 text-xs font-black uppercase tracking-wider text-[#789333]">Opportunity #{opportunity.id}</div><h1 className="mt-1 text-3xl font-black">{opportunity.title}</h1><p className="mt-1 text-sm font-semibold text-zinc-600">{opportunity.trade} · {opportunity.roughArea}</p></div>

    <section className="grid gap-3 sm:grid-cols-4">
      <Stat label="Status" value={opportunity.status.replaceAll('_', ' ')} />
      <Stat label="Offered price" value={opportunity.pricingMode === 'price' && opportunity.fixedPrice != null ? `£${opportunity.fixedPrice.toLocaleString('en-GB')}${opportunity.priceIncludesVat ? ' inc VAT' : ' + VAT'}` : 'Quote requested'} />
      <Stat label="Basis" value={opportunity.workBasis === 'labour_materials' ? 'Labour + materials' : 'Labour only'} />
      <Stat label="Reply by" value={opportunity.replyBy ? new Date(opportunity.replyBy).toLocaleDateString('en-GB') : '—'} />
    </section>

    {error ? <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div> : null}

    <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-black uppercase tracking-wider text-[#789333]">Responses</div>
      <h2 className="mt-1 text-2xl font-black">Choose who gets the job</h2>
      <p className="mt-2 text-sm font-semibold text-zinc-600">Interest is not an award. Once you choose someone here, they receive an awarded status and must confirm before they are assigned to the job.</p>

      <div className="mt-4 space-y-3">
        {recipients.map((item) => {
          const canAward = ['interested', 'countered', 'viewed', 'sent'].includes(item.status) && opportunity.status !== 'awarded'
          return <div key={item.id} className={`rounded-2xl border p-4 ${item.status === 'awarded' || item.status === 'accepted' ? 'border-green-300 bg-green-50' : 'border-zinc-200 bg-zinc-50'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><div className="text-lg font-black">{item.firstName} {item.lastName}{item.tradingName ? ` · ${item.tradingName}` : ''}</div><div className="mt-1 text-xs font-bold uppercase tracking-wide text-zinc-500">{item.status.replaceAll('_', ' ')}</div></div>
              {canAward ? <button disabled={busy != null} onClick={() => void award(item.id)} className="rounded-xl bg-[#a8ca4a] px-4 py-3 text-sm font-black text-[#18220f] disabled:opacity-50">{busy === item.id ? 'Awarding…' : 'Award work'}</button> : null}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Mini label="Their day rate" value={item.dayRate != null ? `£${item.dayRate}/day` : '—'} />
              <Mini label="Team" value={item.teamSize ? `${item.teamSize} people${item.teamDayRate != null ? ` · £${item.teamDayRate}/day` : ''}` : (item.workSetup || 'just me').replaceAll('_', ' ')} />
              <Mini label="Counter-price" value={item.counterOffer != null ? `£${item.counterOffer.toLocaleString('en-GB')}` : '—'} />
            </div>
            {item.attendeeNotes ? <p className="mt-3 text-sm font-semibold text-zinc-700">Attending: {item.attendeeNotes}{item.proposedCrewSize ? ` (${item.proposedCrewSize} people)` : ''}</p> : null}
            {item.counterOfferNotes ? <p className="mt-2 text-sm font-semibold text-blue-800">Counter-price notes: {item.counterOfferNotes}</p> : null}
            {item.declineReason ? <p className="mt-2 text-sm font-semibold text-zinc-600">Declined: {item.declineReason}</p> : null}
          </div>
        })}
      </div>
    </section>
  </div>
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"><div className="text-[10px] font-black uppercase tracking-wider text-zinc-500">{label}</div><div className="mt-2 font-black capitalize">{value}</div></div> }
function Mini({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-white p-3 ring-1 ring-zinc-200"><div className="text-[10px] font-black uppercase text-zinc-400">{label}</div><div className="mt-1 text-sm font-black capitalize">{value}</div></div> }
