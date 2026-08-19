'use client'

import { useState } from 'react'

type SiteIssue = {
  id: string
  message: string
  reportedBy: string
  reportedAt: string
  resolved: boolean
}

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

type Completion = {
  levelsFallsChecked: boolean
  finishChecked: boolean
  siteClean: boolean
  toolsMaterialsCollected: boolean
  photosCompleted: boolean
  customerChecked: boolean
  issueReportedIfNeeded: boolean
  completedAt: string
}

type Props = {
  jobId: number
  initialSiteIssues: SiteIssue[]
  initialVariations: Variation[]
  initialCompletion: Completion
}

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export default function WorkerSiteActions({
  jobId,
  initialSiteIssues,
  initialVariations,
  initialCompletion,
}: Props) {
  const [issues, setIssues] = useState(initialSiteIssues)
  const [variations, setVariations] = useState(initialVariations)
  const [completion, setCompletion] = useState(initialCompletion)
  const [issueText, setIssueText] = useState('')
  const [variationText, setVariationText] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function patch(body: Record<string, unknown>) {
    const response = await fetch(`/api/landscaping/jobs/${jobId}/controls`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await response.json().catch(() => null)
    if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Could not save update.')
    return data.controls
  }

  async function submitIssue() {
    const clean = issueText.trim()
    if (!clean || saving) return
    try {
      setSaving(true)
      setError('')
      setMessage('')
      const next = [...issues, {
        id: newId('issue'),
        message: clean,
        reportedBy: '',
        reportedAt: new Date().toISOString(),
        resolved: false,
      }]
      const controls = await patch({ siteIssues: next })
      setIssues(controls.siteIssues || next)
      setIssueText('')
      setMessage('Problem sent to Trev/Kelly.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not report the problem.')
    } finally {
      setSaving(false)
    }
  }

  async function submitVariation() {
    const clean = variationText.trim()
    if (!clean || saving) return
    try {
      setSaving(true)
      setError('')
      setMessage('')
      const next = [...variations, {
        id: newId('variation'),
        request: clean,
        requestedBy: '',
        requestedAt: new Date().toISOString(),
        status: 'pending' as const,
        agreedPriceExVat: null,
        customerAgreed: false,
        agreementNote: '',
      }]
      const controls = await patch({ variations: next })
      setVariations(controls.variations || next)
      setVariationText('')
      setMessage('Extra work request sent for pricing. Do not start it until it shows as agreed.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit the extra-work request.')
    } finally {
      setSaving(false)
    }
  }

  async function updateCompletion(key: keyof Completion, value: boolean) {
    if (key === 'completedAt') return
    const next = { ...completion, [key]: value }
    const checks = [
      next.levelsFallsChecked,
      next.finishChecked,
      next.siteClean,
      next.toolsMaterialsCollected,
      next.photosCompleted,
      next.customerChecked,
      next.issueReportedIfNeeded,
    ]
    next.completedAt = checks.every(Boolean) ? new Date().toISOString() : ''
    setCompletion(next)
    try {
      setError('')
      await patch({ completion: next })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save completion check.')
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-red-200 bg-red-50 p-5 shadow-sm">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-red-700">Problem on site?</div>
        <h2 className="mt-1 text-xl font-black text-red-950">Tell Trev / Kelly before it becomes a bigger problem</h2>
        <textarea value={issueText} onChange={(event) => setIssueText(event.target.value)} rows={3} placeholder="e.g. Found buried concrete across the patio area / access is blocked / customer has moved the agreed line" className="mt-4 w-full rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm leading-6 text-zinc-900" />
        <button type="button" onClick={() => void submitIssue()} disabled={saving || !issueText.trim()} className="mt-3 min-h-11 rounded-xl bg-red-900 px-4 text-sm font-black text-white disabled:opacity-50">Report problem</button>
        {issues.filter((issue) => !issue.resolved).length ? <div className="mt-3 text-xs font-bold text-red-800">{issues.filter((issue) => !issue.resolved).length} open site issue{issues.filter((issue) => !issue.resolved).length === 1 ? '' : 's'} recorded.</div> : null}
      </section>

      <section className="rounded-3xl border border-purple-200 bg-purple-50 p-5 shadow-sm">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-purple-700">Customer asks for extra work</div>
        <h2 className="mt-1 text-xl font-black text-purple-950">Log it first — do not start it until the price is agreed</h2>
        <p className="mt-1 text-sm leading-6 text-purple-900">Describe exactly what the customer wants. Trev/Kelly will price it and confirm the agreement. This protects both Furlads and the customer from surprises on the final bill.</p>
        <textarea value={variationText} onChange={(event) => setVariationText(event.target.value)} rows={3} placeholder="e.g. Customer wants the gravel strip extended another 4m around the shed" className="mt-4 w-full rounded-2xl border border-purple-200 bg-white px-4 py-3 text-sm leading-6 text-zinc-900" />
        <button type="button" onClick={() => void submitVariation()} disabled={saving || !variationText.trim()} className="mt-3 min-h-11 rounded-xl bg-purple-900 px-4 text-sm font-black text-white disabled:opacity-50">Submit extra for pricing</button>

        {variations.length ? (
          <div className="mt-4 space-y-2">
            {variations.slice().reverse().map((variation) => {
              const canProceed = variation.status === 'agreed' && variation.customerAgreed && variation.agreedPriceExVat != null
              return (
                <div key={variation.id} className="rounded-2xl bg-white p-4 ring-1 ring-inset ring-purple-200">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="font-bold text-zinc-950">{variation.request}</div>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${canProceed ? 'bg-green-100 text-green-900' : variation.status === 'declined' ? 'bg-zinc-200 text-zinc-700' : 'bg-amber-100 text-amber-900'}`}>
                      {canProceed ? '✓ Agreed — can proceed' : variation.status === 'declined' ? 'Declined — do not do' : 'WAITING — do not start'}
                    </span>
                  </div>
                  {canProceed && variation.agreementNote ? <div className="mt-2 text-sm leading-6 text-green-800">{variation.agreementNote}</div> : null}
                </div>
              )
            })}
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border border-green-200 bg-green-50 p-5 shadow-sm">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-green-700">Before the job is finished</div>
        <h2 className="mt-1 text-xl font-black text-green-950">Completion checks</h2>
        <div className="mt-4 space-y-2">
          <Check label="Final lines, levels and falls checked" checked={completion.levelsFallsChecked} onChange={(v) => void updateCompletion('levelsFallsChecked', v)} />
          <Check label="Finish / pointing / edges / snagging checked" checked={completion.finishChecked} onChange={(v) => void updateCompletion('finishChecked', v)} />
          <Check label="Site cleaned and customer areas left tidy" checked={completion.siteClean} onChange={(v) => void updateCompletion('siteClean', v)} />
          <Check label="Tools, boards and leftover materials collected" checked={completion.toolsMaterialsCollected} onChange={(v) => void updateCompletion('toolsMaterialsCollected', v)} />
          <Check label="Required before / progress / after photos completed" checked={completion.photosCompleted} onChange={(v) => void updateCompletion('photosCompleted', v)} />
          <Check label="Customer has seen the finished work / any concern has been flagged" checked={completion.customerChecked} onChange={(v) => void updateCompletion('customerChecked', v)} />
          <Check label="Any unresolved issue or extra has been reported to Trev/Kelly" checked={completion.issueReportedIfNeeded} onChange={(v) => void updateCompletion('issueReportedIfNeeded', v)} />
        </div>
        {completion.completedAt ? <div className="mt-4 rounded-2xl bg-green-100 px-4 py-3 text-sm font-black text-green-950">✓ Completion checks finished</div> : null}
      </section>

      {message ? <div className="rounded-2xl bg-green-50 px-4 py-3 text-sm font-bold text-green-900 ring-1 ring-inset ring-green-200">{message}</div> : null}
      {error ? <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-900 ring-1 ring-inset ring-red-200">{error}</div> : null}
    </div>
  )
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-zinc-800 ring-1 ring-inset ring-green-200">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-5 w-5" />
      <span>{label}</span>
    </label>
  )
}
