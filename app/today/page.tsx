'use client'

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from 'react'
import WorkerMenu from '@/app/components/WorkerMenu'

type Worker = {
  id: number
  firstName: string
  lastName: string
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
  email?: string | null
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

type TimedJob = Job & {
  isDone: boolean
  isStarted: boolean
  isPaused: boolean
  isNext: boolean
  isWaiting: boolean
  etaStart: Date | null
  etaFinish: Date | null
  plannedMinutes: number
}

type ChasUiMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  createdAt: string
  imageDataUrl?: string
  jobId?: number | null
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

function formatClockTime(value?: Date | null) {
  if (!value) return '—'

  if (Number.isNaN(value.getTime())) {
    return '—'
  }

  return value.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatLiveNow(value: Date) {
  return value.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function formatLiveDate(value: Date) {
  return value.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  })
}

function formatDurationMinutes(start?: string | null, end?: string | null) {
  if (!start || !end) return '—'

  const startDate = new Date(start)
  const endDate = new Date(end)

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return '—'
  }

  const diffMs = endDate.getTime() - startDate.getTime()

  if (diffMs <= 0) return '—'

  const totalMinutes = Math.round(diffMs / 60000)
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

function formatMinutes(totalMinutes: number) {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return '0m'

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

function jobSortValue(job: Job) {
  const datePart = job.visitDate ? new Date(job.visitDate).getTime() : 0

  if (!job.startTime) return datePart

  const [hours, minutes] = job.startTime.split(':').map(Number)

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return datePart
  }

  return datePart + hours * 60 * 60 * 1000 + minutes * 60 * 1000
}

function combineVisitDateAndTime(
  visitDate?: string | null,
  startTime?: string | null
) {
  if (!visitDate) return null

  const base = new Date(visitDate)

  if (Number.isNaN(base.getTime())) {
    return null
  }

  if (!startTime) {
    return base
  }

  const [hours, minutes] = startTime.split(':').map(Number)

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return base
  }

  const combined = new Date(base)
  combined.setHours(hours, minutes, 0, 0)

  return combined
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60000)
}

function getLaterDate(a: Date | null, b: Date | null) {
  if (!a) return b
  if (!b) return a
  return a.getTime() >= b.getTime() ? a : b
}

function getPlannedMinutes(job: Job) {
  const base =
    typeof job.durationMinutes === 'number' && job.durationMinutes > 0
      ? job.durationMinutes
      : 60

  const overrun =
    typeof job.overrunMins === 'number' && job.overrunMins > 0
      ? job.overrunMins
      : 0

  const paused =
    typeof job.pausedMinutes === 'number' && job.pausedMinutes > 0
      ? job.pausedMinutes
      : 0

  return base + overrun + paused
}

function getPrepFinishForJob(job: Job) {
  const baseDate = job.visitDate ? new Date(job.visitDate) : new Date()

  if (Number.isNaN(baseDate.getTime())) {
    return null
  }

  const prepFinish = new Date(baseDate)
  prepFinish.setHours(9, 0, 0, 0)

  return prepFinish
}

function getEarliestWorkingStart(job: Job, scheduledStart: Date | null) {
  const prepFinish = getPrepFinishForJob(job)
  return getLaterDate(prepFinish, scheduledStart)
}

function getPausedLiveMinutes(job: Job, currentNow: Date) {
  if (!job.pausedAt) return 0

  const pausedAtDate = new Date(job.pausedAt)

  if (Number.isNaN(pausedAtDate.getTime())) return 0

  const diffMs = currentNow.getTime() - pausedAtDate.getTime()

  if (diffMs <= 0) return 0

  return Math.round(diffMs / 60000)
}

function getLiveWorkedMinutes(job: Job, currentNow: Date) {
  if (!job.arrivedAt) return 0

  const arrivedAtDate = new Date(job.arrivedAt)

  if (Number.isNaN(arrivedAtDate.getTime())) return 0

  const endTime = job.finishedAt ? new Date(job.finishedAt) : currentNow

  if (Number.isNaN(endTime.getTime())) return 0

  const diffMs = endTime.getTime() - arrivedAtDate.getTime()

  if (diffMs <= 0) return 0

  const totalMinutes = Math.round(diffMs / 60000)
  const pausedMinutes = job.pausedMinutes ?? 0
  const livePausedMinutes = job.pausedAt ? getPausedLiveMinutes(job, currentNow) : 0

  return Math.max(0, totalMinutes - pausedMinutes - livePausedMinutes)
}

function formatChasTimestamp(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return ''

  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

function createChasSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `chas-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to load image'))
    }

    image.src = objectUrl
  })
}

async function compressImageFile(
  file: File,
  options?: {
    maxWidth?: number
    quality?: number
  }
): Promise<string> {
  const maxWidth = options?.maxWidth ?? 1200
  const quality = options?.quality ?? 0.7

  if (!file.type.startsWith('image/')) {
    return await fileToDataUrl(file)
  }

  const image = await loadImageFromFile(file)

  const originalWidth = image.naturalWidth || image.width
  const originalHeight = image.naturalHeight || image.height

  if (!originalWidth || !originalHeight) {
    return await fileToDataUrl(file)
  }

  const scale = Math.min(1, maxWidth / originalWidth)
  const targetWidth = Math.max(1, Math.round(originalWidth * scale))
  const targetHeight = Math.max(1, Math.round(originalHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight

  const context = canvas.getContext('2d')

  if (!context) {
    return await fileToDataUrl(file)
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight)

  const compressedDataUrl = canvas.toDataURL('image/jpeg', quality)

  return compressedDataUrl || (await fileToDataUrl(file))
}

function getInitials(name: string) {
  const cleaned = name.trim()
  if (!cleaned) return '?'

  const parts = cleaned.split(/\s+/).filter(Boolean)
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }

  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase()
}

function ChasMascot({ size = 26 }: { size?: number }) {
  const hatHeight = Math.round(size * 0.3)
  const faceSize = Math.round(size * 0.72)
  const eyeSize = Math.max(2, Math.round(size * 0.08))
  const mouthWidth = Math.max(8, Math.round(size * 0.22))

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        flexShrink: 0
      }}
      aria-hidden="true"
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: Math.round(size * 0.12),
          width: Math.round(size * 0.76),
          height: hatHeight,
          borderRadius: `${hatHeight}px ${hatHeight}px 6px 6px`,
          background: '#facc15',
          border: '2px solid #111'
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: Math.round(size * 0.2),
          left: Math.round(size * 0.06),
          width: Math.round(size * 0.88),
          height: Math.max(4, Math.round(size * 0.1)),
          borderRadius: 999,
          background: '#facc15',
          border: '2px solid #111'
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: Math.round(size * 0.28),
          left: Math.round((size - faceSize) / 2),
          width: faceSize,
          height: faceSize,
          borderRadius: '50%',
          background: '#fff4d6',
          border: '2px solid #111',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: Math.round(faceSize * 0.34),
            left: Math.round(faceSize * 0.23),
            width: eyeSize,
            height: eyeSize,
            borderRadius: '50%',
            background: '#111'
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: Math.round(faceSize * 0.34),
            right: Math.round(faceSize * 0.23),
            width: eyeSize,
            height: eyeSize,
            borderRadius: '50%',
            background: '#111'
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: Math.round(faceSize * 0.18),
            width: mouthWidth,
            height: Math.max(4, Math.round(faceSize * 0.12)),
            transform: 'translateX(-50%)',
            borderBottom: '2px solid #111',
            borderRadius: '0 0 999px 999px'
          }}
        />
      </div>
    </div>
  )
}

const colours = {
  ink: '#111111',
  inkSoft: '#2b2b2b',
  line: '#d9d9d9',
  panel: '#ffffff',
  page: '#f4f5f7',
  muted: '#6b7280',
  yellowSoft: '#fff7d6',
  greenSoft: '#e8f8ea',
  greenLine: '#7bc586',
  redSoft: '#ffe5e5',
  redLine: '#efb0b0',
  greySoft: '#f8f8f8'
}

const styles = {
  page: {
    minHeight: '100vh',
    background: `linear-gradient(180deg, ${colours.page} 0%, #eef1f4 100%)`,
    fontFamily: 'sans-serif',
    color: colours.ink
  } satisfies CSSProperties,
  shell: {
    width: '100%',
    maxWidth: 920,
    margin: '0 auto',
    padding: '16px 14px 36px'
  } satisfies CSSProperties,
  topCard: {
    borderRadius: 22,
    background: `linear-gradient(135deg, ${colours.ink} 0%, #2a2a2a 100%)`,
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 20px 50px rgba(0,0,0,0.16)',
    padding: 16,
    marginBottom: 16
  } satisfies CSSProperties,
  panel: {
    background: colours.panel,
    border: `1px solid ${colours.line}`,
    borderRadius: 18,
    boxShadow: '0 10px 30px rgba(0,0,0,0.06)'
  } satisfies CSSProperties,
  panelPadding: {
    padding: 16
  } satisfies CSSProperties,
  sectionTitle: {
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    color: colours.muted,
    marginBottom: 10
  } satisfies CSSProperties,
  actionButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    padding: '12px 16px',
    borderRadius: 12,
    border: `1px solid ${colours.line}`,
    background: '#fff',
    color: colours.ink,
    textDecoration: 'none',
    fontWeight: 700,
    fontSize: 15,
    cursor: 'pointer'
  } satisfies CSSProperties,
  actionButtonDark: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    padding: '14px 18px',
    borderRadius: 14,
    border: `1px solid ${colours.ink}`,
    background: colours.ink,
    color: '#fff',
    textDecoration: 'none',
    fontWeight: 800,
    fontSize: 16,
    cursor: 'pointer'
  } satisfies CSSProperties,
  smallBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800
  } satisfies CSSProperties,
  metaCard: {
    borderRadius: 16,
    padding: 14,
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.1)'
  } satisfies CSSProperties,
  jobCard: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    boxShadow: '0 10px 24px rgba(0,0,0,0.05)'
  } satisfies CSSProperties,
  label: {
    fontSize: 12,
    fontWeight: 800,
    color: colours.muted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5
  } satisfies CSSProperties,
  value: {
    fontSize: 15,
    lineHeight: 1.45
  } satisfies CSSProperties,
  gridTwo: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: 10
  } satisfies CSSProperties
}

