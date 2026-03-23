'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

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
  paymentStatus?: string | null
  paymentNotes?: string | null
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
    return 'bg-green-100 text-green-800 ring-green-200'
  }

  if (value === 'inprogress' || value === 'in_progress') {
    return 'bg-blue-100 text-blue-800 ring-blue-200'
  }

  if (value === 'scheduled' || value === 'todo') {
    return 'bg-amber-100 text-amber-800 ring-amber-200'
  }

  if (value === 'paused') {
    return 'bg-orange-100 text-orange-800 ring-orange-200'
  }

  return 'bg-zinc-100 text-zinc-700 ring-zinc-200'
}

function typeBadgeClass(jobType: string) {
  const value = String(jobType || '').toLowerCase()

  if (value.includes('maint')) {
    return 'bg-emerald-100 text-emerald-800 ring-emerald-200'
  }

  if (value.includes('land')) {
    return 'bg-sky-100 text-sky-800 ring-sky-200'
  }

  if (value.includes('quote')) {
    return 'bg-amber-100 text-amber-800 ring-amber-200'
  }

  if (value.includes('prep')) {
    return 'bg-indigo-100 text-indigo-800 ring-indigo-200'
  }

  return 'bg-zinc-100 text-zinc-700 ring-zinc-200'
}

function formatPaymentStatus(value?: string | null) {
  const normalised = String(value || '').toLowerCase()

  if (normalised === 'cash_paid') return 'Cash paid'
  if (normalised === 'invoice_needed') return 'Needs invoice'
  return 'Not recorded'
}

