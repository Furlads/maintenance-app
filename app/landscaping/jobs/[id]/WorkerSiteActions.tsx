'use client'

import { useEffect, useMemo, useState } from 'react'

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
  qualityChecked: boolean
  workerSignedOff: boolean
  workerSignedOffAt: string
  customerStatus: '' | 'happy' | 'issue' | 'not_available'
  customerName: string
  customerConfirmed: boolean
  customerSignedOffAt: string
  outstandingItems: string
  completedAt: string
}

type JobPhoto = {
  id: number
  label: string | null
  imageUrl: string
  createdAt: string
}

type Props = {
  jobId: number
  initialSiteIssues: SiteIssue[]
  initialVariations: Variation[]
  initialCompletion: Completion
  defaultCustomerName?: string
  section?: 'all' | 'variation' | 'bottom'
}

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function isAfterPhoto(photo: JobPhoto) {
  return String(photo.label || '').trim().toLowerCase() === 'after'
}

export default function WorkerSiteActions({
  jobId,
  initialSiteIssues,
  initialVariations,
  initialCompletion,
  defaultCustomerName = '',
  section = 'all',
}: Props) {
  const [issues, setIssues] = useState(initialSiteIssues)
  const [variations, setVariations] = useState(initialVariations)
  const [completion, setCompletion] = useState<Completion>({
    ...initialCompletion,
    customerName: initialCompletion.customerName || defaultCustomerName,
  })
  const [photos, setPhotos] = useState<JobPhoto[]>([])
  const [issueText, setIssueText] = useState('')
  const [variationText, setVariationText] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const showVariation = section === 'all' || section === 'variation'
  const showBottom = section === 'all' || section === 'bottom'
  const afterPhotos = useMemo(() => photos.filter(isAfterPhoto), [photos])

  const openIssues = issues.filter((issue) => !issue.resolved).length
  const pendingVariations = variations.filter((variation) => variation.status === 'pending').length
  const customerReady = completion.customerStatus === 'not_available' || (
    completion.customerStatus === 'happy' &&
    completion.customerName.trim() !== '' &&
    completion.customerConfirmed
  )
  const canComplete = (
    afterPhotos.length >= 3 &&
    completion.qualityChecked &&
    completion.workerSignedOff &&
    customerReady &&
    openIssues === 0 &&
    pendingVariations === 0 &&
    !completion.completedAt
  )

  useEffect(() => {
    if (!showBottom) return

    let cancelled = false
    async function loadPhotos() {
      try {
        const response = await fetch(`/api/jobs/${jobId}/photos`, { cache: 'no-store' })
        const data = await response.json().catch(() => [])
        if (!cancelled && response.ok && Array.isArray(data)) setPhotos(data)
      } catch {
        // The completion panel still works; upload will surface any real error.
      }
    }

    void loadPhotos()
    return () => { cancelled = true }
  }, [jobId, showBottom])

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

  async function saveCompletion(next: Completion, successMessage?: string) {
    setCompletion(next)
    try {
      setSaving(true)
      setError('')
      const controls = await patch({ completion: next })
      setCompletion(controls.completion || next)
      if (successMessage) setMessage(successMessage)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save sign-off.')
    } finally {
      setSaving(false)
    }
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

  async function uploadAfterPhotos(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || [])
    if (!files.length) return

    try {
      setUploading(true)
      setError('')
      setMessage('')

      const uploaded: JobPhoto[] = []
      for (const file of files) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('label', 'After')

        const response = await fetch(`/api/jobs/${jobId}/photos`, {
          method: 'POST',
          body: formData,
        })
        const data = await response.json().catch(() => null)
        if (!response.ok) throw new Error(data?.error || 'Could not upload after photo.')
        uploaded.push(data as JobPhoto)
      }

      setPhotos((current) => [...uploaded, ...current])
      setMessage(`${uploaded.length} after photo${uploaded.length === 1 ? '' : 's'} uploaded.`)
      event.target.value = ''
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload after photos.')
    } finally {
      setUploading(false)
    }
  }

  async function recordWorkerSignOff() {
    if (!completion.qualityChecked || afterPhotos.length < 3) return
    await saveCompletion({
      ...completion,
      workerSignedOff: true,
      workerSignedOffAt: new Date().toISOString(),
    }, 'Worker sign-off recorded.')
  }

  async function recordCustomerHandover() {
    if (!completion.customerStatus) {
      setError('Choose the customer handover outcome first.')
      return
    }
    if (completion.customerStatus === 'happy' && !completion.customerName.trim()) {
      setError('Enter the customer name for sign-off.')
      return
    }
    if (completion.customerStatus === 'happy' && !completion.customerConfirmed) {
      setError('Confirm that the customer has seen and accepted the completed work.')
      return
    }
    if (completion.customerStatus === 'issue' && !completion.outstandingItems.trim()) {
      setError('Record the customer concern / outstanding item before saving the handover.')
      return
    }

    await saveCompletion({
      ...completion,
      customerSignedOffAt: new Date().toISOString(),
    }, 'Customer handover recorded.')
  }

  async function completeJob() {
    if (!canComplete || completing) return
    try {
      setCompleting(true)
      setError('')
      setMessage('')
      const response = await fetch(`/api/landscaping/jobs/${jobId}/complete`, { method: 'POST' })
      const data = await response.json().catch(() => null)
      if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Could not complete the job.')
      setCompletion(data.completion || { ...completion, completedAt: data.completedAt })
      setMessage('✓ Job completed and handover saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete the job.')
    } finally {
      setCompleting(false)
    }
  }

  return (
    <div className="space-y-4">
      {showVariation ? (
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
      ) : null}

      {showBottom ? (
        <>
          <section className="rounded-3xl border border-red-200 bg-red-50 p-5 shadow-sm">
            <div className="text-xs font-black uppercase tracking-[0.16em] text-red-700">Problem on site?</div>
            <h2 className="mt-1 text-xl font-black text-red-950">Tell Trev / Kelly before it becomes a bigger problem</h2>
            <textarea value={issueText} onChange={(event) => setIssueText(event.target.value)} rows={3} placeholder="e.g. Found buried concrete across the patio area / access is blocked / customer has moved the agreed line" className="mt-4 w-full rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm leading-6 text-zinc-900" />
            <button type="button" onClick={() => void submitIssue()} disabled={saving || !issueText.trim()} className="mt-3 min-h-11 rounded-xl bg-red-900 px-4 text-sm font-black text-white disabled:opacity-50">Report problem</button>
            {openIssues ? <div className="mt-3 text-xs font-bold text-red-800">{openIssues} open site issue{openIssues === 1 ? '' : 's'} recorded.</div> : null}
          </section>

          <section className="rounded-3xl border border-green-200 bg-green-50 p-5 shadow-sm">
            <div className="text-xs font-black uppercase tracking-[0.16em] text-green-700">Job handover</div>
            <h2 className="mt-1 text-xl font-black text-green-950">Photos, checks & sign-off</h2>
            <p className="mt-1 text-sm leading-6 text-green-900">Finish with evidence, not paperwork for paperwork’s sake. Upload the finished job, check the quality, hand it over to the customer, then complete it.</p>

            <div className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-inset ring-green-200">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-black text-zinc-950">1. After photos</div>
                  <div className="mt-1 text-sm text-zinc-600">Minimum 3: a good overall view plus useful finish/detail shots.</div>
                </div>
                <div className={`rounded-full px-3 py-1 text-xs font-black ${afterPhotos.length >= 3 ? 'bg-green-100 text-green-900' : 'bg-amber-100 text-amber-900'}`}>
                  {afterPhotos.length}/3 minimum
                </div>
              </div>

              <label className="mt-4 flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-green-300 bg-green-50 px-4 text-sm font-black text-green-900">
                {uploading ? 'Uploading…' : '+ Take / upload after photos'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  capture="environment"
                  multiple
                  disabled={uploading}
                  onChange={(event) => void uploadAfterPhotos(event)}
                  className="hidden"
                />
              </label>

              {afterPhotos.length ? (
                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {afterPhotos.slice(0, 8).map((photo) => (
                    <img key={photo.id} src={photo.imageUrl} alt="After job" className="aspect-square w-full rounded-xl object-cover ring-1 ring-zinc-200" />
                  ))}
                </div>
              ) : null}
            </div>

            <div className="mt-3 rounded-2xl bg-white p-4 ring-1 ring-inset ring-green-200">
              <div className="font-black text-zinc-950">2. Final quality check</div>
              <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl bg-zinc-50 p-3 text-sm font-semibold leading-6 text-zinc-800">
                <input
                  type="checkbox"
                  checked={completion.qualityChecked}
                  onChange={(event) => void saveCompletion({ ...completion, qualityChecked: event.target.checked })}
                  className="mt-1 h-5 w-5"
                />
                <span>I have checked the finished lines / levels / falls, pointing / edges / snagging, site cleanliness, tools / boards / leftover materials, and that any issue or extra has been reported.</span>
              </label>
            </div>

            <div className="mt-3 rounded-2xl bg-white p-4 ring-1 ring-inset ring-green-200">
              <div className="font-black text-zinc-950">3. Worker sign-off</div>
              <p className="mt-1 text-sm leading-6 text-zinc-600">Confirm the job has been checked against the plan and is ready to hand over.</p>
              <button
                type="button"
                onClick={() => void recordWorkerSignOff()}
                disabled={saving || completion.workerSignedOff || !completion.qualityChecked || afterPhotos.length < 3}
                className="mt-3 min-h-11 rounded-xl bg-zinc-950 px-4 text-sm font-black text-white disabled:opacity-40"
              >
                {completion.workerSignedOff ? '✓ Worker signed off' : 'Sign off finished work'}
              </button>
            </div>

            <div className="mt-3 rounded-2xl bg-white p-4 ring-1 ring-inset ring-green-200">
              <div className="font-black text-zinc-950">4. Customer handover</div>
              <p className="mt-1 text-sm leading-6 text-zinc-600">This confirms the physical work they have seen. It does not waive customer rights or approve unknown charges.</p>

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {([
                  ['happy', '✓ Happy with completed work'],
                  ['issue', '⚠ Issue / snag raised'],
                  ['not_available', 'Customer not available'],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCompletion((current) => ({
                      ...current,
                      customerStatus: value,
                      customerConfirmed: value === 'happy' ? current.customerConfirmed : false,
                      customerSignedOffAt: '',
                    }))}
                    className={`min-h-11 rounded-xl px-3 text-sm font-black ring-1 ring-inset ${completion.customerStatus === value ? 'bg-green-100 text-green-950 ring-green-300' : 'bg-zinc-50 text-zinc-700 ring-zinc-200'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {completion.customerStatus === 'happy' ? (
                <div className="mt-3 space-y-3">
                  <label className="block text-xs font-bold text-zinc-600">
                    Customer name
                    <input
                      value={completion.customerName}
                      onChange={(event) => setCompletion((current) => ({ ...current, customerName: event.target.value, customerSignedOffAt: '' }))}
                      className="mt-1 min-h-11 w-full rounded-xl border border-zinc-300 px-3 text-sm text-zinc-900"
                    />
                  </label>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-green-50 p-3 text-sm font-semibold leading-6 text-green-950">
                    <input
                      type="checkbox"
                      checked={completion.customerConfirmed}
                      onChange={(event) => setCompletion((current) => ({ ...current, customerConfirmed: event.target.checked, customerSignedOffAt: '' }))}
                      className="mt-1 h-5 w-5"
                    />
                    <span>The customer has seen the completed work and confirms they are happy with the physical work shown to them.</span>
                  </label>
                </div>
              ) : null}

              <label className="mt-3 block text-xs font-bold text-zinc-600">
                Outstanding items / customer concern
                <textarea
                  value={completion.outstandingItems}
                  onChange={(event) => setCompletion((current) => ({ ...current, outstandingItems: event.target.value, customerSignedOffAt: '' }))}
                  rows={3}
                  placeholder={completion.customerStatus === 'issue' ? 'Required: describe the issue / snag and what happens next' : 'Optional: anything to return for or note for Trev/Kelly'}
                  className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm leading-6 text-zinc-900"
                />
              </label>

              <button
                type="button"
                onClick={() => void recordCustomerHandover()}
                disabled={saving || !completion.customerStatus}
                className="mt-3 min-h-11 rounded-xl bg-green-800 px-4 text-sm font-black text-white disabled:opacity-40"
              >
                {completion.customerSignedOffAt ? '✓ Customer handover recorded' : 'Record customer handover'}
              </button>
            </div>

            <div className="mt-4 rounded-2xl bg-zinc-950 p-4 text-white">
              <div className="font-black">5. Complete job</div>
              <div className="mt-2 grid gap-1 text-xs font-semibold text-zinc-300 sm:grid-cols-2">
                <div>{afterPhotos.length >= 3 ? '✓' : '○'} 3+ after photos</div>
                <div>{completion.qualityChecked ? '✓' : '○'} Quality checked</div>
                <div>{completion.workerSignedOff ? '✓' : '○'} Worker signed off</div>
                <div>{customerReady ? '✓' : '○'} Customer handover</div>
                <div>{openIssues === 0 ? '✓' : '○'} No open site issues</div>
                <div>{pendingVariations === 0 ? '✓' : '○'} No extras awaiting decision</div>
              </div>
              <button
                type="button"
                onClick={() => void completeJob()}
                disabled={!canComplete || completing}
                className="mt-4 min-h-12 w-full rounded-xl bg-green-400 px-4 text-sm font-black text-zinc-950 disabled:bg-zinc-700 disabled:text-zinc-400"
              >
                {completion.completedAt ? '✓ Job completed' : completing ? 'Completing…' : 'Complete job'}
              </button>
              {completion.customerStatus === 'issue' ? <div className="mt-2 text-xs font-bold text-amber-300">Customer issue raised — job cannot be completed until it is dealt with.</div> : null}
            </div>
          </section>
        </>
      ) : null}

      {message ? <div className="rounded-2xl bg-green-50 px-4 py-3 text-sm font-bold text-green-900 ring-1 ring-inset ring-green-200">{message}</div> : null}
      {error ? <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-900 ring-1 ring-inset ring-red-200">{error}</div> : null}
    </div>
  )
}
