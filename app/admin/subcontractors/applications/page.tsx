'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type DocumentRow = { id: number; documentType: string; documentName: string }
type Application = {
  id: number; status: string; firstName: string; lastName: string; tradingName?: string | null; email: string; phone: string;
  postcode?: string | null; companyNumber?: string | null; vatNumber?: string | null; utrNumber?: string | null; cisRegistered: boolean;
  trades: string[]; otherTrade?: string | null; yearsExperience?: number | null; coverageArea?: string | null; maxTravelMiles?: number | null;
  canDrive: boolean; hasOwnVehicle: boolean; suppliesTools: boolean; suppliesMaterials: boolean; worksForOthers: boolean; fixesOwnDefects: boolean;
  comfortableFixedPrice: boolean; hasEmployees: boolean; publicLiabilityInsurer?: string | null; publicLiabilityPolicyNumber?: string | null;
  publicLiabilityExpiresAt?: string | null; publicLiabilityCover?: string | null; qualifications?: string | null; availability?: string | null;
  preferredWork?: string | null; dayRate?: number | null; referenceOne?: string | null; referenceTwo?: string | null; additionalNotes?: string | null;
  submittedAt: string; reviewedAt?: string | null; reviewNotes?: string | null; approvedWorkerId?: number | null; documents: DocumentRow[]
}