function Pill({
  children,
  className,
}: {
  children: React.ReactNode
  className: string
}) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ring-1 ring-inset ${className}`}
    >
      {children}
    </span>
  )
}

function InfoRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </div>
      <div className="mt-2 text-sm font-medium text-zinc-900">{value}</div>
    </div>
  )
}

function isPrepJob(job: Job | null) {
  if (!job) return false

  const title = String(job.title || '').trim().toLowerCase()
  const jobType = String(job.jobType || '').trim().toLowerCase()

  return title === 'morning prep' || jobType === 'prep'
}

export default function JobPage() {
  const params = useParams()
  const searchParams = useSearchParams()
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

  const [showFinishReport, setShowFinishReport] = useState(false)
  const [hasAutoOpenedFinishReport, setHasAutoOpenedFinishReport] = useState(false)
  const [finishSummary, setFinishSummary] = useState('')
  const [finishFollowUpRequired, setFinishFollowUpRequired] = useState<'no' | 'yes'>('no')
  const [finishFollowUpDetails, setFinishFollowUpDetails] = useState('')
  const [finishPaymentStatus, setFinishPaymentStatus] = useState<'not_recorded' | 'cash_paid' | 'invoice_needed'>('not_recorded')
  const [finishPaymentNotes, setFinishPaymentNotes] = useState('')
  const [finishKellyNotes, setFinishKellyNotes] = useState('')

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

  useEffect(() => {
    if (!showFinishReport || !job) return

    setFinishSummary('')
    setFinishFollowUpRequired('no')
    setFinishFollowUpDetails('')
    setFinishPaymentStatus(
      job.paymentStatus === 'cash_paid' || job.paymentStatus === 'invoice_needed'
        ? job.paymentStatus
        : 'not_recorded'
    )
    setFinishPaymentNotes(job.paymentNotes || '')
    setFinishKellyNotes('')
  }, [showFinishReport, job])

  useEffect(() => {
    if (!job) return
    if (isPrepJob(job)) return
    if (hasAutoOpenedFinishReport) return

    if (searchParams.get('finish') === '1') {
      setShowFinishReport(true)
      setHasAutoOpenedFinishReport(true)
    }
  }, [job, hasAutoOpenedFinishReport, searchParams])

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
      return true
    } catch (err) {
      console.error(err)
      setError(`Failed to ${actionLabel}.`)
      return false
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
    if (isPrepJob(job)) {
      await patchJob({ action: 'finish' }, 'finish job')
      return
    }

    setShowFinishReport(true)
  }

  async function handlePrepComplete() {
    if (!job) return

    if (!job.arrivedAt) {
      const startOk = await patchJob({ action: 'start' }, 'start job')
      if (!startOk) return
    }

    await patchJob({ action: 'finish' }, 'finish job')
  }

  async function submitFinishReport() {
    const workerName = localStorage.getItem('workerName') || 'Unknown worker'
    const recordedAt = new Date().toLocaleString('en-GB')

    const reportLines = [
      'End of job report:',
      `Work summary: ${finishSummary.trim() || 'Not provided'}`,
      `Follow-up required: ${finishFollowUpRequired === 'yes' ? 'Yes' : 'No'}`,
      `Follow-up details: ${
        finishFollowUpRequired === 'yes'
          ? finishFollowUpDetails.trim() || 'Not provided'
          : 'None'
      }`,
      `Payment: ${
        finishPaymentStatus === 'cash_paid'
          ? 'Cash paid'
          : finishPaymentStatus === 'invoice_needed'
            ? 'Needs invoice'
            : 'Not recorded'
      }`,
      `Payment notes: ${finishPaymentNotes.trim() || 'None'}`,
      `Notes for Kelly: ${finishKellyNotes.trim() || 'None'}`,
      `Reported by: ${workerName}`,
      `Recorded at: ${recordedAt}`
    ]

    const success = await patchJob(
      {
        action: 'finish',
        paymentStatus:
          finishPaymentStatus === 'not_recorded' ? '' : finishPaymentStatus,
        paymentNotes: finishPaymentNotes.trim(),
        appendNote: reportLines.join(' | '),
        noteAuthor: workerName
      },
      'finish job'
    )

    if (success) {
      setShowFinishReport(false)
    }
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

  const prepJob = isPrepJob(job)

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-50">
        <div className="mx-auto max-w-6xl px-4 py-5 md:px-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-zinc-600">Loading job...</p>
          </div>
        </div>
      </main>
    )
  }

  if (error && !job) {
    return (
      <main className="min-h-screen bg-zinc-50">
        <div className="mx-auto max-w-6xl px-4 py-5 md:px-6">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </main>
    )
  }

  if (!job) {
    return (
      <main className="min-h-screen bg-zinc-50">
        <div className="mx-auto max-w-6xl px-4 py-5 md:px-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-zinc-600">Job not found.</p>
          </div>
        </div>
      </main>
    )
  }

  const navigationQuery =
    job.customer?.postcode || job.address || job.customer?.address || ''

  const activePhoto =
    viewerIndex !== null && photos[viewerIndex] ? photos[viewerIndex] : null

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-6xl px-4 py-5 md:px-6">
        <div className="space-y-5">
          <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
            <div className="bg-zinc-900 px-5 py-5 text-white md:px-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Pill className={typeBadgeClass(job.jobType || '')}>
                      {job.jobType || 'General'}
                    </Pill>
                    <Pill className={statusBadgeClass(job.status || '')}>
                      {job.status || 'Unknown'}
                    </Pill>
                  </div>

                  <div className="text-xs font-black uppercase tracking-[0.22em] text-yellow-400">
                    Job Details
                  </div>

                  <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">
                    {prepJob ? 'Morning Prep' : job.title}
                  </h1>

                  <p className="mt-2 text-sm text-zinc-300 md:text-base">
                    {prepJob
                      ? 'Prep block before the working day starts'
                      : job.customer?.name || 'Unknown customer'}
                  </p>

                  <p className="mt-1 text-sm text-zinc-400">
                    Job #{job.id}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/today"
                    className="inline-flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700"
                  >
                    Back to Today
                  </Link>
                </div>
              </div>
            </div>

            <div className="grid gap-3 border-t border-zinc-200 bg-zinc-50 p-4 md:grid-cols-2 xl:grid-cols-4 md:p-5">
              <InfoRow
                label="Visit date"
                value={job.visitDate ? formatDateTime(job.visitDate) : '—'}
              />
              <InfoRow label="Start time" value={job.startTime || '—'} />
              <InfoRow label="Duration" value={formatMinutes(job.durationMinutes)} />
              <InfoRow
                label="Assigned workers"
                value={
                  job.assignments.length > 0
                    ? job.assignments
                        .map(
                          (assignment) =>
                            `${assignment.worker.firstName} ${assignment.worker.lastName}`
                        )
                        .join(', ')
                    : 'Nobody assigned'
                }
              />
            </div>
          </section>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
              {error}
            </div>
          )}

          {cannotCompleteInfo && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 shadow-sm">
              <h2 className="mb-3 text-lg font-bold text-amber-900">
                Job could not be completed
              </h2>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="text-sm text-amber-900">
                  <strong>Reason:</strong> {cannotCompleteInfo.reason || 'Not provided'}
                </div>

                {cannotCompleteInfo.reportedBy && (
                  <div className="text-sm text-amber-900">
                    <strong>Reported by:</strong> {cannotCompleteInfo.reportedBy}
                  </div>
                )}

                {cannotCompleteInfo.details && (
                  <div className="text-sm text-amber-900 md:col-span-2">
                    <strong>Details:</strong> {cannotCompleteInfo.details}
                  </div>
                )}

                {cannotCompleteInfo.recordedAt && (
                  <div className="text-sm text-amber-900 md:col-span-2">
                    <strong>Recorded at:</strong> {cannotCompleteInfo.recordedAt}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid gap-5 xl:grid-cols-3">
            <div className="space-y-5 xl:col-span-2">
              <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-zinc-900">Quick actions</h2>

                <div className="mb-5 flex flex-wrap gap-3">
                  {!isStarted && !isPaused && !isDone && !prepJob && (
                    <button
                      type="button"
                      onClick={handleStartJob}
                      disabled={busyAction !== ''}
                      className="rounded-xl bg-zinc-900 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busyAction === 'start job' ? 'Updating...' : 'Start Job'}
                    </button>
                  )}

                  {prepJob && !isDone && (
                    <button
                      type="button"
                      onClick={handlePrepComplete}
                      disabled={busyAction !== ''}
                      className="rounded-xl bg-zinc-900 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busyAction === 'finish job' || busyAction === 'start job'
                        ? 'Updating...'
                        : 'Prep Complete'}
                    </button>
                  )}

                  {isStarted && !prepJob && (
                    <>
                      <button
                        type="button"
                        onClick={handlePauseJob}
                        disabled={busyAction !== ''}
                        className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busyAction === 'pause job' ? 'Updating...' : 'Pause Work'}
                      </button>

                      <button
                        type="button"
                        onClick={handleFinishJob}
                        disabled={busyAction !== ''}
                        className="rounded-xl bg-zinc-900 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busyAction === 'finish job' ? 'Updating...' : 'Finish Job'}
                      </button>
                    </>
                  )}

                  {isPaused && !prepJob && (
                    <>
                      <button
                        type="button"
                        onClick={handleResumeJob}
                        disabled={busyAction !== ''}
                        className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busyAction === 'resume job' ? 'Updating...' : 'Resume Work'}
                      </button>

                      <button
                        type="button"
                        onClick={handleFinishJob}
                        disabled={busyAction !== ''}
                        className="rounded-xl bg-zinc-900 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busyAction === 'finish job' ? 'Updating...' : 'Finish Job'}
                      </button>
                    </>
                  )}

                  {(isStarted || isPaused) && !prepJob && (
                    <>
                      <button
                        type="button"
                        onClick={handleUndoStart}
                        disabled={busyAction !== ''}
                        className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busyAction === 'undo start' ? 'Updating...' : 'Undo Start'}
                      </button>

                      <button
                        type="button"
                        onClick={handleCannotComplete}
                        disabled={busyAction !== ''}
                        className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busyAction === "mark job as couldn't complete"
                          ? 'Updating...'
                          : "Couldn't Complete"}
                      </button>
                    </>
                  )}

                  {!prepJob && (
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
                  )}

                  {!prepJob && (
                    <a
                      href={`/jobs/add?customerId=${job.customer?.id}&title=${encodeURIComponent(
                        job.title
                      )}&address=${encodeURIComponent(job.address || '')}&postcode=${encodeURIComponent(
                        job.customer?.postcode || ''
                      )}&jobType=${encodeURIComponent(job.jobType || '')}`}
                      className="inline-flex rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-800"
                    >
                      Book Extra Day
                    </a>
                  )}
                </div>

                {visibleNotes && (
                  <div className="mb-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                      Notes
                    </div>
                    <div className="mt-2 whitespace-pre-line text-sm text-zinc-900">
                      {visibleNotes}
                    </div>
                  </div>
                )}

                {showQuoteForm && !prepJob && (
                  <div className="mb-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <div className="mb-3 text-lg font-extrabold text-zinc-900">
                      New Quote
                    </div>

                    <div className="grid gap-3">
                      <input
                        value={quoteCustomerName}
                        onChange={(e) => setQuoteCustomerName(e.target.value)}
                        placeholder="Customer name"
                        className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                      />

                      <input
                        value={quoteCustomerPhone}
                        onChange={(e) => setQuoteCustomerPhone(e.target.value)}
                        placeholder="Customer phone"
                        className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                      />

                      <input
                        value={quoteCustomerEmail}
                        onChange={(e) => setQuoteCustomerEmail(e.target.value)}
                        placeholder="Customer email (optional)"
                        className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                      />

                      <input
                        value={quoteCustomerAddress}
                        onChange={(e) => setQuoteCustomerAddress(e.target.value)}
                        placeholder="Customer address"
                        className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                      />

                      <input
                        value={quoteCustomerPostcode}
                        onChange={(e) => setQuoteCustomerPostcode(e.target.value)}
                        placeholder="Customer postcode"
                        className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                      />

                      <textarea
                        value={quoteWorkSummary}
                        onChange={(e) => setQuoteWorkSummary(e.target.value)}
                        placeholder="What work is needed?"
                        className="min-h-[90px] w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                      />

                      <input
                        value={quoteEstimatedTime}
                        onChange={(e) => setQuoteEstimatedTime(e.target.value)}
                        placeholder="How long do you think it will take conservatively?"
                        className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                      />

                      <textarea
                        value={quoteNotes}
                        onChange={(e) => setQuoteNotes(e.target.value)}
                        placeholder="Extra notes for the office (optional)"
                        className="min-h-[80px] w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                      />
                    </div>

                    {quoteMessage && (
                      <div
                        className={`mt-3 text-sm font-medium ${
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
                        className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}

                {(isStarted || isPaused) && !prepJob && (
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <div className="mb-3 text-sm font-bold text-zinc-800">
                      Add Extra Time
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => handleExtendJob(15)}
                        disabled={busyAction !== ''}
                        className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busyAction === 'extend job' ? 'Updating...' : '+15'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleExtendJob(30)}
                        disabled={busyAction !== ''}
                        className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busyAction === 'extend job' ? 'Updating...' : '+30'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleExtendJob(45)}
                        disabled={busyAction !== ''}
                        className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busyAction === 'extend job' ? 'Updating...' : '+45'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleExtendJob(60)}
                        disabled={busyAction !== ''}
                        className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busyAction === 'extend job' ? 'Updating...' : '+60'}
                      </button>

                      <button
                        type="button"
                        onClick={handleOtherExtendJob}
                        disabled={busyAction !== ''}
                        className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busyAction === 'extend job' ? 'Updating...' : 'Other'}
                      </button>
                    </div>
                  </div>
                )}
              </section>

              <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-zinc-900">Job details</h2>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <InfoRow
                    label="Customer"
                    value={prepJob ? 'Prep block' : job.customer?.name || 'Unknown customer'}
                  />

                  <InfoRow label="Type" value={job.jobType || '—'} />

                  <div className="sm:col-span-2">
                    <InfoRow label="Address" value={job.address || '—'} />
                  </div>

                  <InfoRow
                    label="Visit date"
                    value={job.visitDate ? formatDateTime(job.visitDate) : '—'}
                  />

                  <InfoRow label="Start time" value={job.startTime || '—'} />

                  <InfoRow label="Duration" value={formatMinutes(job.durationMinutes)} />

                  <InfoRow label="Overrun" value={formatMinutes(job.overrunMins)} />

                  <InfoRow label="Paused total" value={formatMinutes(job.pausedMinutes)} />

                  <InfoRow label="Started at" value={formatTime(job.arrivedAt)} />

                  <InfoRow label="Paused at" value={formatTime(job.pausedAt)} />

                  <InfoRow label="Finished at" value={formatTime(job.finishedAt)} />

                  <InfoRow
                    label="Payment"
                    value={formatPaymentStatus(job.paymentStatus)}
                  />

                  <InfoRow
                    label="Payment notes"
                    value={job.paymentNotes || '—'}
                  />

                  <div className="sm:col-span-2">
                    <InfoRow
                      label="Assigned"
                      value={
                        job.assignments.length > 0
                          ? job.assignments
                              .map(
                                (assignment) =>
                                  `${assignment.worker.firstName} ${assignment.worker.lastName}`
                              )
                              .join(', ')
                          : 'Nobody assigned'
                      }
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-zinc-900">Photos</h2>

                <div className="mb-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="mb-3">
                    <label className="mb-2 block text-sm font-semibold text-zinc-800">
                      Photo Label
                    </label>
                    <select
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      className="w-full max-w-[240px] rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
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
                      className="overflow-hidden rounded-2xl border border-zinc-200 bg-white"
                    >
                      <button
                        type="button"
                        onClick={() => openViewer(index)}
                        className="block w-full text-left"
                      >
                        <img
                          src={photo.imageUrl}
                          alt={photo.label || 'Job photo'}
                          className="h-[220px] w-full object-cover"
                        />

                        <div className="p-3">
                          <p className="mb-1 text-sm text-zinc-700">
                            <strong>Label:</strong> {photo.label || 'None'}
                          </p>

                          <p className="text-sm text-zinc-500">Tap to open full size</p>
                        </div>
                      </button>

                      <div className="p-3 pt-0">
                        <button
                          type="button"
                          onClick={() => handleDeletePhoto(photo.id)}
                          disabled={deletingPhotoId === photo.id}
                          className="w-full rounded-xl border border-red-300 bg-white px-3 py-2.5 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {deletingPhotoId === photo.id ? 'Deleting...' : 'Delete Photo'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="space-y-5">
              <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-zinc-900">Quick links</h2>

                <div className="flex flex-col gap-3">
                  {!prepJob && job.customer?.phone && (
                    <a
                      href={`tel:${job.customer.phone}`}
                      className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100"
                    >
                      Call Customer
                    </a>
                  )}

                  {navigationQuery && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(navigationQuery)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100"
                    >
                      Navigate
                    </a>
                  )}
                </div>
              </section>

              <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-zinc-900">Assigned workers</h2>

                <div className="space-y-3">
                  {job.assignments.length === 0 && (
                    <p className="text-sm text-zinc-500">No workers assigned</p>
                  )}

                  {job.assignments.map((a) => (
                    <div
                      key={a.id}
                      className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700"
                    >
                      <div className="font-semibold text-zinc-900">
                        {a.worker.firstName} {a.worker.lastName}
                      </div>
                      {a.worker.phone ? (
                        <div className="mt-1 text-zinc-500">{a.worker.phone}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>

              {!prepJob && (
                <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
                  <h2 className="mb-4 text-lg font-bold text-zinc-900">Customer</h2>

                  <div className="space-y-3">
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                        Name
                      </div>
                      <div className="mt-2 text-sm font-medium text-zinc-900">
                        {job.customer?.name || 'Unknown customer'}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                        Phone
                      </div>
                      <div className="mt-2 text-sm font-medium text-zinc-900">
                        {job.customer?.phone || '—'}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                        Address
                      </div>
                      <div className="mt-2 text-sm font-medium text-zinc-900">
                        {job.customer?.address || '—'}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                        Postcode
                      </div>
                      <div className="mt-2 text-sm font-medium text-zinc-900">
                        {job.customer?.postcode || '—'}
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      </div>

      {showFinishReport && (
        <div className="fixed inset-0 z-[1001] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl">
            <div className="border-b border-zinc-200 px-5 py-4">
              <h2 className="text-xl font-bold text-zinc-900">Finish job report</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Quick end-of-job report for Kelly before you finish this job.
              </p>
            </div>

            <div className="space-y-4 p-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-800">
                  Work summary
                </label>
                <textarea
                  value={finishSummary}
                  onChange={(e) => setFinishSummary(e.target.value)}
                  placeholder="What was done today?"
                  className="min-h-[100px] w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-800">
                  Follow-up required?
                </label>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setFinishFollowUpRequired('no')}
                    className={`rounded-xl px-4 py-3 text-sm font-semibold ${
                      finishFollowUpRequired === 'no'
                        ? 'bg-zinc-900 text-white'
                        : 'border border-zinc-300 bg-white text-zinc-800'
                    }`}
                  >
                    No
                  </button>

                  <button
                    type="button"
                    onClick={() => setFinishFollowUpRequired('yes')}
                    className={`rounded-xl px-4 py-3 text-sm font-semibold ${
                      finishFollowUpRequired === 'yes'
                        ? 'bg-zinc-900 text-white'
                        : 'border border-zinc-300 bg-white text-zinc-800'
                    }`}
                  >
                    Yes
                  </button>
                </div>
              </div>

              {finishFollowUpRequired === 'yes' && (
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-800">
                    Follow-up details
                  </label>
                  <textarea
                    value={finishFollowUpDetails}
                    onChange={(e) => setFinishFollowUpDetails(e.target.value)}
                    placeholder="What still needs doing, returning for, or chasing?"
                    className="min-h-[90px] w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                  />
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-800">
                  Payment
                </label>
                <div className="grid gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => setFinishPaymentStatus('not_recorded')}
                    className={`rounded-xl px-4 py-3 text-sm font-semibold ${
                      finishPaymentStatus === 'not_recorded'
                        ? 'bg-zinc-900 text-white'
                        : 'border border-zinc-300 bg-white text-zinc-800'
                    }`}
                  >
                    Not recorded
                  </button>

                  <button
                    type="button"
                    onClick={() => setFinishPaymentStatus('cash_paid')}
                    className={`rounded-xl px-4 py-3 text-sm font-semibold ${
                      finishPaymentStatus === 'cash_paid'
                        ? 'bg-zinc-900 text-white'
                        : 'border border-zinc-300 bg-white text-zinc-800'
                    }`}
                  >
                    Cash paid
                  </button>

                  <button
                    type="button"
                    onClick={() => setFinishPaymentStatus('invoice_needed')}
                    className={`rounded-xl px-4 py-3 text-sm font-semibold ${
                      finishPaymentStatus === 'invoice_needed'
                        ? 'bg-zinc-900 text-white'
                        : 'border border-zinc-300 bg-white text-zinc-800'
                    }`}
                  >
                    Needs invoice
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-800">
                  Payment notes
                </label>
                <input
                  value={finishPaymentNotes}
                  onChange={(e) => setFinishPaymentNotes(e.target.value)}
                  placeholder="Amount paid, part paid, cash details, anything useful"
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-800">
                  Extra notes for Kelly
                </label>
                <textarea
                  value={finishKellyNotes}
                  onChange={(e) => setFinishKellyNotes(e.target.value)}
                  placeholder="Anything Kelly should know?"
                  className="min-h-[90px] w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                />
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-3 border-t border-zinc-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setShowFinishReport(false)}
                disabled={busyAction !== ''}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={submitFinishReport}
                disabled={busyAction !== ''}
                className="rounded-xl bg-zinc-900 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyAction === 'finish job' ? 'Saving...' : 'Save report & finish job'}
              </button>
            </div>
          </div>
        </div>
      )}

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