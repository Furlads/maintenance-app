'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { FormEvent, useEffect, useState } from 'react'

type Worker = {
  id: number
  firstName: string
  lastName: string
  phone: string
  email: string
  tradingName: string | null
  utrNumber: string | null
  skills: string[]
  coverageArea: string | null
  canDrive: boolean
  transportRequired: boolean
  suppliesTools: boolean
  suppliesMaterials: boolean
  cisRegistered: boolean
  cisVerified: boolean
  cisVerificationNumber: string | null
  cisDeductionRate: number | null
  publicLiabilityInsurer: string | null
  publicLiabilityPolicyNumber: string | null
  publicLiabilityExpiresAt: string | null
  workAcceptanceRequired: boolean
}

export default function SubcontractorProfilePage() {
  const params = useParams<{ id: string }>()
  const [worker, setWorker] = useState<Worker | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch(`/api/admin/workers/${params.id}`, { cache: 'no-store' })
      .then((response) => response.json().then((data) => ({ response, data })))
      .then(({ response, data }) => {
        if (!response.ok) throw new Error(data?.error || 'Could not load subcontractor.')
        setWorker(data.worker)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load subcontractor.'))
  }, [params.id])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!worker) return
    try {
      setBusy(true)
      setError('')
      setSaved(false)
      const response = await fetch(`/api/admin/workers/${worker.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tradingName: worker.tradingName,
          utrNumber: worker.utrNumber,
          skills: worker.skills,
          coverageArea: worker.coverageArea,
          canDrive: worker.canDrive,
          transportRequired: worker.transportRequired,
          suppliesTools: worker.suppliesTools,
          suppliesMaterials: worker.suppliesMaterials,
          cisRegistered: worker.cisRegistered,
          cisVerified: worker.cisVerified,
          cisVerificationNumber: worker.cisVerificationNumber,
          cisDeductionRate: worker.cisDeductionRate,
          publicLiabilityInsurer: worker.publicLiabilityInsurer,
          publicLiabilityPolicyNumber: worker.publicLiabilityPolicyNumber,
          publicLiabilityExpiresAt: worker.publicLiabilityExpiresAt ? worker.publicLiabilityExpiresAt.slice(0, 10) : '',
          workAcceptanceRequired: worker.workAcceptanceRequired,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Could not save subcontractor.')
      setWorker(data.worker)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save subcontractor.')
    } finally {
      setBusy(false)
    }
  }

  if (!worker) return <div className="p-6 text-sm font-bold text-zinc-600">{error || 'Loading subcontractor…'}</div>

  const expired = worker.publicLiabilityExpiresAt ? new Date(worker.publicLiabilityExpiresAt).getTime() < Date.now() : false

  return (
    <div className="space-y-5 pb-10">
      <div><Link href="/admin/subcontractors" className="text-sm font-black text-zinc-500">← Subcontractors</Link><h1 className="mt-1 text-3xl font-black">{worker.firstName} {worker.lastName}</h1><p className="mt-1 text-sm font-semibold text-zinc-600">Compliance, CIS and working arrangements.</p></div>

      {expired ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-black text-red-800">Public liability insurance has expired. Update it before sending new work.</div> : null}

      <form onSubmit={submit} className="space-y-5">
        <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black">Business & trade</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Trading name"><input className="input" value={worker.tradingName || ''} onChange={(e) => setWorker({ ...worker, tradingName: e.target.value })} /></Field>
            <Field label="UTR"><input className="input" value={worker.utrNumber || ''} onChange={(e) => setWorker({ ...worker, utrNumber: e.target.value })} /></Field>
            <Field label="Trades / skills"><input className="input" value={worker.skills.join(', ')} onChange={(e) => setWorker({ ...worker, skills: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) })} /></Field>
            <Field label="Coverage area"><input className="input" value={worker.coverageArea || ''} onChange={(e) => setWorker({ ...worker, coverageArea: e.target.value })} placeholder="e.g. Shropshire, Cheshire" /></Field>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2"><Check label="Drives" value={worker.canDrive} onChange={(value) => setWorker({ ...worker, canDrive: value })} /><Check label="Transport must be arranged" value={worker.transportRequired} onChange={(value) => setWorker({ ...worker, transportRequired: value })} /><Check label="Supplies own tools" value={worker.suppliesTools} onChange={(value) => setWorker({ ...worker, suppliesTools: value })} /><Check label="Supplies own materials" value={worker.suppliesMaterials} onChange={(value) => setWorker({ ...worker, suppliesMaterials: value })} /></div>
        </section>

        <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black">CIS</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2"><Check label="CIS registered" value={worker.cisRegistered} onChange={(value) => setWorker({ ...worker, cisRegistered: value })} /><Check label="CIS verified" value={worker.cisVerified} onChange={(value) => setWorker({ ...worker, cisVerified: value })} /></div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Verification number"><input className="input" value={worker.cisVerificationNumber || ''} onChange={(e) => setWorker({ ...worker, cisVerificationNumber: e.target.value })} /></Field><Field label="Deduction rate %"><input className="input" inputMode="decimal" value={worker.cisDeductionRate ?? ''} onChange={(e) => setWorker({ ...worker, cisDeductionRate: e.target.value === '' ? null : Number(e.target.value) })} /></Field></div>
        </section>

        <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black">Public liability insurance</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3"><Field label="Insurer"><input className="input" value={worker.publicLiabilityInsurer || ''} onChange={(e) => setWorker({ ...worker, publicLiabilityInsurer: e.target.value })} /></Field><Field label="Policy number"><input className="input" value={worker.publicLiabilityPolicyNumber || ''} onChange={(e) => setWorker({ ...worker, publicLiabilityPolicyNumber: e.target.value })} /></Field><Field label="Expiry date"><input type="date" className="input" value={worker.publicLiabilityExpiresAt ? worker.publicLiabilityExpiresAt.slice(0, 10) : ''} onChange={(e) => setWorker({ ...worker, publicLiabilityExpiresAt: e.target.value || null })} /></Field></div>
        </section>

        <section className="rounded-3xl border border-[#d5e3b9] bg-[#f4f8ed] p-5"><Check label="Must accept work before being assigned" value={worker.workAcceptanceRequired} onChange={(value) => setWorker({ ...worker, workAcceptanceRequired: value })} /><p className="mt-2 text-xs font-semibold text-zinc-600">Keep this on for genuine subcontractors so office staff cannot silently put them on a job.</p></section>

        {error ? <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div> : null}
        {saved ? <div className="rounded-2xl bg-green-50 p-4 text-sm font-bold text-green-800">Saved ✓</div> : null}
        <button disabled={busy} className="w-full rounded-2xl bg-[#a8ca4a] px-5 py-4 font-black text-[#18220f] disabled:opacity-50">{busy ? 'Saving…' : 'Save subcontractor profile'}</button>
      </form>

      <style jsx>{`.input{width:100%;border:1px solid #d8dfd3;background:#fbfcfa;border-radius:14px;padding:12px 13px;color:#1f2a1b;font:inherit;font-size:14px;font-weight:650;outline:none;box-sizing:border-box}.input:focus{border-color:#9fbe55;box-shadow:0 0 0 3px rgba(159,190,85,.14)}`}</style>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-[11px] font-black uppercase tracking-wider text-zinc-500">{label}</span>{children}</label>
}

function Check({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-sm font-black"><input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5" />{label}</label>
}
