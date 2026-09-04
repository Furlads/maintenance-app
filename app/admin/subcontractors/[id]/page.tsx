'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { FormEvent, useEffect, useState } from 'react'

type Worker = {
  id: number; firstName: string; lastName: string; phone: string; email: string; tradingName: string | null; utrNumber: string | null;
  skills: string[]; coverageArea: string | null; canDrive: boolean; transportRequired: boolean; suppliesTools: boolean; suppliesMaterials: boolean;
  cisRegistered: boolean; cisVerified: boolean; cisVerificationNumber: string | null; cisDeductionRate: number | null;
  publicLiabilityInsurer: string | null; publicLiabilityPolicyNumber: string | null; publicLiabilityExpiresAt: string | null;
  workAcceptanceRequired: boolean; dayRate?: number | null; workSetup?: string; teamSize?: number | null; teamDayRate?: number | null;
  teamDescription?: string | null; availabilityStatus?: string; unavailableUntil?: string | null; minimumCharge?: number | null;
  halfDayRate?: number | null; pricingPreference?: string; vatRegistered?: boolean; vatNumber?: string | null; doNotUse?: boolean; doNotUseReason?: string | null;
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
          ...worker,
          publicLiabilityExpiresAt: worker.publicLiabilityExpiresAt ? worker.publicLiabilityExpiresAt.slice(0, 10) : '',
          unavailableUntil: worker.unavailableUntil ? worker.unavailableUntil.slice(0, 10) : '',
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

  if (!worker) return <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm font-bold text-zinc-600 shadow-sm">{error || 'Loading subcontractor…'}</div>

  const expired = worker.publicLiabilityExpiresAt ? new Date(worker.publicLiabilityExpiresAt).getTime() < Date.now() : false

  return (
    <div className="space-y-3 pb-8 sm:space-y-4">
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
        <Link href="/admin/subcontractors" className="text-xs font-black text-zinc-500 sm:text-sm">← Subcontractors</Link>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-black text-zinc-950 sm:text-3xl">{worker.firstName} {worker.lastName}</h1>
            <p className="mt-1 text-sm leading-5 text-zinc-600">Compliance, rates, availability and working arrangements.</p>
          </div>
          <span className="shrink-0 rounded-full bg-[#edf3e4] px-2.5 py-1 text-[10px] font-black uppercase text-[#59712c] ring-1 ring-inset ring-[#d7e6b8]">Subcontractor</span>
        </div>
      </section>

      {expired ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-black text-red-800 sm:rounded-2xl sm:p-4">Public liability insurance has expired. Update it before sending new work.</div> : null}
      {worker.doNotUse ? <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm font-black text-red-900 sm:rounded-2xl sm:p-4">Restricted / do not use{worker.doNotUseReason ? ` — ${worker.doNotUseReason}` : ''}</div> : null}

      <form onSubmit={submit} className="space-y-3 sm:space-y-4">
        <Section title="Business, team & rates">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Trading name"><input className="input" value={worker.tradingName || ''} onChange={(e) => setWorker({ ...worker, tradingName: e.target.value })} /></Field>
            <Field label="Work setup"><select className="input" value={worker.workSetup || 'just_me'} onChange={(e) => setWorker({ ...worker, workSetup: e.target.value })}><option value="just_me">Just them</option><option value="team">Team / crew</option><option value="business">Business</option></select></Field>
            <Field label="Own day rate"><input className="input" inputMode="decimal" value={worker.dayRate ?? ''} onChange={(e) => setWorker({ ...worker, dayRate: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
            <Field label="Half-day rate"><input className="input" inputMode="decimal" value={worker.halfDayRate ?? ''} onChange={(e) => setWorker({ ...worker, halfDayRate: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
            <Field label="Minimum / call-out"><input className="input" inputMode="decimal" value={worker.minimumCharge ?? ''} onChange={(e) => setWorker({ ...worker, minimumCharge: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
            <Field label="Team size"><input className="input" type="number" min="1" value={worker.teamSize ?? ''} onChange={(e) => setWorker({ ...worker, teamSize: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
            <Field label="Team / crew day rate"><input className="input" inputMode="decimal" value={worker.teamDayRate ?? ''} onChange={(e) => setWorker({ ...worker, teamDayRate: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
            <Field label="Typical team"><input className="input" value={worker.teamDescription || ''} onChange={(e) => setWorker({ ...worker, teamDescription: e.target.value })} placeholder="e.g. Luke + labourer" /></Field>
            <Field label="Pricing preference"><select className="input" value={worker.pricingPreference || 'either'} onChange={(e) => setWorker({ ...worker, pricingPreference: e.target.value })}><option value="labour_only">Labour only</option><option value="labour_materials">Labour + materials</option><option value="either">Either</option></select></Field>
            <Field label="VAT number"><input className="input" value={worker.vatNumber || ''} onChange={(e) => setWorker({ ...worker, vatNumber: e.target.value })} /></Field>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2"><Check label="VAT registered" value={!!worker.vatRegistered} onChange={(value) => setWorker({ ...worker, vatRegistered: value })} /></div>
        </Section>

        <Section title="Availability & suitability">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Availability"><select className="input" value={worker.availabilityStatus || 'available'} onChange={(e) => setWorker({ ...worker, availabilityStatus: e.target.value })}><option value="available">Available</option><option value="limited">Limited availability</option><option value="unavailable">Unavailable</option></select></Field>
            <Field label="Unavailable until"><input type="date" className="input" value={worker.unavailableUntil ? worker.unavailableUntil.slice(0, 10) : ''} onChange={(e) => setWorker({ ...worker, unavailableUntil: e.target.value || null })} /></Field>
            <Field label="Trades / skills"><input className="input" value={worker.skills.join(', ')} onChange={(e) => setWorker({ ...worker, skills: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) })} /></Field>
            <Field label="Coverage area"><input className="input" value={worker.coverageArea || ''} onChange={(e) => setWorker({ ...worker, coverageArea: e.target.value })} /></Field>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2"><Check label="Drives" value={worker.canDrive} onChange={(value) => setWorker({ ...worker, canDrive: value })} /><Check label="Transport arranged" value={worker.transportRequired} onChange={(value) => setWorker({ ...worker, transportRequired: value })} /><Check label="Own tools" value={worker.suppliesTools} onChange={(value) => setWorker({ ...worker, suppliesTools: value })} /><Check label="Can supply materials" value={worker.suppliesMaterials} onChange={(value) => setWorker({ ...worker, suppliesMaterials: value })} /></div>
        </Section>

        <Section title="CIS">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="UTR"><input className="input" value={worker.utrNumber || ''} onChange={(e) => setWorker({ ...worker, utrNumber: e.target.value })} /></Field>
            <Field label="Verification number"><input className="input" value={worker.cisVerificationNumber || ''} onChange={(e) => setWorker({ ...worker, cisVerificationNumber: e.target.value })} /></Field>
            <Field label="Deduction rate %"><input className="input" inputMode="decimal" value={worker.cisDeductionRate ?? ''} onChange={(e) => setWorker({ ...worker, cisDeductionRate: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2"><Check label="CIS registered" value={worker.cisRegistered} onChange={(value) => setWorker({ ...worker, cisRegistered: value })} /><Check label="CIS verified" value={worker.cisVerified} onChange={(value) => setWorker({ ...worker, cisVerified: value })} /></div>
        </Section>

        <Section title="Public liability insurance">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Insurer"><input className="input" value={worker.publicLiabilityInsurer || ''} onChange={(e) => setWorker({ ...worker, publicLiabilityInsurer: e.target.value })} /></Field>
            <Field label="Policy number"><input className="input" value={worker.publicLiabilityPolicyNumber || ''} onChange={(e) => setWorker({ ...worker, publicLiabilityPolicyNumber: e.target.value })} /></Field>
            <Field label="Expiry date"><input type="date" className="input" value={worker.publicLiabilityExpiresAt ? worker.publicLiabilityExpiresAt.slice(0, 10) : ''} onChange={(e) => setWorker({ ...worker, publicLiabilityExpiresAt: e.target.value || null })} /></Field>
          </div>
        </Section>

        <section className="rounded-2xl border border-red-200 bg-red-50 p-4"><Check label="Do not offer this subcontractor work" value={!!worker.doNotUse} onChange={(value) => setWorker({ ...worker, doNotUse: value })} /><div className="mt-3"><Field label="Internal reason"><input className="input" value={worker.doNotUseReason || ''} onChange={(e) => setWorker({ ...worker, doNotUseReason: e.target.value })} placeholder="Internal only" /></Field></div></section>
        <section className="rounded-2xl border border-[#d5e3b9] bg-[#f4f8ed] p-4"><Check label="Must accept work before being assigned" value={worker.workAcceptanceRequired} onChange={(value) => setWorker({ ...worker, workAcceptanceRequired: value })} /></section>

        {error ? <div className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700 sm:rounded-2xl sm:p-4">{error}</div> : null}
        {saved ? <div className="rounded-xl bg-green-50 p-3 text-sm font-bold text-green-800 sm:rounded-2xl sm:p-4">Saved ✓</div> : null}
        <button disabled={busy} className="sticky bottom-[82px] z-20 w-full rounded-xl bg-yellow-300 px-5 py-3.5 font-black text-zinc-950 shadow-lg disabled:opacity-50 sm:static sm:rounded-2xl sm:py-4 sm:shadow-sm">{busy ? 'Saving…' : 'Save subcontractor profile'}</button>
      </form>

      <style jsx>{`.input{width:100%;min-height:44px;border:1px solid #d4d4d8;background:#fff;border-radius:12px;padding:10px 12px;color:#18181b;font:inherit;font-size:14px;font-weight:650;outline:none;box-sizing:border-box}.input:focus{border-color:#a3a3a3;box-shadow:0 0 0 3px rgba(250,204,21,.18)}@media(min-width:640px){.input{border-radius:14px;padding:12px 13px}}`}</style>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5"><h2 className="text-lg font-black text-zinc-950 sm:text-xl">{title}</h2><div className="mt-3 sm:mt-4">{children}</div></section>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-zinc-500 sm:mb-2 sm:text-[11px]">{label}</span>{children}</label>
}

function Check({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex min-h-11 items-center gap-2.5 rounded-xl border border-zinc-200 bg-white p-3 text-xs font-black sm:gap-3 sm:rounded-2xl sm:p-4 sm:text-sm"><input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 shrink-0" /><span>{label}</span></label>
}
