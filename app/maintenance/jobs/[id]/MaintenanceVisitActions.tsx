'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type ExtraWork = {
  id: string
  description: string
  reportedBy: string
  reportedAt: string
}

type Controls = {
  nextVisitNote: string
  extraWork: ExtraWork[]
  outcome: '' | 'completed' | 'could_not_complete'
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
}

function newId() {
  return `extra-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export default function MaintenanceVisitActions({ jobId, initialControls }: Props) {
  const router = useRouter()
  const [controls, setControls] = useState(initialControls)
  const [nextVisitNote, setNextVisitNote] = useState(initialControls.nextVisitNote)
  const [extraText, setExtraText] = useState('')
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

  async function addExtraWork() {
    const description = extraText.trim()
    if (!description || busy) return
    try {
      setBusy(true)
      setError('')
      setMessage('')
      const next = [
        ...controls.extraWork,
        {
          id: newId(),
          description,
          reportedBy: '',
          reportedAt: new Date().toISOString(),
        },
      ]
      const saved = await patch({ extraWork: next })
      setExtraText('')
      setControls(saved)
      setMessage('Extra work spotted has been sent to the office for review / quoting.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save extra work.')
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
      setMessage('Photo added.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload photo.')
    } finally {
      setUploading(false)
    }
  }

  async function finish(outcome: 'completed' | 'could_not_complete') {
    if (busy) return
    if (outcome === 'could_not_complete' && !completionNote.trim()) {
      setError('Add a short reason so the office knows what needs sorting.')
      return
    }

    try {
      setBusy(true)
      setError('')
      setMessage('')
      const response = await fetch(`/api/maintenance/jobs/${jobId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome, completionNote, nextVisitNote }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Could not finish visit.')
      setControls(data.controls)
      setMessage(outcome === 'completed' ? 'Visit completed.' : 'Visit marked as not completed — office can follow this up.')
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
      <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Next visit</div>
        <h2 className="mt-1 text-xl font-black">Leave the next lad a useful note</h2>
        <p className="mt-1 text-sm leading-6 text-zinc-600">Only add something if it will genuinely help next time — e.g. hedge needs doing, bring long-reach, customer away, weeds getting worse.</p>
        <textarea
          rows={3}
          value={nextVisitNote}
          onChange={(event) => setNextVisitNote(event.target.value)}
          placeholder="Anything important for the next visit?"
          className="mt-4 w-full rounded-2xl border border-zinc-200 px-4 py-3 text-base"
        />
        <button type="button" onClick={() => void saveNextVisitNote()} disabled={busy} className="mt-3 min-h-11 rounded-xl bg-zinc-900 px-4 text-sm font-black text-white disabled:opacity-50">Save next-visit note</button>
      </section>

      <section className="rounded-3xl border border-purple-200 bg-purple-50 p-5 shadow-sm">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-purple-700">Extra work spotted</div>
        <h2 className="mt-1 text-xl font-black text-purple-950">Something the customer may need quoting?</h2>
        <p className="mt-1 text-sm leading-6 text-purple-900">Log it here. Don’t price it or promise the work — Trev/Kelly can follow it up.</p>
        <textarea
          rows={3}
          value={extraText}
          onChange={(event) => setExtraText(event.target.value)}
          placeholder="e.g. Rotten fence panel, tree needs reducing, patio would benefit from pressure washing"
          className="mt-4 w-full rounded-2xl border border-purple-200 bg-white px-4 py-3 text-base"
        />
        <button type="button" onClick={() => void addExtraWork()} disabled={busy || !extraText.trim()} className="mt-3 min-h-11 rounded-xl bg-purple-900 px-4 text-sm font-black text-white disabled:opacity-50">Send to office</button>
        {controls.extraWork.length ? (
          <div className="mt-4 space-y-2">
            {controls.extraWork.map((item) => (
              <div key={item.id} className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-zinc-800 ring-1 ring-inset ring-purple-200">• {item.description}</div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">Optional photo</div>
        <h2 className="mt-1 text-xl font-black text-blue-950">Take a photo only when it’s useful</h2>
        <p className="mt-1 text-sm leading-6 text-blue-900">No compulsory photos for routine maintenance. Use one for damage, extra work, an access issue, a useful before/after, or anything the office should see.</p>
        <label className="mt-4 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl bg-blue-900 px-4 text-sm font-black text-white">
          {uploading ? 'Uploading...' : 'Add photo'}
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploading} onChange={(event) => { void uploadPhoto(event.target.files?.[0] || null); event.currentTarget.value = '' }} />
        </label>
        {photos.length ? <div className="mt-3 text-sm font-bold text-blue-900">{photos.length} photo{photos.length === 1 ? '' : 's'} saved on this job.</div> : null}
      </section>

      <section className="rounded-3xl border border-green-200 bg-green-50 p-5 shadow-sm">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-green-700">Finish visit</div>
        <h2 className="mt-1 text-xl font-black text-green-950">Done, or something stopped you?</h2>
        <textarea
          rows={3}
          value={completionNote}
          onChange={(event) => setCompletionNote(event.target.value)}
          placeholder="Optional if completed. Required if you couldn't complete — tell the office why."
          className="mt-4 w-full rounded-2xl border border-green-200 bg-white px-4 py-3 text-base"
        />
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
