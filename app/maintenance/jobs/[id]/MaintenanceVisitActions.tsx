'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type OpportunitySource = 'worker_spotted' | 'customer_requested'
type OpportunityStatus = 'open' | 'quote_created' | 'dismissed'
type CompletionReason = '' | 'no_access' | 'weather' | 'customer_cancelled' | 'materials' | 'ran_out_of_time' | 'other'

type ExtraWork = {
  id: string
  description: string
  source: OpportunitySource
  status: OpportunityStatus
  reportedBy: string
  reportedAt: string
  quoteId: number | null
  photoUrl: string
}

type Controls = {
  propertyMemory: string
  nextVisitNote: string
  extraWork: ExtraWork[]
  outcome: '' | 'completed' | 'could_not_complete'
  completionReason: CompletionReason
  completionNote: string
  completedAt: string
}

type JobPhoto = {
  id: number
  label: string | null
  imageUrl: string
}

type Props = {
  jobId: number
  initialControls: Controls
  initialPropertyMemory?: string
}

const REASON_LABELS: Record<Exclude<CompletionReason, ''>, string> = {
  no_access: 'No access / locked gate',
  weather: 'Weather stopped work',
  customer_cancelled: 'Customer cancelled / asked us not to continue',
  materials: 'Needed materials / equipment',
  ran_out_of_time: 'Ran out of time',
  other: 'Other',
}

