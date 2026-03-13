'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'

type Worker = {
  id: number
  firstName: string
  lastName: string
  phone: string | null
}

type JobAssignment = {
  id: number
  workerId: number
  worker: Worker
}

type Customer = {
  id: number
  name: string
  phone: string | null
  address: string | null
  postcode: string | null
}

type Job = {
  id: number
  title: string
  address: string
  notes: string | null
  status: string
  jobType: string
  createdAt: string
  customer: Customer
  assignments: JobAssignment[]
  visitDate?: string | null
  startTime?: string | null
  durationMinutes?: number | null
  overrunMins?: number | null
  pausedMinutes?: number | null
  arrivedAt?: string | null
  pausedAt?: string | null
  finishedAt?: string | null
}

type JobPhoto = {
  id: number
  jobId: number
  uploadedByWorkerId: number | null
  label: string | null
  imageUrl: string
  createdAt: string
}

type CannotCompleteInfo = {
  reason: string
  details: string
  reportedBy: string
  recordedAt: string
  rawLine: string
}

function extractCannotCompleteInfo(notes: string | null): CannotCompleteInfo | null {
  if (!notes) return null

  const lines = notes
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const matchingLine = [...lines]
    .reverse()
    .find((line) => line.toLowerCase().startsWith('job could not be completed:'))

  if (!matchingLine) return null

  const parts = matchingLine.split(' | ').map((part) => part.trim())

  const reasonPart =
    parts.find((part) =>
      part.toLowerCase().startsWith('job could not be completed:')
    ) || ''

  const detailsPart =
    parts.find((part) => part.toLowerCase().startsWith('details:')) || ''

  const reportedByPart =
    parts.find((part) => part.toLowerCase().startsWith('reported by:')) || ''

  const recordedAtPart =
    parts.find((part) => part.toLowerCase().startsWith('recorded at:')) || ''

  return {
    reason: reasonPart.replace(/^job could not be completed:\s*/i, '').trim(),
    details: detailsPart.replace(/^details:\s*/i, '').trim(),
    reportedBy: reportedByPart.replace(/^reported by:\s*/i, '').trim(),
    recordedAt: recordedAtPart.replace(/^recorded at:\s*/i, '').trim(),
    rawLine: matchingLine
  }
}

function stripCannotCompleteLines(notes: string | null) {
  if (!notes) return ''

  return notes
    .split('\n')
    .map((line) => line.trim())
    .filter(
      (line) =>
        line &&
        !line.toLowerCase().startsWith('job could not be completed:')
    )
    .join('\n')
}