function getJobCardStyle(job: TimedJob): CSSProperties {
  if (job.isDone) {
    return {
      background: colours.greenSoft,
      border: `1px solid ${colours.greenLine}`
    }
  }

  if (job.isStarted || job.isPaused || job.isNext) {
    return {
      background: colours.yellowSoft,
      border: '1px solid #efcf72'
    }
  }

  return {
    background: '#fff',
    border: `1px solid ${colours.line}`
  }
}

function getStatusPill(job: TimedJob): CSSProperties {
  if (job.isDone) {
    return {
      ...styles.smallBadge,
      background: '#d8f3dc',
      border: '1px solid #8fd19e',
      color: '#1d5d2c'
    }
  }

  if (job.isPaused) {
    return {
      ...styles.smallBadge,
      background: '#fff3cd',
      border: '1px solid #efcf72',
      color: '#6c4c00'
    }
  }

  if (job.isStarted) {
    return {
      ...styles.smallBadge,
      background: '#111',
      border: '1px solid #111',
      color: '#fff'
    }
  }

  if (job.isNext) {
    return {
      ...styles.smallBadge,
      background: '#fff3cd',
      border: '1px solid #efcf72',
      color: '#6c4c00'
    }
  }

  return {
    ...styles.smallBadge,
    background: colours.greySoft,
    border: `1px solid ${colours.line}`,
    color: colours.inkSoft
  }
}

function getStatusText(job: TimedJob) {
  if (job.isDone) return 'Completed'
  if (job.isPaused) return 'Paused'
  if (job.isStarted) return 'In progress'
  if (job.isNext) return 'Travelling'
  return 'Waiting to start'
}

function TopStatCard({
  label,
  value,
  subtext,
  active,
  onClick,
  clickable = true
}: {
  label: string
  value: string | number
  subtext: string
  active?: boolean
  onClick?: () => void
  clickable?: boolean
}) {
  const sharedStyle: CSSProperties = {
    ...styles.metaCard,
    cursor: clickable ? 'pointer' : 'default',
    border: active
      ? '1px solid rgba(255,255,255,0.4)'
      : '1px solid rgba(255,255,255,0.1)',
    background: active
      ? 'rgba(255,255,255,0.18)'
      : 'rgba(255,255,255,0.08)',
    boxShadow: active ? '0 10px 24px rgba(0,0,0,0.14)' : 'none'
  }

  if (!clickable) {
    return (
      <div style={sharedStyle}>
        <div style={{ fontSize: 12, opacity: 0.72, marginBottom: 6 }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.05 }}>{value}</div>
        <div style={{ marginTop: 6, fontSize: 14, opacity: 0.85 }}>{subtext}</div>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...sharedStyle,
        width: '100%',
        textAlign: 'left'
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.72, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.05 }}>{value}</div>
      <div style={{ marginTop: 6, fontSize: 14, opacity: 0.85 }}>{subtext}</div>
    </button>
  )
}