export default function MaintenanceVisitActions({ jobId, initialControls, initialPropertyMemory = '' }: Props) {
  const router = useRouter()
  const [controls, setControls] = useState(initialControls)
  const [propertyMemory, setPropertyMemory] = useState(initialControls.propertyMemory || initialPropertyMemory)
  const [nextVisitNote, setNextVisitNote] = useState(initialControls.nextVisitNote)
  const [spottedText, setSpottedText] = useState('')
  const [customerRequestText, setCustomerRequestText] = useState('')
  const [completionReason, setCompletionReason] = useState<CompletionReason>(initialControls.completionReason || '')
  const [completionNote, setCompletionNote] = useState(initialControls.completionNote)
  const [photos, setPhotos] = useState<JobPhoto[]>([])
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    void loadPhotos()
  }, [])

  async function loadPhotos() {
    try {
      const response = await fetch(`/api/jobs/${jobId}/photos`, { cache: 'no-store' })
      if (!response.ok) return
      const data = await response.json().catch(() => [])
      setPhotos(Array.isArray(data) ? data : [])
    } catch {
      // Photos are optional on maintenance visits.
    }
  }

  async function patch(body: Record<string, unknown>) {
    const response = await fetch(`/api/maintenance/jobs/${jobId}/controls`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await response.json().catch(() => null)
    if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Could not save visit update.')
    setControls(data.controls)
    return data.controls as Controls
  }

  async function savePropertyMemory() {
    try {
      setBusy(true)
      setError('')
      setMessage('')
      await patch({ propertyMemory })
      setMessage('Property memory saved for future maintenance visits.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save property memory.')
    } finally {
      setBusy(false)
    }
  }

  async function saveNextVisitNote() {
    try {
      setBusy(true)
      setError('')
      setMessage('')
      await patch({ nextVisitNote })
      setMessage('Next-visit note saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save next-visit note.')
    } finally {
      setBusy(false)
    }
  }

  async function addOpportunity(source: OpportunitySource) {
    const description = (source === 'customer_requested' ? customerRequestText : spottedText).trim()
    if (!description || busy) return

    try {
      setBusy(true)
      setError('')
      setMessage('')
      const response = await fetch(`/api/maintenance/jobs/${jobId}/opportunities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          source,
          photoUrl: photos[0]?.imageUrl || '',
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Could not save opportunity.')

      setControls(data.controls)
      if (source === 'customer_requested') {
        setCustomerRequestText('')
        setMessage(data.quoteId
          ? `Customer request sent to the office and Quote #${data.quoteId} created for Trev/Kelly to review.`
          : 'Customer request sent to the office for quoting.')
      } else {
        setSpottedText('')
        setMessage('Work spotted has been added to the office opportunity queue.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save opportunity.')
    } finally {
      setBusy(false)
    }
  }

  async function uploadPhoto(file: File | null) {
    if (!file || uploading) return
    try {
      setUploading(true)
      setError('')
      setMessage('')
      const formData = new FormData()
      formData.append('file', file)
      formData.append('label', 'Maintenance')
      const workerId = typeof window !== 'undefined' ? localStorage.getItem('workerId') : ''
      if (workerId) formData.append('workerId', workerId)

      const response = await fetch(`/api/jobs/${jobId}/photos`, {
        method: 'POST',
        body: formData,
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || 'Could not upload photo.')
      await loadPhotos()
      setMessage('Photo added. If you log an opportunity next, the latest photo will go with it.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload photo.')
    } finally {
      setUploading(false)
    }
  }

  async function finish(outcome: 'completed' | 'could_not_complete') {
    if (busy) return
    if (outcome === 'could_not_complete' && !completionReason) {
      setError('Choose why the visit could not be completed.')
      return
    }
    if (outcome === 'could_not_complete' && completionReason === 'other' && !completionNote.trim()) {
      setError('Add a short note explaining what stopped the visit.')
      return
    }

    try {
      setBusy(true)
      setError('')
      setMessage('')
      const response = await fetch(`/api/maintenance/jobs/${jobId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome, completionReason, completionNote, nextVisitNote }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Could not finish visit.')
      setControls(data.controls)
      setMessage(outcome === 'completed' ? 'Visit completed.' : 'Visit marked as not completed — office can see the reason and follow it up.')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not finish visit.')
    } finally {
      setBusy(false)
    }
  }

  const isDone = controls.outcome === 'completed'

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Property memory</div>
        <h2 className="mt-1 text-xl font-black text-amber-950">Things everyone should know about this garden</h2>
        <p className="mt-1 text-sm leading-6 text-amber-900">Keep permanent site knowledge here: gate/access, dog, areas not to touch, customer preferences, where green waste goes, awkward taps or anything another worker covering the round needs to know.</p>
        <textarea rows={4} value={propertyMemory} onChange={(event) => setPropertyMemory(event.target.value)} placeholder="e.g. Back gate sticks — lift as you open. Do not strim beside pond. Green waste behind shed." className="mt-4 w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 text-base" />
        <button type="button" onClick={() => void savePropertyMemory()} disabled={busy} className="mt-3 min-h-11 rounded-xl bg-amber-900 px-4 text-sm font-black text-white disabled:opacity-50">Save property memory</button>
      </section>

      <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Next visit</div>
        <h2 className="mt-1 text-xl font-black">Leave the next lad a useful note</h2>
        <p className="mt-1 text-sm leading-6 text-zinc-600">Only add something if it will genuinely help next time — e.g. hedge needs doing, bring long-reach, customer away, weeds getting worse.</p>
        <textarea rows={3} value={nextVisitNote} onChange={(event) => setNextVisitNote(event.target.value)} placeholder="Anything important for the next visit?" className="mt-4 w-full rounded-2xl border border-zinc-200 px-4 py-3 text-base" />
        <button type="button" onClick={() => void saveNextVisitNote()} disabled={busy} className="mt-3 min-h-11 rounded-xl bg-zinc-900 px-4 text-sm font-black text-white disabled:opacity-50">Save next-visit note</button>
      </section>

      <section className="rounded-3xl border border-fuchsia-200 bg-fuchsia-50 p-5 shadow-sm">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-fuchsia-700">Customer asked for something?</div>
        <h2 className="mt-1 text-xl font-black text-fuchsia-950">Create a quote opportunity immediately</h2>
        <p className="mt-1 text-sm leading-6 text-fuchsia-900">Write exactly what they asked for. Don’t give a price or promise the work. A quote draft is created for Trev/Kelly to review and the office gets the lead.</p>
        <textarea rows={3} value={customerRequestText} onChange={(event) => setCustomerRequestText(event.target.value)} placeholder="e.g. Customer asked us to quote for replacing the rear fence and gate" className="mt-4 w-full rounded-2xl border border-fuchsia-200 bg-white px-4 py-3 text-base" />
        <button type="button" onClick={() => void addOpportunity('customer_requested')} disabled={busy || !customerRequestText.trim()} className="mt-3 min-h-11 rounded-xl bg-fuchsia-900 px-4 text-sm font-black text-white disabled:opacity-50">Send as customer quote request</button>
      </section>

      <section className="rounded-3xl border border-purple-200 bg-purple-50 p-5 shadow-sm">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-purple-700">Work spotted</div>
        <h2 className="mt-1 text-xl font-black text-purple-950">Notice something the customer may need?</h2>
        <p className="mt-1 text-sm leading-6 text-purple-900">This goes into the office opportunity queue. Trev/Kelly decide whether it is worth turning into a quote.</p>
        <textarea rows={3} value={spottedText} onChange={(event) => setSpottedText(event.target.value)} placeholder="e.g. Rotten fence panel, tree needs reducing, patio would benefit from pressure washing" className="mt-4 w-full rounded-2xl border border-purple-200 bg-white px-4 py-3 text-base" />
        <button type="button" onClick={() => void addOpportunity('worker_spotted')} disabled={busy || !spottedText.trim()} className="mt-3 min-h-11 rounded-xl bg-purple-900 px-4 text-sm font-black text-white disabled:opacity-50">Add opportunity</button>
      </section>

      {controls.extraWork.length ? (
        <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Logged from this visit</div>
          <div className="mt-3 space-y-2">
            {controls.extraWork.slice().reverse().map((item) => (
              <div key={item.id} className="rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-800">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="font-bold">{item.description}</div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${item.source === 'customer_requested' ? 'bg-fuchsia-100 text-fuchsia-800' : 'bg-purple-100 text-purple-800'}`}>{item.source === 'customer_requested' ? 'Customer asked' : 'Work spotted'}</span>
                </div>
                <div className="mt-2 text-xs font-semibold text-zinc-500">{item.quoteId ? `Quote #${item.quoteId} created for office review` : 'Waiting for office review'}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-3xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">Optional photo</div>
        <h2 className="mt-1 text-xl font-black text-blue-950">Take a photo only when it’s useful</h2>
        <p className="mt-1 text-sm leading-6 text-blue-900">Use one for damage, an opportunity, an access issue, a useful before/after, or anything the office should see. If you upload one before logging an opportunity, the latest photo is attached to that lead.</p>
        <label className="mt-4 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl bg-blue-900 px-4 text-sm font-black text-white">
          {uploading ? 'Uploading...' : 'Add photo'}
          <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(event) => { void uploadPhoto(event.target.files?.[0] || null); event.currentTarget.value = '' }} />
        </label>
        {photos.length ? <div className="mt-3 text-sm font-bold text-blue-900">{photos.length} photo{photos.length === 1 ? '' : 's'} saved on this job.</div> : null}
      </section>

      <section className="rounded-3xl border border-green-200 bg-green-50 p-5 shadow-sm">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-green-700">Finish visit</div>
        <h2 className="mt-1 text-xl font-black text-green-950">Done, or something stopped you?</h2>
        <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-inset ring-green-200">
          <div className="text-sm font-black text-zinc-900">If you couldn’t complete, choose the reason</div>
          <select value={completionReason} onChange={(event) => setCompletionReason(event.target.value as CompletionReason)} className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-base">
            <option value="">Choose a reason only if needed</option>
            {Object.entries(REASON_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <textarea rows={3} value={completionNote} onChange={(event) => setCompletionNote(event.target.value)} placeholder="Optional completion note. If something unusual stopped you, add the useful detail here." className="mt-3 w-full rounded-2xl border border-green-200 bg-white px-4 py-3 text-base" />
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => void finish('completed')} disabled={busy || isDone} className="min-h-12 rounded-xl bg-green-800 px-4 text-sm font-black text-white disabled:opacity-50">✓ Completed</button>
          <button type="button" onClick={() => void finish('could_not_complete')} disabled={busy} className="min-h-12 rounded-xl border border-amber-300 bg-amber-100 px-4 text-sm font-black text-amber-950 disabled:opacity-50">Couldn’t complete</button>
        </div>
        {isDone ? <div className="mt-3 rounded-2xl bg-green-100 px-4 py-3 text-sm font-black text-green-900">✓ This visit is completed</div> : null}
      </section>

      {message ? <div className="rounded-2xl bg-green-50 px-4 py-3 text-sm font-bold text-green-900 ring-1 ring-inset ring-green-200">{message}</div> : null}
      {error ? <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-900 ring-1 ring-inset ring-red-200">{error}</div> : null}
    </div>
  )
}
