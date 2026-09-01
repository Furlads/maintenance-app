'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useMemo, useState } from 'react'

type Worker = {
  id: number
  firstName: string
  lastName: string
  fullName?: string
  phone: string | null
  dayRate: number | null
  employmentType: string
  active: boolean
  skills: string[]
  transportRequired: boolean
}

type Job = {
  id: number
  title: string
  jobType: string
  status: string
  visitDate: string | null
}

type CreatedLink = {
  workerId: number
  workerName: string
  phone: string | null
  url: string
  whatsappUrl: string
}

export default function NewSubcontractorOpportunityPage() {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [sourceJobId, setSourceJobId] = useState('')
  const [mode, setMode] = useState<'price' | 'quote'>('price')
  const [company, setCompany] = useState('furlads')
  const [trade, setTrade] = useState('Landscaping')
  const [roughArea, setRoughArea] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [duration, setDuration] = useState('')
  const [timing, setTiming] = useState('')
  const [price, setPrice] = useState('')
  const [quoteGuidance, setQuoteGuidance] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [createdLinks, setCreatedLinks] = useState<CreatedLink[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/workers', { cache: 'no-store' }).then((response) => response.json().then((data) => ({ response, data }))),
      fetch('/api/jobs', { cache: 'no-store' }).then((response) => response.json().then((data) => ({ response, data }))),
    ])
      .then(([workerResult, jobResult]) => {
        if (!workerResult.response.ok) throw new Error(workerResult.data?.error || 'Could not load subcontractors.')
        const subcontractors = (workerResult.data.workers || []).filter((worker: Worker) => worker.active && worker.employmentType === 'subcontractor')
        setWorkers(subcontractors)
        setSelected(subcontractors.map((worker: Worker) => worker.id))

        if (jobResult.response.ok) {
          const openJobs = (jobResult.data.items || []).filter((job: Job) => !['done', 'cancelled', 'archived'].includes(String(job.status || '').toLowerCase()))
          setJobs(openJobs)
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load subcontractors.'))
  }, [])

  const selectedNames = useMemo(() => workers.filter((worker) => selected.includes(worker.id)).map((worker) => worker.fullName || `${worker.firstName} ${worker.lastName}`.trim()), [workers, selected])
  const linkedJob = useMemo(() => jobs.find((job) => String(job.id) === sourceJobId) ?? null, [jobs, sourceJobId])

  function toggleWorker(id: number) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  function chooseJob(value: string) {
    setSourceJobId(value)
    const job = jobs.find((item) => String(item.id) === value)
    if (!job) return
    setTitle((current) => current || job.title || '')
    setTrade((current) => current || job.jobType || 'Landscaping')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    try {
      setBusy(true)
      setError('')
      setCreatedLinks([])
      const response = await fetch('/api/admin/subcontractor-opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company,
          sourceType: sourceJobId ? 'job' : 'manual',
          sourceJobId: sourceJobId ? Number(sourceJobId) : null,
          trade,
          roughArea,
          title,
          publicDescription: description,
          durationText: duration,
          timingText: timing,
          pricingMode: mode,
          fixedPrice: price,
          quoteGuidance,
          workerIds: selected,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Could not create opportunity.')
      setCreatedLinks(data.links || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create opportunity.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pb-8">
      <Link href="/admin/subcontractors" className="mb-3 inline-flex text-sm font-black text-zinc-600">← Back to subcontractors</Link>
      <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr] lg:items-start">
        <form onSubmit={submit} className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-[#789333]">New opportunity</div>
          <h1 className="mt-2 text-3xl font-black tracking-tight">Send work to subcontractors</h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">Link it to a real job if you want acceptance to control the diary. The private link still only shows the rough area and job outline.</p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label="Link to existing job (recommended)"><select value={sourceJobId} onChange={(e) => chooseJob(e.target.value)} className="input"><option value="">Manual opportunity — not tied to diary</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.title} · {job.jobType || 'Job'}{job.visitDate ? ` · ${new Date(job.visitDate).toLocaleDateString('en-GB')}` : ''}</option>)}</select></Field></div>
            <Field label="Company"><select value={company} onChange={(e) => setCompany(e.target.value)} className="input"><option value="furlads">Furlads</option><option value="three-counties">Three Counties Property Care</option></select></Field>
            <Field label="Trade"><select value={trade} onChange={(e) => setTrade(e.target.value)} className="input"><option>Landscaping</option><option>Groundworks</option><option>Fencing</option><option>Plastering</option><option>Electrical</option><option>Plumbing</option><option>Carpentry</option><option>Roofing</option><option>Other</option></select></Field>
            <Field label="Rough area only"><input required value={roughArea} onChange={(e) => setRoughArea(e.target.value)} className="input" placeholder="e.g. Market Drayton area" /></Field>
            <Field label="Opportunity title"><input required value={title} onChange={(e) => setTitle(e.target.value)} className="input" placeholder="e.g. Patio preparation and laying" /></Field>
            <div className="sm:col-span-2"><Field label="Public job description"><textarea required value={description} onChange={(e) => setDescription(e.target.value)} className="input min-h-32 resize-y" placeholder="Describe the work without customer names, exact address or identifying details." /></Field></div>
            <Field label="Likely duration"><input value={duration} onChange={(e) => setDuration(e.target.value)} className="input" placeholder="e.g. 2 days" /></Field>
            <Field label="Target timing"><input value={timing} onChange={(e) => setTiming(e.target.value)} className="input" placeholder="e.g. Next week" /></Field>
          </div>

          {linkedJob ? <div className="mt-4 rounded-2xl border border-[#dce8bd] bg-[#f4f8e9] p-4 text-sm font-bold text-[#405820]">Linked to job #{linkedJob.id}. Acceptance will control the confirmed assignment for this job.</div> : null}

          <div className="mt-5">
            <div className="mb-2 text-xs font-black uppercase tracking-wider text-zinc-500">Pricing</div>
            <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setMode('price')} className={`choice ${mode === 'price' ? 'choice-on' : ''}`}>Fixed trade price</button><button type="button" onClick={() => setMode('quote')} className={`choice ${mode === 'quote' ? 'choice-on' : ''}`}>Ask them to quote</button></div>
            <div className="mt-3">{mode === 'price' ? <Field label="Subcontractor price"><input required value={price} onChange={(e) => setPrice(e.target.value)} className="input" inputMode="decimal" placeholder="e.g. 300" /></Field> : <Field label="Quote guidance"><input value={quoteGuidance} onChange={(e) => setQuoteGuidance(e.target.value)} className="input" placeholder="e.g. Labour only" /></Field>}</div>
          </div>

          <div className="mt-5">
            <div className="mb-2 text-xs font-black uppercase tracking-wider text-zinc-500">Send to</div>
            <div className="space-y-2">{workers.map((worker) => {
              const on = selected.includes(worker.id)
              return <button type="button" key={worker.id} onClick={() => toggleWorker(worker.id)} className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left ${on ? 'border-[#bcd17e] bg-[#f0f6e6]' : 'border-zinc-200 bg-zinc-50'}`}><div><div className="font-black">{worker.fullName || `${worker.firstName} ${worker.lastName}`.trim()}</div><div className="mt-1 text-xs font-semibold text-zinc-500">{worker.dayRate != null ? `£${worker.dayRate}/day` : 'Rate not set'}{worker.transportRequired ? ' · Transport required' : ''}</div></div><div className={`grid h-6 w-6 place-items-center rounded-lg border text-sm font-black ${on ? 'border-[#8dae37] bg-[#a8ca4a]' : 'border-zinc-300 bg-white'}`}>{on ? '✓' : ''}</div></button>
            })}{!workers.length && !error ? <div className="rounded-2xl border border-dashed border-zinc-300 p-4 text-sm font-semibold text-zinc-500">Loading subcontractors…</div> : null}</div>
          </div>

          {error ? <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div> : null}
          <button disabled={busy || !selected.length} className="mt-5 w-full rounded-2xl bg-[#a8ca4a] px-5 py-4 font-black text-[#18220f] disabled:opacity-50">{busy ? 'Creating links…' : 'Create private opportunity links'}</button>
        </form>

        <aside className="rounded-3xl bg-gradient-to-br from-[#142311] via-[#23381a] to-[#30491d] p-5 text-white shadow-xl sm:p-6 lg:sticky lg:top-24">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-[#b9d974]">Contractor preview</div>
          <h2 className="mt-2 text-3xl font-black">What they’ll see</h2>
          <div className="mt-5 space-y-2 rounded-2xl border border-white/10 bg-white/10 p-4 text-sm"><Preview label="Trade" value={trade || '—'} /><Preview label="Rough area" value={roughArea || '—'} /><Preview label="Duration" value={duration || 'To be confirmed'} /><Preview label={mode === 'price' ? 'Trade price' : 'Pricing'} value={mode === 'price' ? (price ? `£${price.replace(/^£/, '')}` : '—') : 'Quote requested'} /></div>
          <div className="mt-4 rounded-2xl bg-white p-4 text-[#263220]"><div className="text-[10px] font-black uppercase tracking-wider text-zinc-500">WhatsApp intro</div><div className="mt-2 text-sm font-bold leading-5">Hi — we’ve got a new {trade || 'work'} opportunity around {roughArea || 'your area'}. Tap the private link to see the outline and let us know if you’re interested.</div></div>
          <div className="mt-4 text-xs font-semibold leading-5 text-[#cbd9c4]">Selected: {selectedNames.length ? selectedNames.join(', ') : 'Nobody yet'}</div>

          {createdLinks.length ? <div className="mt-5 space-y-3"><div className="rounded-2xl bg-[#eaf5d6] p-4 text-sm font-black text-[#314816]">Created ✓ Send each person their own tracked link:</div>{createdLinks.map((link) => <div key={link.workerId} className="rounded-2xl border border-white/10 bg-white/10 p-4"><div className="font-black">{link.workerName}</div><div className="mt-3 grid gap-2"><a href={link.whatsappUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-[#a8ca4a] px-4 py-3 text-center text-sm font-black text-[#18220f]">Open WhatsApp</a><a href={link.url} target="_blank" rel="noreferrer" className="rounded-xl border border-white/20 px-4 py-3 text-center text-sm font-black text-white">Preview their link ↗</a></div></div>)}</div> : null}
        </aside>
      </div>
      <style jsx>{`
        .input { width:100%; border:1px solid #d8dfd3; background:#fbfcfa; border-radius:14px; padding:12px 13px; color:#1f2a1b; font:inherit; font-size:14px; font-weight:650; outline:none; box-sizing:border-box; }
        .input:focus { border-color:#9fbe55; box-shadow:0 0 0 3px rgba(159,190,85,.14); }
        .choice { min-height:48px; border-radius:14px; border:1px solid #d8dfd3; background:#fbfcfa; color:#4f5a49; font-size:13px; font-weight:900; }
        .choice-on { background:#1d2c17; color:white; border-color:#1d2c17; }
      `}</style>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-[11px] font-black uppercase tracking-wider text-zinc-500">{label}</span>{children}</label>
}

function Preview({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4 border-b border-white/10 py-2 last:border-0"><span className="font-semibold text-[#bcd0b3]">{label}</span><span className="text-right font-black">{value}</span></div>
}