function formatTime(value?: string | null) {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatMinutes(totalMinutes?: number | null) {
  if (!totalMinutes || totalMinutes <= 0) return '0m'

  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60

  if (hours > 0 && mins > 0) {
    return `${hours}h ${mins}m`
  }

  if (hours > 0) {
    return `${hours}h`
  }

  return `${mins}m`
}

function statusBadgeClass(status: string) {
  const value = String(status || '').toLowerCase()

  if (value === 'done' || value === 'completed') {
    return 'bg-green-50 text-green-700 ring-green-200'
  }

  if (value === 'inprogress' || value === 'in_progress') {
    return 'bg-blue-50 text-blue-700 ring-blue-200'
  }

  if (value === 'scheduled' || value === 'todo') {
    return 'bg-amber-50 text-amber-700 ring-amber-200'
  }

  return 'bg-zinc-100 text-zinc-700 ring-zinc-200'
}

export default function JobPage() {
  const params = useParams()
  const id = Number(params.id)

  const [job, setJob] = useState<Job | null>(null)
  const [photos, setPhotos] = useState<JobPhoto[]>([])
  const [label, setLabel] = useState('Before')
  const [uploading, setUploading] = useState(false)
  const [deletingPhotoId, setDeletingPhotoId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [photoMessage, setPhotoMessage] = useState('')
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const [busyAction, setBusyAction] = useState('')

  const [showQuoteForm, setShowQuoteForm] = useState(false)
  const [quoteBusy, setQuoteBusy] = useState(false)
  const [quoteMessage, setQuoteMessage] = useState('')
  const [quoteCustomerName, setQuoteCustomerName] = useState('')
  const [quoteCustomerPhone, setQuoteCustomerPhone] = useState('')
  const [quoteCustomerEmail, setQuoteCustomerEmail] = useState('')
  const [quoteCustomerAddress, setQuoteCustomerAddress] = useState('')
  const [quoteCustomerPostcode, setQuoteCustomerPostcode] = useState('')
  const [quoteWorkSummary, setQuoteWorkSummary] = useState('')
  const [quoteEstimatedTime, setQuoteEstimatedTime] = useState('')
  const [quoteNotes, setQuoteNotes] = useState('')

  async function loadPhotos() {
    const res = await fetch(`/api/jobs/${id}/photos`, { cache: 'no-store' })

    if (!res.ok) {
      throw new Error('Failed to load photos')
    }

    const data = await res.json()
    setPhotos(Array.isArray(data) ? data : [])
  }

  async function loadJob() {
    try {
      setError('')

      const [jobRes, photoRes] = await Promise.all([
        fetch('/api/jobs', { cache: 'no-store' }),
        fetch(`/api/jobs/${id}/photos`, { cache: 'no-store' })
      ])

      if (!jobRes.ok) {
        throw new Error('Failed to load jobs')
      }

      if (!photoRes.ok) {
        throw new Error('Failed to load photos')
      }

      const jobData = await jobRes.json()
      const jobs = Array.isArray(jobData) ? jobData : []
      const foundJob = jobs.find((item: Job) => item.id === id) || null
      setJob(foundJob)

      const photoData = await photoRes.json()
      setPhotos(Array.isArray(photoData) ? photoData : [])
    } catch (err) {
      console.error(err)
      setError('Failed to load job.')
      setJob(null)
      setPhotos([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (id) {
      loadJob()
    }
  }, [id])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (viewerIndex === null) return

      if (event.key === 'Escape') {
        setViewerIndex(null)
      }

      if (event.key === 'ArrowLeft') {
        setViewerIndex((current) => {
          if (current === null) return current
          return current > 0 ? current - 1 : current
        })
      }

      if (event.key === 'ArrowRight') {
        setViewerIndex((current) => {
          if (current === null) return current
          return current < photos.length - 1 ? current + 1 : current
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [viewerIndex, photos.length])

  useEffect(() => {
    if (!showQuoteForm || !job) return

    setQuoteCustomerName(job.customer?.name || '')
    setQuoteCustomerPhone(job.customer?.phone || '')
    setQuoteCustomerEmail('')
    setQuoteCustomerAddress(job.customer?.address || job.address || '')
    setQuoteCustomerPostcode(job.customer?.postcode || '')
    setQuoteWorkSummary(job.title || '')
    setQuoteEstimatedTime('')
    setQuoteNotes('')
    setQuoteMessage('')
  }, [showQuoteForm, job])

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    const workerId = localStorage.getItem('workerId')

    if (!file || !id) return

    setUploading(true)
    setPhotoMessage('')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('label', label)

      if (workerId) {
        formData.append('workerId', workerId)
      }

      const res = await fetch(`/api/jobs/${id}/photos`, {
        method: 'POST',
        body: formData
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to upload photo')
      }

      if (data && typeof data === 'object' && typeof data.id === 'number') {
        setPhotos((current) => [data as JobPhoto, ...current])
      } else {
        await loadPhotos()
      }

      setPhotoMessage('Photo uploaded successfully.')
      event.target.value = ''
    } catch (error) {
      console.error(error)
      setPhotoMessage('Failed to upload photo.')
    } finally {
      setUploading(false)
    }
  }

  async function handleDeletePhoto(photoId: number) {
    const confirmed = window.confirm('Delete this photo?')

    if (!confirmed) return

    setDeletingPhotoId(photoId)
    setPhotoMessage('')

    try {
      const res = await fetch(`/api/job-photos/${photoId}`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Failed to delete photo')
      }

      setPhotos((current) => current.filter((photo) => photo.id !== photoId))
      setPhotoMessage('Photo deleted successfully.')
      setViewerIndex((current) => {
        if (current === null) return current

        const deletedIndex = photos.findIndex((photo) => photo.id === photoId)

        if (deletedIndex === -1) return current
        if (current === deletedIndex) return null
        if (current > deletedIndex) return current - 1

        return current
      })
    } catch (error) {
      console.error(error)
      setPhotoMessage('Failed to delete photo.')
    } finally {
      setDeletingPhotoId(null)
    }
  }

  async function patchJob(payload: Record<string, unknown>, actionLabel: string) {
    try {
      setBusyAction(actionLabel)
      setError('')

      const res = await fetch(`/api/jobs/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || `Failed to ${actionLabel}`)
      }

      await loadJob()
    } catch (err) {
      console.error(err)
      setError(`Failed to ${actionLabel}.`)
    } finally {
      setBusyAction('')
    }
  }

  async function handleSendQuoteRequest() {
    const workerName = localStorage.getItem('workerName') || ''
    const company = localStorage.getItem('company') || 'furlads'

    setQuoteBusy(true)
    setQuoteMessage('')

    try {
      const res = await fetch('/api/chas/quote-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          company,
          worker: workerName,
          sessionId: `job-${id}-${Date.now()}`,
          customerName: quoteCustomerName,
          customerPhone: quoteCustomerPhone,
          customerEmail: quoteCustomerEmail,
          customerAddress: quoteCustomerAddress,
          customerPostcode: quoteCustomerPostcode,
          workSummary: quoteWorkSummary,
          estimatedTimeText: quoteEstimatedTime,
          notes: quoteNotes,
          imageDataUrl: '',
          chatTranscript: `New Quote created from job page for job ${job?.id ?? id}: ${job?.title || ''}`
        })
      })

      const data = await res.json().catch(() => null)

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Failed to save quote enquiry.')
      }

      setQuoteMessage('Quote enquiry saved successfully.')
      setShowQuoteForm(false)
    } catch (err: any) {
      console.error(err)
      setQuoteMessage(String(err?.message || 'Failed to save quote enquiry.'))
    } finally {
      setQuoteBusy(false)
    }
  }

  async function handleStartJob() {
    await patchJob({ action: 'start' }, 'start job')
  }

  async function handleFinishJob() {
    await patchJob({ action: 'finish' }, 'finish job')
  }

  async function handlePauseJob() {
    await patchJob({ action: 'pause' }, 'pause job')
  }

  async function handleResumeJob() {
    await patchJob({ action: 'resume' }, 'resume job')
  }

  async function handleUndoStart() {
    await patchJob(
      {
        arrivedAt: null,
        pausedAt: null,
        pausedMinutes: 0,
        status: 'todo'
      },
      'undo start'
    )
  }

  async function handleExtendJob(minutes: number) {
    await patchJob({ extendMins: minutes }, 'extend job')
  }

  async function handleOtherExtendJob() {
    const value = window.prompt('How many extra minutes?', '90')

    if (value === null) return

    const minutes = Number(value)

    if (!Number.isFinite(minutes) || minutes <= 0) {
      window.alert('Please enter a valid number of minutes.')
      return
    }

    await handleExtendJob(Math.round(minutes))
  }

  async function handleCannotComplete() {
    const workerName = localStorage.getItem('workerName') || ''

    const reasonInput = window.prompt(
      `Why couldn't the job be completed?

Examples:
No access
Customer cancelled
Need materials
Ran out of time
Weather stopped work`,
      ''
    )

    if (reasonInput === null) return

    const reason = reasonInput.trim()

    if (!reason) {
      window.alert('Please enter a reason.')
      return
    }

    const detailsInput = window.prompt(
      `Add any extra details if needed (optional)

Examples:
Gate locked
Customer asked us to return next week
Heavy rain made it unsafe`,
      ''
    )

    if (detailsInput === null) return

    const details = detailsInput.trim()

    await patchJob(
      {
        action: 'cannot_complete',
        reason,
        details,
        workerName
      },
      "mark job as couldn't complete"
    )
  }

  function openViewer(index: number) {
    setViewerIndex(index)
  }

  function closeViewer() {
    setViewerIndex(null)
  }

  function showPreviousPhoto() {
    setViewerIndex((current) => {
      if (current === null) return current
      return current > 0 ? current - 1 : current
    })
  }

  function showNextPhoto() {
    setViewerIndex((current) => {
      if (current === null) return current
      return current < photos.length - 1 ? current + 1 : current
    })
  }

  const cannotCompleteInfo = useMemo(
    () => extractCannotCompleteInfo(job?.notes ?? null),
    [job?.notes]
  )

  const visibleNotes = useMemo(
    () => stripCannotCompleteLines(job?.notes ?? null),
    [job?.notes]
  )

  const isDone =
    job ? String(job.status || '').toLowerCase() === 'done' || !!job.finishedAt : false

  const isPaused =
    !!job?.arrivedAt && !!job?.pausedAt && !job?.finishedAt && !isDone

  const isStarted =
    !!job?.arrivedAt && !job?.finishedAt && !isDone && !isPaused

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-5">
        <p className="text-sm text-zinc-600">Loading job...</p>
      </main>
    )
  }

  if (error && !job) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-5">
        <p className="text-sm text-red-700">{error}</p>
      </main>
    )
  }

  if (!job) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-5">
        <p className="text-sm text-zinc-600">Job not found.</p>
      </main>
    )
  }

  const navigationQuery =
    job.customer?.postcode || job.address || job.customer?.address || ''

  const activePhoto =
    viewerIndex !== null && photos[viewerIndex] ? photos[viewerIndex] : null

  return (
    <main className="mx-auto max-w-5xl px-4 py-5">
      <div className="mb-4">
        <a
          href="/today"
          className="inline-flex items-center rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-800"
        >
          ← Back to Today
        </a>
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{job.title}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {job.customer?.name || 'Unknown customer'}
          </p>
        </div>

        <span
          className={`inline-flex w-fit rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ${statusBadgeClass(
            job.status
          )}`}
        >
          {job.status}
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {cannotCompleteInfo && (
        <div className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <h2 className="mb-3 text-lg font-bold text-amber-900">
            Job could not be completed
          </h2>

          <p className="mb-1 text-sm text-amber-900">
            <strong>Reason:</strong> {cannotCompleteInfo.reason || 'Not provided'}
          </p>

          {cannotCompleteInfo.details && (
            <p className="mb-1 text-sm text-amber-900">
              <strong>Details:</strong> {cannotCompleteInfo.details}
            </p>
          )}

          {cannotCompleteInfo.reportedBy && (
            <p className="mb-1 text-sm text-amber-900">
              <strong>Reported by:</strong> {cannotCompleteInfo.reportedBy}
            </p>
          )}

          {cannotCompleteInfo.recordedAt && (
            <p className="text-sm text-amber-900">
              <strong>Recorded at:</strong> {cannotCompleteInfo.recordedAt}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-zinc-900">Job details</h2>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="text-sm text-zinc-700">
                <span className="font-semibold">Customer:</span>{' '}
                {job.customer?.name || 'Unknown customer'}
              </div>

              <div className="text-sm text-zinc-700">
                <span className="font-semibold">Type:</span> {job.jobType}
              </div>

              <div className="text-sm text-zinc-700 sm:col-span-2">
                <span className="font-semibold">Address:</span> {job.address}
              </div>

              <div className="text-sm text-zinc-700">
                <span className="font-semibold">Visit date:</span>{' '}
                {job.visitDate ? formatDateTime(job.visitDate) : '—'}
              </div>

              <div className="text-sm text-zinc-700">
                <span className="font-semibold">Start time:</span> {job.startTime || '—'}
              </div>

              <div className="text-sm text-zinc-700">
                <span className="font-semibold">Duration:</span>{' '}
                {formatMinutes(job.durationMinutes)}
              </div>

              <div className="text-sm text-zinc-700">
                <span className="font-semibold">Overrun:</span>{' '}
                {formatMinutes(job.overrunMins)}
              </div>

              <div className="text-sm text-zinc-700">
                <span className="font-semibold">Paused:</span>{' '}
                {formatMinutes(job.pausedMinutes)}
              </div>

              <div className="text-sm text-zinc-700">
                <span className="font-semibold">Started at:</span>{' '}
                {formatTime(job.arrivedAt)}
              </div>

              <div className="text-sm text-zinc-700">
                <span className="font-semibold">Paused at:</span>{' '}
                {formatTime(job.pausedAt)}
              </div>

              <div className="text-sm text-zinc-700">
                <span className="font-semibold">Finished at:</span>{' '}
                {formatTime(job.finishedAt)}
              </div>

              <div className="text-sm text-zinc-700 sm:col-span-2">
                <span className="font-semibold">Assigned:</span>{' '}
                {job.assignments.length > 0
                  ? job.assignments
                      .map(
                        (assignment) =>
                          `${assignment.worker.firstName} ${assignment.worker.lastName}`
                      )
                      .join(', ')
                  : 'Nobody assigned'}
              </div>

              {visibleNotes && (
                <div className="whitespace-pre-line text-sm text-zinc-700 sm:col-span-2">
                  <span className="font-semibold">Notes:</span> {visibleNotes}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-zinc-900">Job actions</h2>

            <div className="mb-3 flex flex-wrap gap-3">
              {!isStarted && !isPaused && !isDone && (
                <button
                  type="button"
                  onClick={handleStartJob}
                  disabled={busyAction !== ''}
                  className="rounded-xl bg-zinc-900 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyAction === 'start job' ? 'Updating...' : 'Start Job'}
                </button>
              )}

              {isStarted && (
                <>
                  <button
                    type="button"
                    onClick={handleFinishJob}
                    disabled={busyAction !== ''}
                    className="rounded-xl bg-zinc-900 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyAction === 'finish job' ? 'Updating...' : 'Finish Job'}
                  </button>

                  <button
                    type="button"
                    onClick={handlePauseJob}
                    disabled={busyAction !== ''}
                    className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyAction === 'pause job' ? 'Updating...' : 'Pause Work'}
                  </button>
                </>
              )}

              {isPaused && (
                <>
                  <button
                    type="button"
                    onClick={handleResumeJob}
                    disabled={busyAction !== ''}
                    className="rounded-xl bg-zinc-900 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyAction === 'resume job' ? 'Updating...' : 'Resume Work'}
                  </button>

                  <button
                    type="button"
                    onClick={handleFinishJob}
                    disabled={busyAction !== ''}
                    className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyAction === 'finish job' ? 'Updating...' : 'Finish Job'}
                  </button>
                </>
              )}

              {(isStarted || isPaused) && (
                <>
                  <button
                    type="button"
                    onClick={handleUndoStart}
                    disabled={busyAction !== ''}
                    className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyAction === 'undo start' ? 'Updating...' : 'Undo Start'}
                  </button>

                  <button
                    type="button"
                    onClick={handleCannotComplete}
                    disabled={busyAction !== ''}
                    className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyAction === "mark job as couldn't complete"
                      ? 'Updating...'
                      : "Couldn't Complete"}
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => {
                  setShowQuoteForm((prev) => !prev)
                  setQuoteMessage('')
                }}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-800"
              >
                {showQuoteForm ? 'Hide New Quote' : 'New Quote'}
              </button>

              <a
                href={`/jobs/add?customerId=${job.customer?.id}&title=${encodeURIComponent(
                  job.title
                )}&address=${encodeURIComponent(job.address || '')}&postcode=${encodeURIComponent(
                  job.customer?.postcode || ''
                )}&jobType=${encodeURIComponent(job.jobType || '')}`}
                className="inline-flex rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-800"
              >
                Book Extra Day
              </a>
            </div>

            {showQuoteForm && (
              <div className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="mb-3 text-lg font-extrabold text-zinc-900">
                  New Quote
                </div>

                <div className="grid gap-3">
                  <input
                    value={quoteCustomerName}
                    onChange={(e) => setQuoteCustomerName(e.target.value)}
                    placeholder="Customer name"
                    className="w-full rounded-xl border border-zinc-300 px-3 py-3 text-sm"
                  />

                  <input
                    value={quoteCustomerPhone}
                    onChange={(e) => setQuoteCustomerPhone(e.target.value)}
                    placeholder="Customer phone"
                    className="w-full rounded-xl border border-zinc-300 px-3 py-3 text-sm"
                  />

                  <input
                    value={quoteCustomerEmail}
                    onChange={(e) => setQuoteCustomerEmail(e.target.value)}
                    placeholder="Customer email (optional)"
                    className="w-full rounded-xl border border-zinc-300 px-3 py-3 text-sm"
                  />

                  <input
                    value={quoteCustomerAddress}
                    onChange={(e) => setQuoteCustomerAddress(e.target.value)}
                    placeholder="Customer address"
                    className="w-full rounded-xl border border-zinc-300 px-3 py-3 text-sm"
                  />

                  <input
                    value={quoteCustomerPostcode}
                    onChange={(e) => setQuoteCustomerPostcode(e.target.value)}
                    placeholder="Customer postcode"
                    className="w-full rounded-xl border border-zinc-300 px-3 py-3 text-sm"
                  />

                  <textarea
                    value={quoteWorkSummary}
                    onChange={(e) => setQuoteWorkSummary(e.target.value)}
                    placeholder="What work is needed?"
                    className="min-h-[90px] w-full rounded-xl border border-zinc-300 px-3 py-3 text-sm"
                  />

                  <input
                    value={quoteEstimatedTime}
                    onChange={(e) => setQuoteEstimatedTime(e.target.value)}
                    placeholder="How long do you think it will take conservatively?"
                    className="w-full rounded-xl border border-zinc-300 px-3 py-3 text-sm"
                  />

                  <textarea
                    value={quoteNotes}
                    onChange={(e) => setQuoteNotes(e.target.value)}
                    placeholder="Extra notes for the office (optional)"
                    className="min-h-[80px] w-full rounded-xl border border-zinc-300 px-3 py-3 text-sm"
                  />
                </div>

                {quoteMessage && (
                  <div
                    className={`mt-3 text-sm ${
                      quoteMessage.includes('successfully')
                        ? 'text-green-700'
                        : 'text-red-700'
                    }`}
                  >
                    {quoteMessage}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleSendQuoteRequest}
                    disabled={quoteBusy}
                    className="rounded-xl bg-zinc-900 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {quoteBusy ? 'Saving...' : 'Save New Quote'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowQuoteForm(false)}
                    disabled={quoteBusy}
                    className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-800 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {(isStarted || isPaused) && (
              <div>
                <div className="mb-3 text-sm font-semibold text-zinc-800">
                  Add Extra Time
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => handleExtendJob(15)}
                    disabled={busyAction !== ''}
                    className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyAction === 'extend job' ? 'Updating...' : '+15'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExtendJob(30)}
                    disabled={busyAction !== ''}
                    className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyAction === 'extend job' ? 'Updating...' : '+30'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExtendJob(45)}
                    disabled={busyAction !== ''}
                    className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyAction === 'extend job' ? 'Updating...' : '+45'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExtendJob(60)}
                    disabled={busyAction !== ''}
                    className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyAction === 'extend job' ? 'Updating...' : '+60'}
                  </button>

                  <button
                    type="button"
                    onClick={handleOtherExtendJob}
                    disabled={busyAction !== ''}
                    className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyAction === 'extend job' ? 'Updating...' : 'Other'}
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-zinc-900">Photos</h2>

            <div className="mb-5 rounded-2xl border border-zinc-200 p-4">
              <div className="mb-3">
                <label className="mb-2 block text-sm font-medium text-zinc-800">
                  Photo Label
                </label>
                <select
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full max-w-[240px] rounded-xl border border-zinc-300 px-3 py-3 text-sm"
                >
                  <option value="Before">Before</option>
                  <option value="During">During</option>
                  <option value="After">After</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileChange}
                disabled={uploading}
                className="block w-full text-sm"
              />

              {photoMessage && (
                <p className="mt-3 text-sm text-zinc-600">{photoMessage}</p>
              )}
            </div>

            {photos.length === 0 && (
              <p className="text-sm text-zinc-500">No photos uploaded yet.</p>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {photos.map((photo, index) => (
                <div
                  key={photo.id}
                  className="rounded-2xl border border-zinc-200 p-3"
                >
                  <button
                    type="button"
                    onClick={() => openViewer(index)}
                    className="block w-full text-left"
                  >
                    <img
                      src={photo.imageUrl}
                      alt={photo.label || 'Job photo'}
                      className="mb-3 h-[180px] w-full rounded-xl object-cover"
                    />

                    <p className="mb-1 text-sm text-zinc-700">
                      <strong>Label:</strong> {photo.label || 'None'}
                    </p>

                    <p className="mb-3 text-sm text-zinc-500">Tap to open full size</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeletePhoto(photo.id)}
                    disabled={deletingPhotoId === photo.id}
                    className="w-full rounded-xl border border-red-300 bg-white px-3 py-2.5 text-sm font-medium text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deletingPhotoId === photo.id ? 'Deleting...' : 'Delete Photo'}
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-zinc-900">Quick actions</h2>

            <div className="flex flex-col gap-3">
              {job.customer?.phone && (
                <a
                  href={`tel:${job.customer.phone}`}
                  className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-800"
                >
                  Call Customer
                </a>
              )}

              {navigationQuery && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(navigationQuery)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-800"
                >
                  Navigate
                </a>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-zinc-900">Assigned workers</h2>

            <div className="space-y-2">
              {job.assignments.length === 0 && (
                <p className="text-sm text-zinc-500">No workers assigned</p>
              )}

              {job.assignments.map((a) => (
                <div
                  key={a.id}
                  className="rounded-xl bg-zinc-50 px-3 py-2 text-sm text-zinc-700"
                >
                  {a.worker.firstName} {a.worker.lastName}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {activePhoto && (
        <div
          onClick={closeViewer}
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 p-5"
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              closeViewer()
            }}
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-black/40 text-2xl text-white"
          >
            ×
          </button>

          {viewerIndex !== null && viewerIndex > 0 && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                showPreviousPhoto()
              }}
              className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/40 text-2xl text-white"
            >
              ‹
            </button>
          )}

          <div
            onClick={(event) => event.stopPropagation()}
            className="flex w-full max-w-[1100px] flex-col items-center gap-3"
          >
            <img
              src={activePhoto.imageUrl}
              alt={activePhoto.label || 'Job photo'}
              className="max-h-[80vh] max-w-full rounded-xl object-contain"
            />

            <div className="text-center text-white">
              <p className="mb-1">
                <strong>{activePhoto.label || 'Job photo'}</strong>
              </p>
              <p className="opacity-80">
                Photo {viewerIndex !== null ? viewerIndex + 1 : 1} of {photos.length}
              </p>
            </div>
          </div>

          {viewerIndex !== null && viewerIndex < photos.length - 1 && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                showNextPhoto()
              }}
              className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/40 text-2xl text-white"
            >
              ›
            </button>
          )}
        </div>
      )}
    </main>
  )
}