export default function TodayPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [workerId, setWorkerId] = useState<number | null>(null)
  const [workerName, setWorkerName] = useState<string>('')
  const [workerPhotoUrl, setWorkerPhotoUrl] = useState<string>('')
  const [logoHidden, setLogoHidden] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyJobId, setBusyJobId] = useState<number | null>(null)
  const [now, setNow] = useState(new Date())
  const [topFilter, setTopFilter] = useState<'all' | 'completed' | 'left'>('all')

  const [chasOpen, setChasOpen] = useState(false)
  const [chasSessionId, setChasSessionId] = useState<string>('')
  const [chasQuestion, setChasQuestion] = useState('')
  const [chasBusy, setChasBusy] = useState(false)
  const [chasError, setChasError] = useState('')
  const [chasMessages, setChasMessages] = useState<ChasUiMessage[]>([])
  const [chasImageDataUrl, setChasImageDataUrl] = useState('')
  const [chasImageName, setChasImageName] = useState('')
  const [showQuoteForm, setShowQuoteForm] = useState(false)
  const [quoteBusy, setQuoteBusy] = useState(false)
  const [quoteMessage, setQuoteMessage] = useState('')
  const [quoteCustomerMode, setQuoteCustomerMode] = useState<'existing' | 'new'>('new')
  const [quoteCustomerSearch, setQuoteCustomerSearch] = useState('')
  const [quoteSelectedCustomerId, setQuoteSelectedCustomerId] = useState('')
  const [quoteCustomerName, setQuoteCustomerName] = useState('')
  const [quoteCustomerPhone, setQuoteCustomerPhone] = useState('')
  const [quoteCustomerEmail, setQuoteCustomerEmail] = useState('')
  const [quoteCustomerAddress, setQuoteCustomerAddress] = useState('')
  const [quoteCustomerPostcode, setQuoteCustomerPostcode] = useState('')
  const [quoteWorkSummary, setQuoteWorkSummary] = useState('')
  const [quoteEstimatedTime, setQuoteEstimatedTime] = useState('')
  const [quoteNotes, setQuoteNotes] = useState('')
  const chasMessagesEndRef = useRef<HTMLDivElement | null>(null)

  async function loadJobs() {
    try {
      setError('')

      const res = await fetch('/api/jobs', { cache: 'no-store' })

      if (!res.ok) {
        throw new Error('Failed to load jobs')
      }

      const data = await res.json()
      setJobs(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error(err)
      setJobs([])
      setError('Failed to load jobs.')
    } finally {
      setLoading(false)
    }
  }

  async function loadCustomers() {
    try {
      const res = await fetch('/api/customers', { cache: 'no-store' })

      if (!res.ok) {
        throw new Error('Failed to load customers')
      }

      const data = await res.json()
      setCustomers(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error(err)
      setCustomers([])
    }
  }

  useEffect(() => {
    const savedWorkerId = localStorage.getItem('workerId')
    const savedWorkerName = localStorage.getItem('workerName')
    const savedWorkerPhotoUrl =
      localStorage.getItem('workerPhotoUrl') ||
      localStorage.getItem('photoUrl') ||
      ''

    if (savedWorkerId) {
      setWorkerId(Number(savedWorkerId))
    }

    if (savedWorkerName) {
      setWorkerName(savedWorkerName)
    }

    if (savedWorkerPhotoUrl) {
      setWorkerPhotoUrl(savedWorkerPhotoUrl)
    }

    loadJobs()
    loadCustomers()
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!chasOpen) return

    const timeout = window.setTimeout(() => {
      chasMessagesEndRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'end'
      })
    }, 50)

    return () => window.clearTimeout(timeout)
  }, [chasOpen, chasMessages, chasBusy])

 const workerJobs = useMemo(() => {
  if (!workerId) return []

  return jobs
    .filter((job) => {
      const status = String(job.status || '').toLowerCase()

      // ✅ hide archived + cancelled jobs
      if (status === 'archived' || status === 'cancelled') {
        return false
      }

      return job.assignments.some(
        (assignment) => assignment.workerId === workerId
      )
    })
    .sort((a, b) => jobSortValue(a) - jobSortValue(b))
}, [jobs, workerId])

  const visibleJobs = useMemo<TimedJob[]>(() => {
    const currentNow = new Date()
    let runningCursor: Date | null = null

    const timedJobsBase = workerJobs.map((job) => {
      const status = String(job.status || '').toLowerCase()
      const isDone = status === 'done' || status === 'completed' || !!job.finishedAt
      const isPaused = !!job.arrivedAt && !!job.pausedAt && !job.finishedAt && !isDone
      const isStarted = !!job.arrivedAt && !job.finishedAt && !isDone && !isPaused
      const plannedMinutes = getPlannedMinutes(job)
      const scheduledStart = combineVisitDateAndTime(job.visitDate, job.startTime)
      const earliestWorkingStart = getEarliestWorkingStart(job, scheduledStart)

      let etaStart: Date | null = null
      let etaFinish: Date | null = null

      if (isDone) {
        etaStart = job.arrivedAt ? new Date(job.arrivedAt) : scheduledStart
        etaFinish = job.finishedAt ? new Date(job.finishedAt) : null
        runningCursor = etaFinish || runningCursor
      } else if (isStarted) {
        etaStart = job.arrivedAt
          ? new Date(job.arrivedAt)
          : getLaterDate(runningCursor, earliestWorkingStart) || currentNow

        etaFinish = addMinutes(etaStart, plannedMinutes)

        if (etaFinish.getTime() < currentNow.getTime()) {
          etaFinish = currentNow
        }

        runningCursor = etaFinish
      } else if (isPaused) {
        etaStart = job.arrivedAt
          ? new Date(job.arrivedAt)
          : getLaterDate(runningCursor, earliestWorkingStart) || currentNow

        const pausedLiveMinutes = getPausedLiveMinutes(job, currentNow)
        const pausedAtDate = new Date(job.pausedAt as string)

        etaFinish = addMinutes(pausedAtDate, plannedMinutes + pausedLiveMinutes)

        runningCursor = etaFinish
      } else {
        etaStart = getLaterDate(runningCursor, earliestWorkingStart)
        etaFinish = etaStart ? addMinutes(etaStart, plannedMinutes) : null
        runningCursor = etaFinish || runningCursor
      }

      return {
        ...job,
        isDone,
        isStarted,
        isPaused,
        isNext: false,
        isWaiting: false,
        etaStart,
        etaFinish,
        plannedMinutes
      }
    })

    const unfinished = timedJobsBase.filter((job) => !job.isDone)
    const activeLiveJob = unfinished.find((job) => job.isStarted || job.isPaused)
    const nextWaitingJob =
      !activeLiveJob
        ? unfinished.find((job) => !job.isStarted && !job.isPaused) || null
        : null

    return timedJobsBase.map((job) => {
      const isNext =
        !job.isDone &&
        !job.isStarted &&
        !job.isPaused &&
        nextWaitingJob?.id === job.id

      const isWaiting = !job.isDone && !job.isStarted && !job.isPaused && !isNext

      return {
        ...job,
        isNext,
        isWaiting
      }
    })
  }, [workerJobs, now])

  const activeJob = useMemo(() => {
    return visibleJobs.find((job) => job.isStarted || job.isPaused) || null
  }, [visibleJobs])

  const listJobs = useMemo(() => {
    if (!activeJob) return visibleJobs
    return visibleJobs.filter((job) => job.id !== activeJob.id)
  }, [visibleJobs, activeJob])

  const nextJobs = useMemo(() => {
    return listJobs.filter((job) => !job.isDone)
  }, [listJobs])

  const completedJobs = useMemo(() => {
    return listJobs.filter((job) => job.isDone)
  }, [listJobs])

  const progressCounts = useMemo(() => {
    const todayTotal = visibleJobs.length
    const completed = visibleJobs.filter((job) => job.isDone).length
    const left = visibleJobs.filter((job) => !job.isDone).length

    return {
      todayTotal,
      completed,
      left
    }
  }, [visibleJobs])

  const showingCompletedOnly = topFilter === 'completed'
  const showingLeftOnly = topFilter === 'left'

  const filteredActiveJob =
    topFilter === 'completed' ? null : activeJob

  const filteredNextJobs =
    topFilter === 'completed' ? [] : nextJobs

  const filteredCompletedJobs =
    topFilter === 'left' ? [] : completedJobs

  const upcomingJobs = useMemo(() => {
    const nowTime = now.getTime()

    return workerJobs
      .filter((job) => {
        if (!job.visitDate) return false
        if (job.finishedAt) return false

        const dateTime = combineVisitDateAndTime(job.visitDate, job.startTime)
        if (!dateTime) return false

        return dateTime.getTime() > nowTime
      })
      .slice(0, 8)
  }, [workerJobs, now])

  const filteredQuoteCustomers = useMemo(() => {
    const q = quoteCustomerSearch.trim().toLowerCase()

    if (!q) return customers

    return customers.filter((customer) => {
      const haystack = [
        customer.name,
        customer.phone || '',
        customer.email || '',
        customer.address || '',
        customer.postcode || ''
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(q)
    })
  }, [customers, quoteCustomerSearch])

  const selectedQuoteCustomer = useMemo(() => {
    return (
      customers.find((customer) => String(customer.id) === quoteSelectedCustomerId) || null
    )
  }, [customers, quoteSelectedCustomerId])

  useEffect(() => {
    if (quoteCustomerMode !== 'existing') return

    if (!selectedQuoteCustomer) {
      setQuoteCustomerName('')
      setQuoteCustomerPhone('')
      setQuoteCustomerEmail('')
      setQuoteCustomerAddress('')
      setQuoteCustomerPostcode('')
      return
    }

    setQuoteCustomerName(selectedQuoteCustomer.name || '')
    setQuoteCustomerPhone(selectedQuoteCustomer.phone || '')
    setQuoteCustomerEmail(selectedQuoteCustomer.email || '')
    setQuoteCustomerAddress(selectedQuoteCustomer.address || '')
    setQuoteCustomerPostcode(selectedQuoteCustomer.postcode || '')
  }, [quoteCustomerMode, selectedQuoteCustomer])

  function resetQuoteForm() {
    setQuoteCustomerMode('new')
    setQuoteCustomerSearch('')
    setQuoteSelectedCustomerId('')
    setQuoteCustomerName('')
    setQuoteCustomerPhone('')
    setQuoteCustomerEmail('')
    setQuoteCustomerAddress('')
    setQuoteCustomerPostcode('')
    setQuoteWorkSummary('')
    setQuoteEstimatedTime('')
    setQuoteNotes('')
  }

  function resetChasState() {
    setChasMessages([])
    setChasQuestion('')
    setChasBusy(false)
    setChasError('')
    setChasImageDataUrl('')
    setChasImageName('')
    setShowQuoteForm(false)
    setQuoteBusy(false)
    setQuoteMessage('')
    resetQuoteForm()
    setChasSessionId(createChasSessionId())
  }

  function openChas() {
    resetChasState()
    setChasOpen(true)
  }

  function closeChas() {
    setChasOpen(false)
    resetChasState()
  }

  function buildChatTranscript() {
    return chasMessages
      .map((message) => `${message.role === 'user' ? 'Worker' : 'CHAS'}: ${message.text}`)
      .join(' | ')
  }

  async function handleSendQuoteRequest() {
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
          sessionId: chasSessionId,
          customerName: quoteCustomerName,
          customerPhone: quoteCustomerPhone,
          customerEmail: quoteCustomerEmail,
          customerAddress: quoteCustomerAddress,
          customerPostcode: quoteCustomerPostcode,
          workSummary: quoteWorkSummary,
          estimatedTimeText: quoteEstimatedTime,
          notes: quoteNotes,
          imageDataUrl: chasImageDataUrl || '',
          chatTranscript: buildChatTranscript()
        })
      })

      const data = await res.json().catch(() => null)

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Failed to save quote enquiry.')
      }

      setQuoteMessage('Quote enquiry saved successfully.')
      setShowQuoteForm(false)

      const assistantMessage: ChasUiMessage = {
        id: `assistant-quote-${Date.now()}`,
        role: 'assistant',
        text: 'Nice one — that new quote has been saved.',
        createdAt: new Date().toISOString()
      }

      setChasMessages((prev) => [...prev, assistantMessage])
      resetQuoteForm()
      clearChasImage()
    } catch (err: any) {
      console.error(err)
      setQuoteMessage(String(err?.message || 'Failed to save quote enquiry.'))
    } finally {
      setQuoteBusy(false)
    }
  }

  async function handleStartJob(jobId: number) {
    try {
      setBusyJobId(jobId)
      setError('')

      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'start'
        })
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to start job')
      }

      await loadJobs()
    } catch (err) {
      console.error(err)
      setError('Failed to start job.')
    } finally {
      setBusyJobId(null)
    }
  }

  async function handleFinishJob(jobId: number) {
    try {
      setBusyJobId(jobId)
      setError('')

      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'finish'
        })
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to finish job')
      }

      await loadJobs()
    } catch (err) {
      console.error(err)
      setError('Failed to finish job.')
    } finally {
      setBusyJobId(null)
    }
  }

  async function handlePauseJob(jobId: number) {
    try {
      setBusyJobId(jobId)
      setError('')

      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'pause'
        })
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to pause job')
      }

      await loadJobs()
    } catch (err) {
      console.error(err)
      setError('Failed to pause job.')
    } finally {
      setBusyJobId(null)
    }
  }

  async function handleResumeJob(jobId: number) {
    try {
      setBusyJobId(jobId)
      setError('')

      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'resume'
        })
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to resume job')
      }

      await loadJobs()
    } catch (err) {
      console.error(err)
      setError('Failed to resume job.')
    } finally {
      setBusyJobId(null)
    }
  }

  async function handleCannotComplete(jobId: number) {
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

    try {
      setBusyJobId(jobId)
      setError('')

      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'cannot_complete',
          reason,
          details,
          workerName
        })
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to update job')
      }

      await loadJobs()
    } catch (err) {
      console.error(err)
      setError("Failed to mark job as couldn't complete.")
    } finally {
      setBusyJobId(null)
    }
  }

  async function handleUndoStart(jobId: number) {
    try {
      setBusyJobId(jobId)
      setError('')

      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          arrivedAt: null,
          pausedAt: null,
          pausedMinutes: 0,
          status: 'todo'
        })
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to undo start')
      }

      await loadJobs()
    } catch (err) {
      console.error(err)
      setError('Failed to undo start.')
    } finally {
      setBusyJobId(null)
    }
  }

  async function handleUndoDone(jobId: number) {
    try {
      setBusyJobId(jobId)
      setError('')

      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          toggleStatus: true
        })
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to undo job')
      }

      await loadJobs()
    } catch (err) {
      console.error(err)
      setError('Failed to undo job.')
    } finally {
      setBusyJobId(null)
    }
  }

  async function handleExtendJob(jobId: number, minutes: number) {
    try {
      setBusyJobId(jobId)
      setError('')

      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          extendMins: minutes
        })
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to extend job')
      }

      await loadJobs()
    } catch (err) {
      console.error(err)
      setError('Failed to extend job.')
    } finally {
      setBusyJobId(null)
    }
  }

  async function handleOtherExtendJob(jobId: number) {
    const value = window.prompt('How many extra minutes?', '90')

    if (value === null) return

    const minutes = Number(value)

    if (!Number.isFinite(minutes) || minutes <= 0) {
      window.alert('Please enter a valid number of minutes.')
      return
    }

    await handleExtendJob(jobId, Math.round(minutes))
  }

  async function handleChasImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) return

    try {
      const dataUrl = await compressImageFile(file, {
        maxWidth: 1200,
        quality: 0.7
      })
      setChasImageDataUrl(dataUrl)
      setChasImageName(file.name)
      setChasError('')
      setQuoteMessage('')
    } catch (err) {
      console.error(err)
      setChasError('Failed to load image.')
    } finally {
      event.target.value = ''
    }
  }

  function clearChasImage() {
    setChasImageDataUrl('')
    setChasImageName('')
  }

  async function handleSendChasMessage() {
    const question = chasQuestion.trim()

    if (!question) {
      setChasError('Please type a message for Chas.')
      return
    }

    const company = localStorage.getItem('company') || 'furlads'

    const userMessage: ChasUiMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: question,
      createdAt: new Date().toISOString(),
      imageDataUrl: chasImageDataUrl || undefined,
      jobId: null
    }

    setChasMessages((prev) => [...prev, userMessage])

    setChasBusy(true)
    setChasError('')
    setQuoteMessage('')

    try {
      const res = await fetch('/api/chas/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          company,
          worker: workerName,
          sessionId: chasSessionId,
          workerId,
          question,
          imageDataUrl: chasImageDataUrl || ''
        })
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to ask Chas')
      }

      const answer =
        typeof data?.answer === 'string'
          ? data.answer
          : typeof data?.reply === 'string'
            ? data.reply
            : typeof data?.message === 'string'
              ? data.message
              : typeof data?.result === 'string'
                ? data.result
                : 'Chas did not return a reply.'

      const assistantMessage: ChasUiMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: answer,
        createdAt: new Date().toISOString(),
        jobId: null
      }

      setChasMessages((prev) => [...prev, assistantMessage])
      setChasQuestion('')
      clearChasImage()
    } catch (err) {
      console.error(err)
      setChasError('Failed to get a reply from Chas.')
    } finally {
      setChasBusy(false)
    }
  }

  function renderPrimaryAction(job: TimedJob) {
    const commonStyle: CSSProperties = {
      ...styles.actionButtonDark,
      width: '100%',
      minWidth: 0,
      opacity: busyJobId === job.id ? 0.6 : 1,
      cursor: busyJobId === job.id ? 'not-allowed' : 'pointer'
    }

    if (job.isStarted) {
      return (
        <button
          type="button"
          onClick={() => handleFinishJob(job.id)}
          disabled={busyJobId === job.id}
          style={commonStyle}
        >
          {busyJobId === job.id ? 'Updating...' : 'Finish Job'}
        </button>
      )
    }

    if (job.isPaused) {
      return (
        <button
          type="button"
          onClick={() => handleResumeJob(job.id)}
          disabled={busyJobId === job.id}
          style={commonStyle}
        >
          {busyJobId === job.id ? 'Updating...' : 'Resume Work'}
        </button>
      )
    }

    if (!job.isWaiting) {
      return (
        <button
          type="button"
          onClick={() => handleStartJob(job.id)}
          disabled={busyJobId === job.id}
          style={commonStyle}
        >
          {busyJobId === job.id ? 'Updating...' : 'Start Job'}
        </button>
      )
    }

    return null
  }

  return (
    <main style={styles.page}>
      <style>{`
        @keyframes chasDotBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.28; }
          40% { transform: translateY(-4px); opacity: 1; }
        }

        * {
          box-sizing: border-box;
        }

        input, textarea, select, button {
          font: inherit;
        }

        a, button {
          -webkit-tap-highlight-color: transparent;
        }
      `}</style>

      <div style={styles.shell}>
        <section style={styles.topCard}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 12,
              marginBottom: 16,
              flexWrap: 'wrap'
            }}
          >
            <div>
              {!logoHidden && (
                <div style={{ marginBottom: 10 }}>
                  <img
                    src="/furlads-logo.png"
                    alt="Furlads and Three Counties"
                    onError={() => setLogoHidden(true)}
                    style={{
                      height: 42,
                      width: 'auto',
                      display: 'block',
                      maxWidth: 280,
                      objectFit: 'contain'
                    }}
                  />
                </div>
              )}

              <h1
                style={{
                  margin: 0,
                  fontSize: 32,
                  lineHeight: 1,
                  fontWeight: 900
                }}
              >
                Today
              </h1>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginLeft: 'auto',
                flexWrap: 'wrap',
                justifyContent: 'flex-end'
              }}
            >
              <button
                type="button"
                onClick={openChas}
                style={{
                  ...styles.actionButtonDark,
                  minWidth: 150
                }}
              >
                <ChasMascot size={24} />
                <span>Ask Chas</span>
              </button>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 16,
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  minWidth: 0
                }}
              >
                {workerPhotoUrl ? (
                  <img
                    src={workerPhotoUrl}
                    alt={workerName || 'Worker'}
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '2px solid rgba(255,255,255,0.35)',
                      flexShrink: 0
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#facc15',
                      color: '#111',
                      fontWeight: 900,
                      fontSize: 16,
                      border: '2px solid rgba(255,255,255,0.25)',
                      flexShrink: 0
                    }}
                  >
                    {getInitials(workerName || 'Worker')}
                  </div>
                )}

                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: 0.6,
                      textTransform: 'uppercase',
                      opacity: 0.72,
                      marginBottom: 2
                    }}
                  >
                    Logged in worker
                  </div>

                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      lineHeight: 1.2,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: 180
                    }}
                  >
                    {workerName || 'Worker'}
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      opacity: 0.78,
                      marginTop: 2,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Notes and actions use this login
                  </div>
                </div>
              </div>

              <WorkerMenu />
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: 12
            }}
          >
            <TopStatCard
              label="Current time"
              value={formatLiveNow(now)}
              subtext={formatLiveDate(now)}
              clickable={false}
            />

            <TopStatCard
              label="Jobs today"
              value={progressCounts.todayTotal}
              subtext="Total jobs booked"
              active={topFilter === 'all'}
              onClick={() => setTopFilter('all')}
            />

            <TopStatCard
              label="Jobs completed"
              value={progressCounts.completed}
              subtext="Finished so far"
              active={topFilter === 'completed'}
              onClick={() => setTopFilter('completed')}
            />

            <TopStatCard
              label="Jobs left"
              value={progressCounts.left}
              subtext="Still to do"
              active={topFilter === 'left'}
              onClick={() => setTopFilter('left')}
            />
          </div>
        </section>

        {filteredActiveJob && (
          <section
            style={{
              ...styles.panel,
              marginBottom: 16,
              position: 'sticky',
              top: 10,
              zIndex: 20,
              border: '1px solid #efcf72',
              background: 'linear-gradient(180deg, #fff7d6 0%, #fff2be 100%)',
              boxShadow: '0 16px 40px rgba(0,0,0,0.12)'
            }}
          >
            <div style={{ padding: 16 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  marginBottom: 12
                }}
              >
                <div>
                  <div style={styles.sectionTitle}>Current job</div>
                  <div style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.15 }}>
                    {filteredActiveJob.title}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 15 }}>
                    {filteredActiveJob.customer?.name || 'Unknown customer'}
                  </div>
                </div>

                <div style={getStatusPill(filteredActiveJob)}>
                  {getStatusText(filteredActiveJob)}
                </div>
              </div>

              <div style={{ ...styles.gridTwo, marginBottom: 14 }}>
                <div
                  style={{
                    padding: 12,
                    borderRadius: 14,
                    background: 'rgba(255,255,255,0.6)',
                    border: '1px solid rgba(0,0,0,0.06)'
                  }}
                >
                  <div style={styles.label}>Start time</div>
                  <div style={{ ...styles.value, fontWeight: 800 }}>
                    {formatTime(filteredActiveJob.arrivedAt)}
                  </div>
                </div>

                <div
                  style={{
                    padding: 12,
                    borderRadius: 14,
                    background: 'rgba(255,255,255,0.6)',
                    border: '1px solid rgba(0,0,0,0.06)'
                  }}
                >
                  <div style={styles.label}>Projected finish</div>
                  <div style={{ ...styles.value, fontWeight: 800 }}>
                    {formatClockTime(filteredActiveJob.etaFinish)}
                  </div>
                </div>

                <div
                  style={{
                    padding: 12,
                    borderRadius: 14,
                    background: 'rgba(255,255,255,0.6)',
                    border: '1px solid rgba(0,0,0,0.06)'
                  }}
                >
                  <div style={styles.label}>Hours worked</div>
                  <div style={{ ...styles.value, fontWeight: 800 }}>
                    {formatMinutes(getLiveWorkedMinutes(filteredActiveJob, now))}
                  </div>
                </div>

                <div
                  style={{
                    padding: 12,
                    borderRadius: 14,
                    background: 'rgba(255,255,255,0.6)',
                    border: '1px solid rgba(0,0,0,0.06)'
                  }}
                >
                  <div style={styles.label}>Address</div>
                  <div style={styles.value}>
                    {filteredActiveJob.address || filteredActiveJob.customer?.address || '—'}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: 10
                }}
              >
                {filteredActiveJob.isStarted && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleFinishJob(filteredActiveJob.id)}
                      disabled={busyJobId === filteredActiveJob.id}
                      style={{
                        ...styles.actionButtonDark,
                        opacity: busyJobId === filteredActiveJob.id ? 0.6 : 1,
                        cursor: busyJobId === filteredActiveJob.id ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {busyJobId === filteredActiveJob.id ? 'Updating...' : 'Finish Job'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePauseJob(filteredActiveJob.id)}
                      disabled={busyJobId === filteredActiveJob.id}
                      style={{
                        ...styles.actionButton,
                        opacity: busyJobId === filteredActiveJob.id ? 0.6 : 1,
                        cursor: busyJobId === filteredActiveJob.id ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {busyJobId === filteredActiveJob.id ? 'Updating...' : 'Pause Work'}
                    </button>
                  </>
                )}

                {filteredActiveJob.isPaused && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleResumeJob(filteredActiveJob.id)}
                      disabled={busyJobId === filteredActiveJob.id}
                      style={{
                        ...styles.actionButtonDark,
                        opacity: busyJobId === filteredActiveJob.id ? 0.6 : 1,
                        cursor: busyJobId === filteredActiveJob.id ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {busyJobId === filteredActiveJob.id ? 'Updating...' : 'Resume Work'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleFinishJob(filteredActiveJob.id)}
                      disabled={busyJobId === filteredActiveJob.id}
                      style={{
                        ...styles.actionButton,
                        opacity: busyJobId === filteredActiveJob.id ? 0.6 : 1,
                        cursor: busyJobId === filteredActiveJob.id ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {busyJobId === filteredActiveJob.id ? 'Updating...' : 'Finish Job'}
                    </button>
                  </>
                )}

                <a href={`/jobs/${filteredActiveJob.id}`} style={styles.actionButton}>
                  Open Job
                </a>

                {filteredActiveJob.customer?.phone && (
                  <a href={`tel:${filteredActiveJob.customer.phone}`} style={styles.actionButton}>
                    Call Customer
                  </a>
                )}

                {(filteredActiveJob.customer?.postcode || filteredActiveJob.address || filteredActiveJob.customer?.address) && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      filteredActiveJob.customer?.postcode || filteredActiveJob.address || filteredActiveJob.customer?.address || ''
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    style={styles.actionButton}
                  >
                    Navigate
                  </a>
                )}
              </div>
            </div>
          </section>
        )}

        {!loading && !error && workerId && upcomingJobs.length > 0 && (
          <section style={{ ...styles.panel, ...styles.panelPadding, marginBottom: 16 }}>
            <div style={styles.sectionTitle}>Coming up</div>

            <div
              style={{
                display: 'grid',
                gap: 10
              }}
            >
              {upcomingJobs.map((job) => (
                <a
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  style={{
                    textDecoration: 'none',
                    color: 'inherit',
                    border: '1px solid #e5e7eb',
                    borderRadius: 14,
                    padding: 14,
                    background: '#fafafa'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      alignItems: 'flex-start',
                      flexWrap: 'wrap'
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
                        {job.title}
                      </div>
                      <div style={{ fontSize: 14, color: colours.inkSoft }}>
                        {job.customer?.name || 'Unknown customer'}
                      </div>
                      <div style={{ fontSize: 13, color: colours.muted, marginTop: 4 }}>
                        {job.address}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '8px 10px',
                        borderRadius: 12,
                        background: '#fff',
                        border: '1px solid #ddd',
                        fontSize: 12,
                        fontWeight: 800,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {formatShortDate(job.visitDate)}{job.startTime ? ` • ${job.startTime}` : ''}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        {loading && (
          <section style={{ ...styles.panel, ...styles.panelPadding, marginBottom: 16 }}>
            <div style={{ fontWeight: 700 }}>Loading jobs...</div>
          </section>
        )}

        {!loading && error && (
          <section
            style={{
              ...styles.panel,
              ...styles.panelPadding,
              marginBottom: 16,
              border: `1px solid ${colours.redLine}`,
              background: colours.redSoft
            }}
          >
            <div style={{ fontWeight: 700 }}>{error}</div>
          </section>
        )}

        {!loading && !error && !workerId && (
          <section style={{ ...styles.panel, ...styles.panelPadding, marginBottom: 16 }}>
            <div style={{ fontWeight: 700 }}>No worker selected.</div>
            <div style={{ marginTop: 6, color: colours.muted }}>
              Go back and choose a worker first.
            </div>
          </section>
        )}

        {!loading && !error && workerId && filteredNextJobs.length === 0 && !filteredActiveJob && filteredCompletedJobs.length === 0 && (
          <section style={{ ...styles.panel, ...styles.panelPadding, marginBottom: 16 }}>
            <div style={{ fontWeight: 700 }}>No open jobs assigned to you.</div>
          </section>
        )}

        {!loading && !error && workerId && filteredNextJobs.length > 0 && (
          <section style={{ marginBottom: 18 }}>
            <div style={{ ...styles.sectionTitle, marginBottom: 12 }}>
              {showingLeftOnly ? 'Jobs left' : 'Next jobs'}
            </div>

            {filteredNextJobs.map((job, index) => {
              const navigationQuery =
                job.customer?.postcode || job.address || job.customer?.address || ''

              const startedAt = job.arrivedAt || null
              const pausedAt = job.pausedAt || null
              const livePausedMinutes = job.isPaused ? getPausedLiveMinutes(job, now) : 0

              const firstCollapsedHeadlineIndex = filteredNextJobs.findIndex(
                (item) => item.isWaiting
              )

              const shouldCollapseToHeadline =
                job.isWaiting &&
                firstCollapsedHeadlineIndex !== -1 &&
                index > firstCollapsedHeadlineIndex

              if (shouldCollapseToHeadline) {
                return (
                  <div
                    key={job.id}
                    style={{
                      ...styles.panel,
                      padding: 14,
                      marginBottom: 8,
                      background: '#fafafa'
                    }}
                  >
                    <a
                      href={`/jobs/${job.id}`}
                      style={{
                        textDecoration: 'none',
                        color: 'inherit',
                        display: 'block'
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 12
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 800 }}>{job.title}</div>
                          <div style={{ marginTop: 4, fontSize: 13, color: colours.muted }}>
                            ETA start: {formatClockTime(job.etaStart)}
                          </div>
                        </div>

                        <div style={getStatusPill(job)}>{getStatusText(job)}</div>
                      </div>
                    </a>
                  </div>
                )
              }

              return (
                <div
                  key={job.id}
                  style={{
                    ...styles.jobCard,
                    ...getJobCardStyle(job)
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 12,
                      flexWrap: 'wrap',
                      marginBottom: 12
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <a
                        href={`/jobs/${job.id}`}
                        style={{ textDecoration: 'none', color: 'inherit' }}
                      >
                        <h2
                          style={{
                            margin: 0,
                            fontSize: 22,
                            lineHeight: 1.15,
                            fontWeight: 900
                          }}
                        >
                          {job.title}
                        </h2>
                      </a>

                      <div style={{ marginTop: 6, fontSize: 15 }}>
                        {job.customer?.name || 'Unknown customer'}
                      </div>
                    </div>

                    <div style={getStatusPill(job)}>{getStatusText(job)}</div>
                  </div>

                  <div style={{ ...styles.gridTwo, marginBottom: 12 }}>
                    <div
                      style={{
                        padding: 12,
                        borderRadius: 14,
                        background: 'rgba(255,255,255,0.65)',
                        border: '1px solid rgba(0,0,0,0.06)'
                      }}
                    >
                      <div style={styles.label}>Job type</div>
                      <div style={styles.value}>{job.jobType}</div>
                    </div>

                    <div
                      style={{
                        padding: 12,
                        borderRadius: 14,
                        background: 'rgba(255,255,255,0.65)',
                        border: '1px solid rgba(0,0,0,0.06)'
                      }}
                    >
                      <div style={styles.label}>
                        {job.isStarted || job.isPaused ? 'Projected finish' : 'ETA start'}
                      </div>
                      <div style={{ ...styles.value, fontWeight: 800 }}>
                        {formatClockTime(job.isStarted || job.isPaused ? job.etaFinish : job.etaStart)}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: 12,
                        borderRadius: 14,
                        background: 'rgba(255,255,255,0.65)',
                        border: '1px solid rgba(0,0,0,0.06)'
                      }}
                    >
                      <div style={styles.label}>Planned time</div>
                      <div style={{ ...styles.value, fontWeight: 800 }}>
                        {formatMinutes(job.plannedMinutes)}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: 12,
                        borderRadius: 14,
                        background: 'rgba(255,255,255,0.65)',
                        border: '1px solid rgba(0,0,0,0.06)'
                      }}
                    >
                      <div style={styles.label}>Address</div>
                      <div style={styles.value}>{job.address}</div>
                    </div>
                  </div>

                  {(job.isStarted || job.isPaused || job.notes) && (
                    <div
                      style={{
                        marginBottom: 12,
                        padding: 12,
                        borderRadius: 14,
                        background: 'rgba(255,255,255,0.55)',
                        border: '1px solid rgba(0,0,0,0.06)'
                      }}
                    >
                      {job.isStarted && (
                        <>
                          <div style={{ marginBottom: 6, fontSize: 14 }}>
                            <strong>Start time:</strong> {formatTime(startedAt)}
                          </div>
                          <div style={{ marginBottom: 6, fontSize: 14 }}>
                            <strong>Hours worked:</strong> {formatMinutes(getLiveWorkedMinutes(job, now))}
                          </div>
                        </>
                      )}

                      {job.isPaused && (
                        <>
                          <div style={{ marginBottom: 6, fontSize: 14 }}>
                            <strong>Start time:</strong> {formatTime(startedAt)}
                          </div>
                          <div style={{ marginBottom: 6, fontSize: 14 }}>
                            <strong>Paused at:</strong> {formatTime(pausedAt)}
                          </div>
                          <div style={{ marginBottom: 6, fontSize: 14 }}>
                            <strong>Hours worked:</strong> {formatMinutes(getLiveWorkedMinutes(job, now))}
                          </div>
                          <div style={{ marginBottom: 6, fontSize: 14 }}>
                            <strong>Paused live:</strong> {formatMinutes(livePausedMinutes)}
                          </div>
                        </>
                      )}

                      {job.notes && (
                        <div style={{ fontSize: 14, whiteSpace: 'pre-line' }}>
                          <strong>Notes:</strong> {job.notes}
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ marginBottom: 12 }}>
                    {renderPrimaryAction(job)}
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                      gap: 10
                    }}
                  >
                    <a href={`/jobs/${job.id}`} style={styles.actionButton}>
                      Open Job
                    </a>

                    {job.customer?.phone && (
                      <a href={`tel:${job.customer.phone}`} style={styles.actionButton}>
                        Call Customer
                      </a>
                    )}

                    {navigationQuery && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(navigationQuery)}`}
                        target="_blank"
                        rel="noreferrer"
                        style={styles.actionButton}
                      >
                        Navigate
                      </a>
                    )}

                    {job.isStarted && (
                      <>
                        <button
                          type="button"
                          onClick={() => handlePauseJob(job.id)}
                          disabled={busyJobId === job.id}
                          style={{
                            ...styles.actionButton,
                            opacity: busyJobId === job.id ? 0.6 : 1,
                            cursor: busyJobId === job.id ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {busyJobId === job.id ? 'Updating...' : 'Pause Work'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCannotComplete(job.id)}
                          disabled={busyJobId === job.id}
                          style={{
                            ...styles.actionButton,
                            background: colours.redSoft,
                            opacity: busyJobId === job.id ? 0.6 : 1,
                            cursor: busyJobId === job.id ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {busyJobId === job.id ? 'Updating...' : "Couldn't Complete"}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleUndoStart(job.id)}
                          disabled={busyJobId === job.id}
                          style={{
                            ...styles.actionButton,
                            opacity: busyJobId === job.id ? 0.6 : 1,
                            cursor: busyJobId === job.id ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {busyJobId === job.id ? 'Updating...' : 'Undo Start'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleExtendJob(job.id, 15)}
                          disabled={busyJobId === job.id}
                          style={{
                            ...styles.actionButton,
                            opacity: busyJobId === job.id ? 0.6 : 1,
                            cursor: busyJobId === job.id ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {busyJobId === job.id ? 'Updating...' : '+15'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleExtendJob(job.id, 30)}
                          disabled={busyJobId === job.id}
                          style={{
                            ...styles.actionButton,
                            opacity: busyJobId === job.id ? 0.6 : 1,
                            cursor: busyJobId === job.id ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {busyJobId === job.id ? 'Updating...' : '+30'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleExtendJob(job.id, 45)}
                          disabled={busyJobId === job.id}
                          style={{
                            ...styles.actionButton,
                            opacity: busyJobId === job.id ? 0.6 : 1,
                            cursor: busyJobId === job.id ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {busyJobId === job.id ? 'Updating...' : '+45'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleExtendJob(job.id, 60)}
                          disabled={busyJobId === job.id}
                          style={{
                            ...styles.actionButton,
                            opacity: busyJobId === job.id ? 0.6 : 1,
                            cursor: busyJobId === job.id ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {busyJobId === job.id ? 'Updating...' : '+60'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOtherExtendJob(job.id)}
                          disabled={busyJobId === job.id}
                          style={{
                            ...styles.actionButton,
                            opacity: busyJobId === job.id ? 0.6 : 1,
                            cursor: busyJobId === job.id ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {busyJobId === job.id ? 'Updating...' : 'Other'}
                        </button>
                      </>
                    )}

                    {job.isPaused && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleFinishJob(job.id)}
                          disabled={busyJobId === job.id}
                          style={{
                            ...styles.actionButton,
                            opacity: busyJobId === job.id ? 0.6 : 1,
                            cursor: busyJobId === job.id ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {busyJobId === job.id ? 'Updating...' : 'Finish Job'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCannotComplete(job.id)}
                          disabled={busyJobId === job.id}
                          style={{
                            ...styles.actionButton,
                            background: colours.redSoft,
                            opacity: busyJobId === job.id ? 0.6 : 1,
                            cursor: busyJobId === job.id ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {busyJobId === job.id ? 'Updating...' : "Couldn't Complete"}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleUndoStart(job.id)}
                          disabled={busyJobId === job.id}
                          style={{
                            ...styles.actionButton,
                            opacity: busyJobId === job.id ? 0.6 : 1,
                            cursor: busyJobId === job.id ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {busyJobId === job.id ? 'Updating...' : 'Undo Start'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </section>
        )}

        {!loading && !error && workerId && filteredCompletedJobs.length > 0 && (
          <section style={{ marginBottom: 20 }}>
            <div style={{ ...styles.sectionTitle, marginBottom: 12 }}>
              {showingCompletedOnly ? 'Jobs completed' : 'Completed today'}
            </div>

            {filteredCompletedJobs.map((job) => {
              const startedAt = job.arrivedAt || null
              const completedAt = job.finishedAt || null
              const totalTime = formatDurationMinutes(startedAt, completedAt)

              return (
                <div
                  key={job.id}
                  style={{
                    ...styles.jobCard,
                    ...getJobCardStyle(job)
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 12,
                      flexWrap: 'wrap'
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                        <div style={{ fontSize: 20, fontWeight: 900 }}>{job.title}</div>
                        <div style={getStatusPill(job)}>{getStatusText(job)}</div>
                      </div>

                      <div style={{ ...styles.gridTwo, maxWidth: 620 }}>
                        <div>
                          <div style={styles.label}>Completed</div>
                          <div style={styles.value}>{formatTime(completedAt)}</div>
                        </div>

                        <div>
                          <div style={styles.label}>Started</div>
                          <div style={styles.value}>{formatTime(startedAt)}</div>
                        </div>

                        <div>
                          <div style={styles.label}>Total time</div>
                          <div style={styles.value}>{totalTime}</div>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleUndoDone(job.id)}
                      disabled={busyJobId === job.id}
                      style={{
                        ...styles.actionButton,
                        minWidth: 120,
                        color: '#1d5d2c',
                        border: '1px solid #7bc586',
                        opacity: busyJobId === job.id ? 0.6 : 1,
                        cursor: busyJobId === job.id ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {busyJobId === job.id ? 'Updating...' : 'Undo'}
                    </button>
                  </div>
                </div>
              )
            })}
          </section>
        )}
      </div>

      {chasOpen && (
        <div
          onClick={closeChas}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.58)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 12,
            zIndex: 1000
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 820,
              height: '86vh',
              overflow: 'hidden',
              background: '#fff',
              borderRadius: 20,
              border: '1px solid #ddd',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 24px 70px rgba(0,0,0,0.22)'
            }}
          >
            <div
              style={{
                padding: 16,
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                background: 'linear-gradient(180deg, #111 0%, #1b1b1b 100%)',
                color: '#fff'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <ChasMascot size={32} />
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>Chas</div>
                  <div style={{ fontSize: 13, opacity: 0.8 }}>
                    Friendly on-site help
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={closeChas}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 999,
                  border: '1px solid rgba(255,255,255,0.18)',
                  background: 'transparent',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 20
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: 16,
                background: 'linear-gradient(180deg, #fafafa 0%, #f5f5f5 100%)'
              }}
            >
              {chasMessages.length === 0 && (
                <div
                  style={{
                    padding: 16,
                    borderRadius: 16,
                    background: '#fffdf3',
                    border: '1px solid #f0e2a1',
                    fontSize: 14,
                    lineHeight: 1.5,
                    maxWidth: 520
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>
                    Ask Chas anything from site
                  </div>
                  <div style={{ opacity: 0.85 }}>
                    • What plant is this?
                    <br />
                    • How should I cut this hedge?
                    <br />
                    • What’s the safest way to tackle this?
                    <br />
                    • Need to create a new quote
                  </div>
                </div>
              )}

              {chasMessages.map((message) => (
                <div
                  key={message.id}
                  style={{
                    marginBottom: 14,
                    display: 'flex',
                    justifyContent:
                      message.role === 'user' ? 'flex-end' : 'flex-start'
                  }}
                >
                  <div
                    style={{
                      maxWidth: '86%',
                      padding: 13,
                      borderRadius: 16,
                      background: message.role === 'user' ? '#111' : '#fffdf5',
                      color: message.role === 'user' ? '#fff' : '#111',
                      border:
                        message.role === 'user'
                          ? '1px solid #111'
                          : '1px solid #eee0a2',
                      boxShadow:
                        message.role === 'user'
                          ? '0 10px 24px rgba(0,0,0,0.12)'
                          : '0 10px 24px rgba(0,0,0,0.05)'
                    }}
                  >
                    {message.imageDataUrl && (
                      <img
                        src={message.imageDataUrl}
                        alt="Attached"
                        style={{
                          width: 96,
                          height: 96,
                          objectFit: 'cover',
                          borderRadius: 10,
                          marginBottom: 8,
                          display: 'block',
                          border: '1px solid rgba(0,0,0,0.08)'
                        }}
                      />
                    )}

                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                      {message.text}
                    </div>

                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 11,
                        opacity: 0.7
                      }}
                    >
                      {formatChasTimestamp(message.createdAt)}
                    </div>
                  </div>
                </div>
              ))}

              {chasBusy && (
                <div
                  style={{
                    marginBottom: 14,
                    display: 'flex',
                    justifyContent: 'flex-start'
                  }}
                >
                  <div
                    style={{
                      maxWidth: '86%',
                      padding: 13,
                      borderRadius: 16,
                      background: '#fffdf5',
                      color: '#111',
                      border: '1px solid #eee0a2',
                      boxShadow: '0 10px 24px rgba(0,0,0,0.05)'
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>
                      Chas is thinking...
                    </div>

                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          background: '#111',
                          animation: 'chasDotBounce 1.2s infinite'
                        }}
                      />
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          background: '#111',
                          animation: 'chasDotBounce 1.2s infinite',
                          animationDelay: '0.15s'
                        }}
                      />
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          background: '#111',
                          animation: 'chasDotBounce 1.2s infinite',
                          animationDelay: '0.3s'
                        }}
                      />
                    </div>

                    <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
                      This can take a few seconds on longer replies.
                    </div>
                  </div>
                </div>
              )}

              <div ref={chasMessagesEndRef} />
            </div>

            <div
              style={{
                padding: 16,
                borderTop: '1px solid #eee',
                background: '#fff'
              }}
            >
              {showQuoteForm && (
                <div
                  style={{
                    marginBottom: 14,
                    padding: 14,
                    borderRadius: 14,
                    border: '1px solid #ddd',
                    background: '#fafafa'
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: 10 }}>
                    New Quote
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: 10,
                      flexWrap: 'wrap',
                      marginBottom: 12
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setQuoteCustomerMode('existing')
                        setQuoteMessage('')
                      }}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 10,
                        border:
                          quoteCustomerMode === 'existing'
                            ? '1px solid #111'
                            : '1px solid #ccc',
                        background:
                          quoteCustomerMode === 'existing' ? '#111' : '#fff',
                        color: quoteCustomerMode === 'existing' ? '#fff' : '#111',
                        cursor: 'pointer',
                        fontWeight: 700
                      }}
                    >
                      Existing customer
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setQuoteCustomerMode('new')
                        setQuoteSelectedCustomerId('')
                        setQuoteCustomerSearch('')
                        setQuoteCustomerName('')
                        setQuoteCustomerPhone('')
                        setQuoteCustomerEmail('')
                        setQuoteCustomerAddress('')
                        setQuoteCustomerPostcode('')
                        setQuoteMessage('')
                      }}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 10,
                        border:
                          quoteCustomerMode === 'new'
                            ? '1px solid #111'
                            : '1px solid #ccc',
                        background: quoteCustomerMode === 'new' ? '#111' : '#fff',
                        color: quoteCustomerMode === 'new' ? '#fff' : '#111',
                        cursor: 'pointer',
                        fontWeight: 700
                      }}
                    >
                      New customer
                    </button>
                  </div>

                  <div
                    style={{
                      maxHeight: 320,
                      overflowY: 'auto',
                      paddingRight: 4
                    }}
                  >
                    {quoteCustomerMode === 'existing' && (
                      <div
                        style={{
                          marginBottom: 12,
                          display: 'grid',
                          gap: 10,
                          gridTemplateColumns: '1fr'
                        }}
                      >
                        <input
                          value={quoteCustomerSearch}
                          onChange={(e) => {
                            setQuoteCustomerSearch(e.target.value)
                            setQuoteSelectedCustomerId('')
                          }}
                          placeholder="Find customer by name, phone, address or postcode"
                          style={{
                            padding: 12,
                            borderRadius: 10,
                            border: '1px solid #ccc',
                            fontSize: 14
                          }}
                        />

                        <select
                          value={quoteSelectedCustomerId}
                          onChange={(e) => setQuoteSelectedCustomerId(e.target.value)}
                          style={{
                            padding: 12,
                            borderRadius: 10,
                            border: '1px solid #ccc',
                            fontSize: 14,
                            background: '#fff'
                          }}
                        >
                          <option value="">Select existing customer</option>
                          {filteredQuoteCustomers.map((customer) => (
                            <option key={customer.id} value={customer.id}>
                              {customer.name}
                              {customer.postcode ? ` — ${customer.postcode}` : ''}
                              {customer.address ? ` — ${customer.address}` : ''}
                            </option>
                          ))}
                        </select>

                        {quoteCustomerSearch.trim() &&
                          filteredQuoteCustomers.length === 0 && (
                            <div
                              style={{
                                fontSize: 13,
                                color: '#666',
                                marginTop: -2
                              }}
                            >
                              No matching customers found.
                            </div>
                          )}
                      </div>
                    )}

                    <div
                      style={{
                        display: 'grid',
                        gap: 10,
                        gridTemplateColumns: '1fr'
                      }}
                    >
                      <input
                        value={quoteCustomerName}
                        onChange={(e) => setQuoteCustomerName(e.target.value)}
                        placeholder="Customer name"
                        style={{
                          padding: 12,
                          borderRadius: 10,
                          border: '1px solid #ccc',
                          fontSize: 14
                        }}
                      />

                      <input
                        value={quoteCustomerPhone}
                        onChange={(e) => setQuoteCustomerPhone(e.target.value)}
                        placeholder="Customer phone"
                        style={{
                          padding: 12,
                          borderRadius: 10,
                          border: '1px solid #ccc',
                          fontSize: 14
                        }}
                      />

                      <input
                        value={quoteCustomerEmail}
                        onChange={(e) => setQuoteCustomerEmail(e.target.value)}
                        placeholder="Customer email (optional)"
                        style={{
                          padding: 12,
                          borderRadius: 10,
                          border: '1px solid #ccc',
                          fontSize: 14
                        }}
                      />

                      <input
                        value={quoteCustomerAddress}
                        onChange={(e) => setQuoteCustomerAddress(e.target.value)}
                        placeholder="Customer address"
                        style={{
                          padding: 12,
                          borderRadius: 10,
                          border: '1px solid #ccc',
                          fontSize: 14
                        }}
                      />

                      <input
                        value={quoteCustomerPostcode}
                        onChange={(e) => setQuoteCustomerPostcode(e.target.value)}
                        placeholder="Customer postcode"
                        style={{
                          padding: 12,
                          borderRadius: 10,
                          border: '1px solid #ccc',
                          fontSize: 14
                        }}
                      />

                      <textarea
                        value={quoteWorkSummary}
                        onChange={(e) => setQuoteWorkSummary(e.target.value)}
                        placeholder="What work is needed?"
                        style={{
                          minHeight: 90,
                          padding: 12,
                          borderRadius: 10,
                          border: '1px solid #ccc',
                          fontFamily: 'inherit',
                          fontSize: 14,
                          resize: 'vertical'
                        }}
                      />

                      <input
                        value={quoteEstimatedTime}
                        onChange={(e) => setQuoteEstimatedTime(e.target.value)}
                        placeholder="How long do you think it will take conservatively?"
                        style={{
                          padding: 12,
                          borderRadius: 10,
                          border: '1px solid #ccc',
                          fontSize: 14
                        }}
                      />

                      <textarea
                        value={quoteNotes}
                        onChange={(e) => setQuoteNotes(e.target.value)}
                        placeholder="Extra notes for the office (optional)"
                        style={{
                          minHeight: 80,
                          padding: 12,
                          borderRadius: 10,
                          border: '1px solid #ccc',
                          fontFamily: 'inherit',
                          fontSize: 14,
                          resize: 'vertical'
                        }}
                      />
                    </div>
                  </div>

                  {quoteMessage && (
                    <div
                      style={{
                        marginTop: 10,
                        fontSize: 13,
                        color: quoteMessage.includes('successfully') ? '#1b5e20' : '#b00020'
                      }}
                    >
                      {quoteMessage}
                    </div>
                  )}

                  <div
                    style={{
                      marginTop: 12,
                      display: 'flex',
                      gap: 10,
                      flexWrap: 'wrap'
                    }}
                  >
                    <button
                      type="button"
                      onClick={handleSendQuoteRequest}
                      disabled={quoteBusy}
                      style={{
                        padding: '12px 16px',
                        borderRadius: 10,
                        border: '1px solid #111',
                        background: '#111',
                        color: '#fff',
                        cursor: quoteBusy ? 'not-allowed' : 'pointer',
                        opacity: quoteBusy ? 0.7 : 1,
                        fontWeight: 700
                      }}
                    >
                      {quoteBusy ? 'Saving...' : 'Save New Quote'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowQuoteForm(false)}
                      disabled={quoteBusy}
                      style={{
                        padding: '12px 16px',
                        borderRadius: 10,
                        border: '1px solid #ccc',
                        background: '#fff',
                        cursor: quoteBusy ? 'not-allowed' : 'pointer',
                        opacity: quoteBusy ? 0.7 : 1
                      }}
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}

              {chasImageDataUrl && (
                <div
                  style={{
                    marginBottom: 12,
                    padding: 12,
                    borderRadius: 12,
                    border: '1px solid #eadc97',
                    background: '#fff8d9'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 8,
                      gap: 12
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700 }}>
                      Attached image{chasImageName ? `: ${chasImageName}` : ''}
                    </div>

                    <button
                      type="button"
                      onClick={clearChasImage}
                      disabled={chasBusy || quoteBusy}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: '1px solid #ccc',
                        background: '#fff',
                        cursor: chasBusy || quoteBusy ? 'not-allowed' : 'pointer',
                        opacity: chasBusy || quoteBusy ? 0.6 : 1
                      }}
                    >
                      Remove
                    </button>
                  </div>

                  <img
                    src={chasImageDataUrl}
                    alt="Preview"
                    style={{
                      width: 96,
                      height: 96,
                      objectFit: 'cover',
                      borderRadius: 10,
                      border: '1px solid #ddd'
                    }}
                  />
                </div>
              )}

              <div
                style={{
                  padding: 10,
                  borderRadius: 18,
                  border: '1px solid #e3e3e3',
                  background: '#fafafa',
                  boxShadow: '0 6px 20px rgba(0,0,0,0.04)'
                }}
              >
                <textarea
                  value={chasQuestion}
                  onChange={(e) => setChasQuestion(e.target.value)}
                  placeholder="Ask Chas for help from site..."
                  disabled={chasBusy}
                  style={{
                    width: '100%',
                    minHeight: 90,
                    padding: 12,
                    borderRadius: 14,
                    border: '1px solid #d8d8d8',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    fontSize: 15,
                    background: chasBusy ? '#f4f4f4' : '#fff'
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      if (!chasBusy) {
                        handleSendChasMessage()
                      }
                    }
                  }}
                />

                {chasError && (
                  <div style={{ marginTop: 8, color: '#b00020', fontSize: 13 }}>
                    {chasError}
                  </div>
                )}

                <div
                  style={{
                    marginTop: 12,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <label
                      style={{
                        padding: '12px 16px',
                        borderRadius: 10,
                        border: '1px solid #ccc',
                        background: '#fff',
                        cursor: chasBusy ? 'not-allowed' : 'pointer',
                        display: 'inline-block',
                        opacity: chasBusy ? 0.6 : 1,
                        fontWeight: 600
                      }}
                    >
                      📸 Add Photo
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleChasImageChange}
                        style={{ display: 'none' }}
                        disabled={chasBusy}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        setShowQuoteForm((prev) => !prev)
                        setQuoteMessage('')
                      }}
                      style={{
                        padding: '12px 16px',
                        borderRadius: 10,
                        border: '1px solid #ccc',
                        background: '#fff',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    >
                      {showQuoteForm ? 'Hide New Quote' : 'New Quote'}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleSendChasMessage}
                    disabled={chasBusy || !chasQuestion.trim()}
                    style={{
                      padding: '12px 18px',
                      borderRadius: 12,
                      border: '1px solid #111',
                      background: '#111',
                      color: '#fff',
                      cursor: chasBusy || !chasQuestion.trim() ? 'not-allowed' : 'pointer',
                      opacity: chasBusy || !chasQuestion.trim() ? 0.7 : 1,
                      fontWeight: 700,
                      minWidth: 150
                    }}
                  >
                    {chasBusy ? 'Chas is typing...' : 'Send to Chas'}
                  </button>
                </div>

                <div style={{ marginTop: 10, fontSize: 12, opacity: 0.65 }}>
                  Press Enter to send • Shift+Enter for a new line
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
