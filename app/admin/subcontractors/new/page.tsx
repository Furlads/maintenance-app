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

function dateInputIn(days: number) {
  const date = new Date(Date.now() + days * 86400000)
  return date.toISOString().slice(0, 10)
}

const PHASES = [
  { key: 'Dig out / preparation', trade: 'Groundworks', hint: 'Excavation, strip-out, disposal, sub-base and initial levels.' },
  { key: 'Build / installation', trade: 'Landscaping', hint: 'Main construction, laying, fencing or installation stage.' },
  { key: 'Finish / specialist', trade: 'Landscaping', hint: 'Skilled finish, pointing, cuts, detailing, final fitting or specialist stage.' },
  { key: 'Whole job', trade: 'Landscaping', hint: 'Use only where the same person/team is genuinely completing the whole job.' },
  { key: 'Other phase', trade: 'Other', hint: 'Name the stage clearly in the phase field below.' },
]

export default function NewSubcontractorOpportunityPage() {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [sourceJobId, setSourceJobId] = useState('')
  const [phase, setPhase] = useState('Dig out / preparation')
  const [mode, setMode] = useState<'price' | 'quote'>('price')
  const [company, setCompany] = useState('furlads')
  const [trade, setTrade] = useState('Groundworks')
  const [roughArea, setRoughArea] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [duration, setDuration] = useState('')
  const [timing, setTiming] = useState('')
  const [price, setPrice] = useState('')
  const [quoteGuidance, setQuoteGuidance] = useState('')
  const [replyBy, setReplyBy] = useState(dateInputIn(7))
  const [priceIncludesVat, setPriceIncludesVat] = useState(true)
  const [workBasis, setWorkBasis] = useState('labour_only')
  const [materialsResponsibility, setMaterialsResponsibility] = useState('Furlads supplies materials')
  const [plantResponsibility, setPlantResponsibility] = useState('Furlads supplies agreed plant')
  const [wasteResponsibility, setWasteResponsibility] = useState('Furlads arranges waste removal')
  const [siteNotes, setSiteNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [createdLinks, setCreatedLinks] = useState<CreatedLink[]>([])

  useEffect(() => {
    const requestedJobId = new URLSearchParams(window.location.search).get('jobId') || ''
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
          const requested = openJobs.find((job: Job) => String(job.id) === requestedJobId)
          if (requested) {
            setSourceJobId(String(requested.id))
            setTitle(requested.title || '')
          }
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load subcontractors.'))
  }, [])

  const selectedNames = useMemo(() => workers.filter((worker) => selected.includes(worker.id)).map((worker) => worker.fullName || `${worker.firstName} ${worker.lastName}`.trim()), [workers, selected])
  const linkedJob = useMemo(() => jobs.find((job) => String(job.id) === sourceJobId) ?? null, [jobs, sourceJobId])
  const phaseHint = PHASES.find((item) => item.key === phase)?.hint || ''
  const opportunityTitle = phase && phase !== 'Whole job' ? `${phase} — ${title}` : title

  function toggleWorker(id: number) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  function chooseJob(value: string) {
    setSourceJobId(value)
    const job = jobs.find((item) => String(item.id) === value)
    if (!job) return
    setTitle(job.title || '')
  }

  function choosePhase(value: string) {
    setPhase(value)
    const preset = PHASES.find((item) => item.key === value)
    if (preset) setTrade(preset.trade)
  }

  function createNextPhase() {
    setCreatedLinks([])
    setPhase('Build / installation')
    setTrade('Landscaping')
    setDescription('')
    setDuration('')
    setTiming('')
    setPrice('')
    setQuoteGuidance('')
    setSiteNotes('')
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
          sourceType: sourceJobId ? 'job_phase' : 'manual',
          sourceJobId: sourceJobId ? Number(sourceJobId) : null,
          trade,
          roughArea,
          title: opportunityTitle,
          publicDescription: description,
          durationText: duration,
          timingText: timing,
          pricingMode: mode,
          fixedPrice: price,
          quoteGuidance,
          workerIds: selected,
          replyBy,
          priceIncludesVat,
          workBasis,
          materialsResponsibility,
          plantResponsibility,
          wasteResponsibility,
          siteNotes: [`Phase: ${phase}`, siteNotes].filter(Boolean).join('\n'),
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
          <h1 className="mt-2 text-3xl font-black tracking-tight">Send the right phase to the right people</h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">A job no longer needs to be offered as one block. Split it into the real stages, give each stage its own labour budget and send only that phase to the people who suit it.</p>

          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-950">
            Example: <strong>Steve — dig out/prep</strong> can be one opportunity and budget, then <strong>Codie — paving/finish</strong> can be a second opportunity and budget. Both stay linked to the same customer job.
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label="Link to existing job (recommended)"><select value={sourceJobId} onChange={(e) => chooseJob(e.target.value)} className="input"><option value="">Manual opportunity — not tied to diary</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.title} · {job.jobType || 'Job'}{job.visitDate ? ` · ${new Date(job.visitDate).toLocaleDateString('en-GB')}` : ''}</option>)}</select></Field></div>

            <div className="sm:col-span-2">
              <Field label="Work phase / package">
                <select value={phase} onChange={(e) => choosePhase(e.target.value)} className="input">
                  {PHASES.map((item) => <option key={item.key}>{item.key}</option>)}
                </select>
              </Field>
              {phaseHint ? <div className="mt-2 text-xs font-semibold text-zinc-500">{phaseHint}</div> : null}
            </div>

            <Field label="Company"><select value={company} onChange={(e) => setCompany(e.target.value)} className="input"><option value="furlads">Furlads</option><option value="three-counties">Three Counties Property Care</option></select></Field>
            <Field label="Trade for this phase"><select value={trade} onChange={(e) => setTrade(e.target.value)} className="input"><option>Landscaping</option><option>Groundworks</option><option>Fencing</option><option>Plastering</option><option>Electrical</option><option>Plumbing</option><option>Carpentry</option><option>Roofing</option><option>Other</option></select></Field>
            <Field label="Rough area only"><input required value={roughArea} onChange={(e) => setRoughArea(e.target.value)} className="input" placeholder="e.g. Market Drayton area" /></Field>
            <Field label="Underlying job title"><input required value={title} onChange={(e) => setTitle(e.target.value)} className="input" placeholder="e.g. New patio" /></Field>
            <div className="sm:col-span-2"><div className="rounded-xl bg-zinc-100 px-3 py-2 text-xs font-bold text-zinc-600">Opportunity will be labelled: <span className="font-black text-zinc-950">{opportunityTitle || 'Add a job title'}</span></div></div>
            <div className="sm:col-span-2"><Field label="What this phase includes"><textarea required value={description} onChange={(e) => setDescription(e.target.value)} className="input min-h-32 resize-y" placeholder="Only describe the work this person/team is being asked to price or complete." /></Field></div>
            <Field label="Phase duration"><input value={duration} onChange={(e) => setDuration(e.target.value)} className="input" placeholder="e.g. 1 day" /></Field>
            <Field label="When this phase is needed"><input value={timing} onChange={(e) => setTiming(e.target.value)} className="input" placeholder="e.g. Day 1 / after dig-out / next week" /></Field>
            <Field label="Reply by"><input required type="date" value={replyBy} onChange={(e) => setReplyBy(e.target.value)} className="input" /></Field>
            <Field label="Work basis"><select value={workBasis} onChange={(e) => setWorkBasis(e.target.value)} className="input"><option value="labour_only">Labour only</option><option value="labour_materials">Labour + materials</option></select></Field>
            <Field label="Materials"><input value={materialsResponsibility} onChange={(e) => setMaterialsResponsibility(e.target.value)} className="input" /></Field>
            <Field label="Plant"><input value={plantResponsibility} onChange={(e) => setPlantResponsibility(e.target.value)} className="input" /></Field>
            <Field label="Waste"><input value={wasteResponsibility} onChange={(e) => setWasteResponsibility(e.target.value)} className="input" /></Field>
            <div className="sm:col-span-2"><Field label="Phase / access notes"><textarea value={siteNotes} onChange={(e) => setSiteNotes(e.target.value)} className="input min-h-24 resize-y" placeholder="What must already be done before this phase starts? Access, handover, plant, levels, materials etc." /></Field></div>
          </div>

          {linkedJob ? <div className="mt-4 rounded-2xl border border-[#dce8bd] bg-[#f4f8e9] p-4 text-sm font-bold text-[#405820]">Linked to job #{linkedJob.id}. You can create several separate opportunities against this same job, each with its own worker choice and budget.</div> : null}

          <div className="mt-5">
            <div className="mb-2 text-xs font-black uppercase tracking-wider text-zinc-500">Budget for this phase only</div>
            <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setMode('price')} className={`choice ${mode === 'price' ? 'choice-on' : ''}`}>Fixed phase budget</button><button type="button" onClick={() => setMode('quote')} className={`choice ${mode === 'quote' ? 'choice-on' : ''}`}>Ask them to quote</button></div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {mode === 'price' ? <Field label="Subcontractor budget"><input required value={price} onChange={(e) => setPrice(e.target.value)} className="input" inputMode="decimal" placeholder="e.g. 300" /></Field> : <Field label="Quote guidance"><input value={quoteGuidance} onChange={(e) => setQuoteGuidance(e.target.value)} className="input" placeholder="e.g. Labour only for dig-out" /></Field>}
              {mode === 'price' ? <Field label="VAT basis"><select value={priceIncludesVat ? 'inc' : 'plus'} onChange={(e) => setPriceIncludesVat(e.target.value === 'inc')} className="input"><option value="inc">Budget includes any VAT</option><option value="plus">Budget is + VAT if applicable</option></select></Field> : null}
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 text-xs font-black uppercase tracking-wider text-zinc-500">Send this phase to</div>
            <div className="space-y-2">{workers.map((worker) => {
              const on = selected.includes(worker.id)
              return <button type="button" key={worker.id} onClick={() => toggleWorker(worker.id)} className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left ${on ? 'border-[#bcd17e] bg-[#f0f6e6]' : 'border-zinc-200 bg-zinc-50'}`}><div><div className="font-black">{worker.fullName || `${worker.firstName} ${worker.lastName}`.trim()}</div><div className="mt-1 text-xs font-semibold text-zinc-500">{worker.skills?.length ? `${worker.skills.join(' · ')} · ` : ''}{worker.dayRate != null ? `£${worker.dayRate}/day` : 'Rate not set'}{worker.transportRequired ? ' · Transport required' : ''}</div></div><div className={`grid h-6 w-6 place-items-center rounded-lg border text-sm font-black ${on ? 'border-[#8dae37] bg-[#a8ca4a]' : 'border-zinc-300 bg-white'}`}>{on ? '✓' : ''}</div></button>
            })}{!workers.length && !error ? <div className="rounded-2xl border border-dashed border-zinc-300 p-4 text-sm font-semibold text-zinc-500">Loading subcontractors…</div> : null}</div>
          </div>

          {error ? <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div> : null}
          <button disabled={busy || !selected.length} className="mt-5 w-full rounded-2xl bg-[#a8ca4a] px-5 py-4 font-black text-[#18220f] disabled:opacity-50">{busy ? 'Creating links…' : `Create ${phase.toLowerCase()} opportunity`}</button>
        </form>

        <aside className="rounded-3xl bg-gradient-to-br from-[#142311] via-[#23381a] to-[#30491d] p-5 text-white shadow-xl sm:p-6 lg:sticky lg:top-24">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-[#b9d974]">Contractor preview</div>
          <h2 className="mt-2 text-3xl font-black">Only this stage goes out</h2>
          <div className="mt-5 space-y-2 rounded-2xl border border-white/10 bg-white/10 p-4 text-sm"><Preview label="Phase" value={phase || '—'} /><Preview label="Trade" value={trade || '—'} /><Preview label="Rough area" value={roughArea || '—'} /><Preview label="Duration" value={duration || 'To be confirmed'} /><Preview label="Timing" value={timing || 'To be confirmed'} /><Preview label="Reply by" value={replyBy ? new Date(`${replyBy}T12:00:00`).toLocaleDateString('en-GB') : '—'} /><Preview label="Basis" value={workBasis === 'labour_materials' ? 'Labour + materials' : 'Labour only'} /><Preview label={mode === 'price' ? 'Phase budget' : 'Pricing'} value={mode === 'price' ? (price ? `£${price.replace(/^£/, '')}${priceIncludesVat ? ' inc VAT' : ' + VAT if applicable'}` : '—') : 'Quote requested'} /></div>
          <div className="mt-4 rounded-2xl bg-white p-4 text-[#263220]"><div className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Why this matters</div><div className="mt-2 text-sm font-bold leading-5">The dig-out can go to one person at one cost, while the skilled install or finish can go to somebody else. The office can compare each phase against its own budget instead of forcing one crew across the whole job.</div></div>
          <div className="mt-4 text-xs font-semibold leading-5 text-[#cbd9c4]">Selected for this phase: {selectedNames.length ? selectedNames.join(', ') : 'Nobody yet'}</div>

          {createdLinks.length ? <div className="mt-5 space-y-3"><div className="rounded-2xl bg-[#eaf5d6] p-4 text-sm font-black text-[#314816]">Phase created ✓ Send each person their own tracked link:</div>{createdLinks.map((link) => <div key={link.workerId} className="rounded-2xl border border-white/10 bg-white/10 p-4"><div className="font-black">{link.workerName}</div><div className="mt-3 grid gap-2"><a href={link.whatsappUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-[#a8ca4a] px-4 py-3 text-center text-sm font-black text-[#18220f]">Open WhatsApp</a><a href={link.url} target="_blank" rel="noreferrer" className="rounded-xl border border-white/20 px-4 py-3 text-center text-sm font-black text-white">Preview their link ↗</a></div></div>)}<button type="button" onClick={createNextPhase} className="w-full rounded-xl bg-white px-4 py-3 text-sm font-black text-[#263220]">+ Create next phase for this same job</button></div> : null}
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