export default function ApplicationsPage() {
  const [items, setItems] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<number | null>(null)

  async function load() {
    setLoading(true); setError('')
    try {
      const response = await fetch('/api/admin/subcontractor-applications', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Could not load applications.')
      setItems(data.applications || [])
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not load applications.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  async function review(id: number, action: 'approve' | 'reject') {
    const reviewNotes = window.prompt(action === 'approve' ? 'Optional approval notes:' : 'Reason / review notes:') || ''
    if (action === 'reject' && !window.confirm('Reject this subcontractor application?')) return
    setBusy(id); setError('')
    try {
      const response = await fetch('/api/admin/subcontractor-applications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ applicationId: id, action, reviewNotes }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Could not update application.')
      await load()
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not update application.') }
    finally { setBusy(null) }
  }

  const pending = items.filter((item) => item.status === 'pending')
  const reviewed = items.filter((item) => item.status !== 'pending')

  return <div className="space-y-5 pb-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><Link href="/admin/subcontractors" className="text-sm font-black text-zinc-600">← Subcontractors</Link><h1 className="mt-2 text-4xl font-black">Subcontractor applications</h1><p className="mt-2 text-sm font-semibold text-zinc-600">Review applicants, open their private evidence and approve them into the live subcontractor network.</p></div><a href="/subcontractors/apply" target="_blank" className="rounded-2xl bg-[#a8ca4a] px-5 py-3 text-sm font-black text-[#18220f]">Open public form ↗</a></div>
    {error ? <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div> : null}
    {loading ? <div className="rounded-3xl bg-white p-8 font-bold">Loading applications…</div> : null}
    {!loading ? <>
      <section className="space-y-3"><div className="flex items-end justify-between"><div><div className="text-xs font-black uppercase tracking-wider text-amber-700">Needs review</div><h2 className="text-2xl font-black">Pending applications</h2></div><div className="rounded-full bg-amber-100 px-3 py-1 text-sm font-black text-amber-800">{pending.length}</div></div>{pending.length ? pending.map((item) => <ApplicationCard key={item.id} item={item} busy={busy === item.id} onApprove={() => review(item.id, 'approve')} onReject={() => review(item.id, 'reject')} />) : <div className="rounded-3xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm font-semibold text-zinc-500">Nothing waiting for review.</div>}</section>
      {reviewed.length ? <section className="space-y-3"><div><div className="text-xs font-black uppercase tracking-wider text-zinc-500">History</div><h2 className="text-2xl font-black">Reviewed</h2></div>{reviewed.map((item) => <ApplicationCard key={item.id} item={item} busy={false} />)}</section> : null}
    </> : null}
  </div>
}

function ApplicationCard({ item, busy, onApprove, onReject }: { item: Application; busy: boolean; onApprove?: () => void; onReject?: () => void }) {
  const expired = item.publicLiabilityExpiresAt ? new Date(item.publicLiabilityExpiresAt).getTime() < Date.now() : false
  return <details className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm open:ring-2 open:ring-[#dbe9b8]">
    <summary className="cursor-pointer list-none"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Application #{item.id} · {new Date(item.submittedAt).toLocaleDateString('en-GB')}</div><div className="mt-1 text-xl font-black">{item.firstName} {item.lastName}{item.tradingName ? ` · ${item.tradingName}` : ''}</div><div className="mt-1 text-sm font-semibold text-zinc-500">{[...item.trades, ...(item.otherTrade ? [item.otherTrade] : [])].join(' · ') || 'Trade not stated'} · {item.coverageArea || item.postcode || 'Area not stated'}</div></div><span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${item.status === 'pending' ? 'bg-amber-100 text-amber-800' : item.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{item.status}</span></div></summary>
    <div className="mt-5 grid gap-5 border-t border-zinc-100 pt-5 lg:grid-cols-2">
      <Info title="Contact" rows={[['Mobile', item.phone], ['Email', item.email], ['Postcode', item.postcode], ['Company no.', item.companyNumber], ['VAT no.', item.vatNumber]]} />
      <Info title="Trade & availability" rows={[['Experience', item.yearsExperience != null ? `${item.yearsExperience} years` : null], ['Coverage', item.coverageArea], ['Travel', item.maxTravelMiles != null ? `${item.maxTravelMiles} miles` : null], ['Availability', item.availability], ['Costing guide', item.dayRate != null ? `£${item.dayRate}/day` : null]]} />
      <Info title="Business setup" rows={[['Own vehicle', item.hasOwnVehicle ? 'Yes' : 'No'], ['Can drive', item.canDrive ? 'Yes' : 'No'], ['Own tools', item.suppliesTools ? 'Yes' : 'No'], ['Can supply materials', item.suppliesMaterials ? 'Yes' : 'No'], ['Works for others', item.worksForOthers ? 'Yes' : 'No'], ['Fixed-price work', item.comfortableFixedPrice ? 'Yes' : 'No'], ['Own employees/labourers', item.hasEmployees ? 'Yes' : 'No']]} />
      <Info title="CIS & insurance" rows={[['UTR', item.utrNumber], ['CIS registered', item.cisRegistered ? 'Yes' : 'No'], ['Insurer', item.publicLiabilityInsurer], ['Policy', item.publicLiabilityPolicyNumber], ['Cover', item.publicLiabilityCover], ['Expiry', item.publicLiabilityExpiresAt ? `${new Date(item.publicLiabilityExpiresAt).toLocaleDateString('en-GB')}${expired ? ' · EXPIRED' : ''}` : null]]} />
      {item.qualifications ? <Text title="Qualifications" value={item.qualifications} /> : null}{item.preferredWork ? <Text title="Preferred work" value={item.preferredWork} /> : null}{item.referenceOne ? <Text title="Reference 1" value={item.referenceOne} /> : null}{item.referenceTwo ? <Text title="Reference 2" value={item.referenceTwo} /> : null}{item.additionalNotes ? <Text title="Additional notes" value={item.additionalNotes} /> : null}
    </div>
    <div className="mt-5"><div className="text-xs font-black uppercase tracking-wider text-zinc-500">Documents</div><div className="mt-2 flex flex-wrap gap-2">{item.documents?.length ? item.documents.map((doc) => <a key={doc.id} href={`/api/admin/subcontractor-applications/documents/${doc.id}`} target="_blank" className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-black">{doc.documentName} ↗</a>) : <span className="text-sm font-semibold text-zinc-500">No documents uploaded.</span>}</div></div>
    {item.status === 'pending' ? <div className="mt-5 flex flex-wrap gap-2"><button disabled={busy} onClick={onApprove} className="rounded-xl bg-[#a8ca4a] px-4 py-3 text-sm font-black text-[#18220f] disabled:opacity-50">Approve & create profile</button><button disabled={busy} onClick={onReject} className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700 disabled:opacity-50">Reject application</button></div> : item.approvedWorkerId ? <Link href={`/admin/subcontractors/${item.approvedWorkerId}`} className="mt-5 inline-flex text-sm font-black text-[#56752c]">Open subcontractor profile →</Link> : null}
  </details>
}
function Info({ title, rows }: { title: string; rows: Array<[string, string | null | undefined]> }) { return <div className="rounded-2xl bg-zinc-50 p-4"><h3 className="font-black">{title}</h3><div className="mt-3 space-y-2">{rows.filter(([,v]) => v != null && v !== '').map(([k,v]) => <div key={k} className="grid grid-cols-[120px_1fr] gap-3 text-sm"><span className="font-bold text-zinc-500">{k}</span><span className="font-semibold">{v}</span></div>)}</div></div> }
function Text({ title, value }: { title: string; value: string }) { return <div className="rounded-2xl bg-zinc-50 p-4"><h3 className="font-black">{title}</h3><p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-zinc-600">{value}</p></div> }
