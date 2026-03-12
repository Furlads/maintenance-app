'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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

function chasStorageKey(workerName: string) {
  const worker = (workerName || 'unknown').trim().toLowerCase()
  const today = new Date().toISOString().slice(0, 10)
  return `chas-thread-${worker}-${today}`
}

function formatChasTimestamp(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return ''

  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function TodayPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [workerId, setWorkerId] = useState<number | null>(null)
  const [workerName, setWorkerName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyJobId, setBusyJobId] = useState<number | null>(null)
  const [now, setNow] = useState(new Date())

  const [chasOpen, setChasOpen] = useState(false)
  const [chasQuestion, setChasQuestion] = useState('')
  const [chasBusy, setChasBusy] = useState(false)
  const [chasError, setChasError] = useState('')
  const [chasMessages, setChasMessages] = useState<ChasUiMessage[]>([])
  const [chasImageDataUrl, setChasImageDataUrl] = useState('')
  const [chasImageName, setChasImageName] = useState('')
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

  useEffect(() => {
    const savedWorkerId = localStorage.getItem('workerId')
    const savedWorkerName = localStorage.getItem('workerName')

    if (savedWorkerId) {
      setWorkerId(Number(savedWorkerId))
    }

    if (savedWorkerName) {
      setWorkerName(savedWorkerName)
    }

    loadJobs()
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!workerName) return

    try {
      const raw = localStorage.getItem(chasStorageKey(workerName))
      if (!raw) {
        setChasMessages([])
        return
      }

      const parsed = JSON.parse(raw)
      setChasMessages(Array.isArray(parsed) ? parsed : [])
    } catch {
      setChasMessages([])
    }
  }, [workerName])

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
      .filter((job) =>
        job.assignments.some((assignment) => assignment.workerId === workerId)
      )
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

  function persistChasMessages(nextMessages: ChasUiMessage[]) {
    setChasMessages(nextMessages)

    if (!workerName) return

    try {
      localStorage.setItem(chasStorageKey(workerName), JSON.stringify(nextMessages))
    } catch {}
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

  async function handleChasImageChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0]

    if (!file) return

    try {
      const dataUrl = await fileToDataUrl(file)
      setChasImageDataUrl(dataUrl)
      setChasImageName(file.name)
      setChasError('')
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

    const nextMessages = [...chasMessages, userMessage]
    persistChasMessages(nextMessages)

    setChasBusy(true)
    setChasError('')

    try {
      const res = await fetch('/api/chas/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          company,
          worker: workerName,
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

      persistChasMessages([...nextMessages, assistantMessage])
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
    const commonStyle: React.CSSProperties = {
      padding: '14px 18px',
      borderRadius: 10,
      border: '1px solid #111',
      background: '#111',
      color: '#fff',
      cursor: busyJobId === job.id ? 'not-allowed' : 'pointer',
      opacity: busyJobId === job.id ? 0.6 : 1,
      fontWeight: 700,
      minWidth: 170
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
    <main style={{ padding: 20, fontFamily: 'sans-serif', maxWidth: 800 }}>
      <style>{`
        @keyframes chasDotBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.28; }
          40% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'start',
          gap: 12,
          marginBottom: 8
        }}
      >
        <h1 style={{ fontSize: 28, marginBottom: 0 }}>Today</h1>
        <WorkerMenu />
      </div>

      <div
        style={{
          marginBottom: 16,
          padding: '12px 16px',
          borderRadius: 10,
          border: '1px solid #ddd',
          background: '#f9f9f9'
        }}
      >
        <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 4 }}>Current time</div>
        <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.1 }}>
          {formatLiveNow(now)}
        </div>
        <div style={{ fontSize: 14, marginTop: 4 }}>{formatLiveDate(now)}</div>
      </div>

      {workerName && (
        <p style={{ marginTop: 0, marginBottom: 20 }}>
          Logged in as <strong>{workerName}</strong>
        </p>
      )}

      {activeJob && (
        <div
          style={{
            position: 'sticky',
            top: 10,
            zIndex: 20,
            marginBottom: 16,
            padding: 16,
            borderRadius: 12,
            border: '1px solid #f0c36d',
            background: '#fff3cd',
            boxShadow: '0 8px 20px rgba(0,0,0,0.08)'
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, opacity: 0.8 }}>
            CURRENT JOB
          </div>

          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
            {activeJob.title}
          </div>

          <div style={{ fontSize: 14, marginBottom: 4 }}>
            {activeJob.customer?.name || 'Unknown customer'}
          </div>

          <div style={{ fontSize: 14, marginBottom: 10 }}>
            Started: {formatTime(activeJob.arrivedAt)} • Time on site:{' '}
            {formatMinutes(getLiveWorkedMinutes(activeJob, now))}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {activeJob.isStarted && (
              <>
                <button
                  type="button"
                  onClick={() => handleFinishJob(activeJob.id)}
                  disabled={busyJobId === activeJob.id}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 8,
                    border: '1px solid #111',
                    background: '#111',
                    color: '#fff',
                    cursor: busyJobId === activeJob.id ? 'not-allowed' : 'pointer',
                    opacity: busyJobId === activeJob.id ? 0.6 : 1,
                    fontWeight: 700
                  }}
                >
                  {busyJobId === activeJob.id ? 'Updating...' : 'Finish Job'}
                </button>

                <button
                  type="button"
                  onClick={() => handlePauseJob(activeJob.id)}
                  disabled={busyJobId === activeJob.id}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 8,
                    border: '1px solid #ccc',
                    background: '#fff',
                    cursor: busyJobId === activeJob.id ? 'not-allowed' : 'pointer',
                    opacity: busyJobId === activeJob.id ? 0.6 : 1
                  }}
                >
                  {busyJobId === activeJob.id ? 'Updating...' : 'Pause Work'}
                </button>
              </>
            )}

            {activeJob.isPaused && (
              <>
                <button
                  type="button"
                  onClick={() => handleResumeJob(activeJob.id)}
                  disabled={busyJobId === activeJob.id}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 8,
                    border: '1px solid #111',
                    background: '#111',
                    color: '#fff',
                    cursor: busyJobId === activeJob.id ? 'not-allowed' : 'pointer',
                    opacity: busyJobId === activeJob.id ? 0.6 : 1,
                    fontWeight: 700
                  }}
                >
                  {busyJobId === activeJob.id ? 'Updating...' : 'Resume Work'}
                </button>

                <button
                  type="button"
                  onClick={() => handleFinishJob(activeJob.id)}
                  disabled={busyJobId === activeJob.id}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 8,
                    border: '1px solid #ccc',
                    background: '#fff',
                    cursor: busyJobId === activeJob.id ? 'not-allowed' : 'pointer',
                    opacity: busyJobId === activeJob.id ? 0.6 : 1
                  }}
                >
                  {busyJobId === activeJob.id ? 'Updating...' : 'Finish Job'}
                </button>
              </>
            )}

            <a
              href={`/jobs/${activeJob.id}`}
              style={{
                padding: '12px 16px',
                borderRadius: 8,
                border: '1px solid #ccc',
                background: '#fff',
                color: 'inherit',
                textDecoration: 'none',
                display: 'inline-block'
              }}
            >
              Open Job
            </a>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <a
          href="/jobs"
          style={{
            display: 'inline-block',
            padding: '12px 16px',
            borderRadius: 8,
            border: '1px solid #ccc',
            textDecoration: 'none',
            color: 'inherit',
            marginRight: 10
          }}
        >
          View All Jobs
        </a>

        <a
          href="/customers"
          style={{
            display: 'inline-block',
            padding: '12px 16px',
            borderRadius: 8,
            border: '1px solid #ccc',
            textDecoration: 'none',
            color: 'inherit',
            marginRight: 10
          }}
        >
          View Customers
        </a>

        <button
          type="button"
          onClick={() => setChasOpen(true)}
          style={{
            display: 'inline-block',
            padding: '12px 16px',
            borderRadius: 8,
            border: '1px solid #111',
            background: '#111',
            color: '#fff',
            cursor: 'pointer',
            fontWeight: 700
          }}
        >
          Chas 💬
        </button>
      </div>

      {loading && <p>Loading jobs...</p>}

      {!loading && error && <p>{error}</p>}

      {!loading && !error && !workerId && (
        <p>No worker selected. Go back and choose a worker first.</p>
      )}

      {!loading && !error && workerId && listJobs.length === 0 && !activeJob && (
        <p>No open jobs assigned to you.</p>
      )}

      {!loading &&
        !error &&
        listJobs.map((job, index) => {
          const navigationQuery =
            job.customer?.postcode || job.address || job.customer?.address || ''

          const startedAt = job.arrivedAt || null
          const pausedAt = job.pausedAt || null
          const completedAt = job.finishedAt || null
          const totalTime = formatDurationMinutes(startedAt, completedAt)
          const livePausedMinutes = job.isPaused ? getPausedLiveMinutes(job, now) : 0

          const firstCollapsedHeadlineIndex = listJobs.findIndex(
            (item) => item.isWaiting
          )

          const shouldCollapseToHeadline =
            job.isWaiting &&
            firstCollapsedHeadlineIndex !== -1 &&
            index > firstCollapsedHeadlineIndex

          const cardStyle: React.CSSProperties = job.isDone
            ? {
                background: '#ddffdd',
                border: '1px solid #7bd77b'
              }
            : job.isStarted || job.isPaused || job.isNext
              ? {
                  background: '#fff3cd',
                  border: '1px solid #f0c36d'
                }
              : {
                  background: '#ffe5e5',
                  border: '1px solid #f2aaaa'
                }

          if (job.isDone) {
            return (
              <div
                key={job.id}
                style={{
                  padding: 16,
                  borderRadius: 10,
                  marginBottom: 12,
                  ...cardStyle
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <h2 style={{ margin: '0 0 8px 0', fontSize: 18 }}>{job.title}</h2>

                    <p style={{ margin: '4px 0', fontSize: 14 }}>
                      <strong>Job completed:</strong> {formatTime(completedAt)}
                    </p>

                    <p style={{ margin: '4px 0', fontSize: 14 }}>
                      <strong>Job started:</strong> {formatTime(startedAt)}
                    </p>

                    <p style={{ margin: '4px 0', fontSize: 14 }}>
                      <strong>Total time on site:</strong> {totalTime}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleUndoDone(job.id)}
                    disabled={busyJobId === job.id}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 8,
                      border: '1px solid #2f8f2f',
                      background: '#fff',
                      color: '#2f8f2f',
                      cursor: busyJobId === job.id ? 'not-allowed' : 'pointer',
                      opacity: busyJobId === job.id ? 0.6 : 1,
                      minWidth: 110
                    }}
                  >
                    {busyJobId === job.id ? 'Updating...' : 'Undo'}
                  </button>
                </div>
              </div>
            )
          }

          if (shouldCollapseToHeadline) {
            return (
              <div
                key={job.id}
                style={{
                  padding: 12,
                  borderRadius: 10,
                  marginBottom: 8,
                  border: '1px solid #ddd',
                  background: '#f9f9f9'
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
                  <h2 style={{ margin: 0, fontSize: 16 }}>{job.title}</h2>
                </a>

                <p style={{ margin: '6px 0 0 0', fontSize: 13 }}>
                  <strong>ETA start:</strong> {formatClockTime(job.etaStart)}
                </p>
              </div>
            )
          }

          return (
            <div
              key={job.id}
              style={{
                padding: 16,
                borderRadius: 10,
                marginBottom: 12,
                ...cardStyle
              }}
            >
              <a
                href={`/jobs/${job.id}`}
                style={{
                  textDecoration: 'none',
                  color: 'inherit'
                }}
              >
                <h2 style={{ margin: '0 0 8px 0', fontSize: 20 }}>{job.title}</h2>
              </a>

              <p style={{ margin: '4px 0' }}>
                <strong>Customer:</strong> {job.customer?.name || 'Unknown customer'}
              </p>

              <p style={{ margin: '4px 0' }}>
                <strong>Type:</strong> {job.jobType}
              </p>

              <p style={{ margin: '4px 0' }}>
                <strong>Status:</strong>{' '}
                {job.isPaused
                  ? 'Paused'
                  : job.isStarted
                    ? 'In progress'
                    : job.isNext
                      ? 'Travelling'
                      : 'Waiting to start'}
              </p>

              <p style={{ margin: '4px 0' }}>
                <strong>Address:</strong> {job.address}
              </p>

              <p style={{ margin: '4px 0' }}>
                <strong>{job.isStarted || job.isPaused ? 'ETA finish:' : 'ETA start:'}</strong>{' '}
                {formatClockTime(job.isStarted || job.isPaused ? job.etaFinish : job.etaStart)}
              </p>

              <p style={{ margin: '4px 0' }}>
                <strong>Planned time:</strong> {job.plannedMinutes} mins
              </p>

              {job.isPaused && (
                <p style={{ margin: '4px 0' }}>
                  <strong>Paused live:</strong> {formatMinutes(livePausedMinutes)}
                </p>
              )}

              {job.notes && (
                <p style={{ margin: '4px 0', whiteSpace: 'pre-line' }}>
                  <strong>Notes:</strong> {job.notes}
                </p>
              )}

              {job.isStarted && (
                <p style={{ margin: '4px 0' }}>
                  <strong>Started:</strong> {formatTime(startedAt)}
                </p>
              )}

              {job.isPaused && (
                <>
                  <p style={{ margin: '4px 0' }}>
                    <strong>Started:</strong> {formatTime(startedAt)}
                  </p>

                  <p style={{ margin: '4px 0' }}>
                    <strong>Paused at:</strong> {formatTime(pausedAt)}
                  </p>
                </>
              )}

              <div style={{ marginTop: 14, marginBottom: 12 }}>
                {renderPrimaryAction(job)}
              </div>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <a
                  href={`/jobs/${job.id}`}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 8,
                    border: '1px solid #ccc',
                    textDecoration: 'none',
                    color: 'inherit',
                    background: '#fff'
                  }}
                >
                  Open Job
                </a>

                {job.customer?.phone && (
                  <a
                    href={`tel:${job.customer.phone}`}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 8,
                      border: '1px solid #ccc',
                      textDecoration: 'none',
                      color: 'inherit',
                      background: '#fff'
                    }}
                  >
                    Call Customer
                  </a>
                )}

                {navigationQuery && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(navigationQuery)}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding: '12px 16px',
                      borderRadius: 8,
                      border: '1px solid #ccc',
                      textDecoration: 'none',
                      color: 'inherit',
                      background: '#fff'
                    }}
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
                        padding: '12px 16px',
                        borderRadius: 8,
                        border: '1px solid #ccc',
                        background: '#fff',
                        color: 'inherit',
                        cursor: busyJobId === job.id ? 'not-allowed' : 'pointer',
                        opacity: busyJobId === job.id ? 0.6 : 1
                      }}
                    >
                      {busyJobId === job.id ? 'Updating...' : 'Pause Work'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCannotComplete(job.id)}
                      disabled={busyJobId === job.id}
                      style={{
                        padding: '12px 16px',
                        borderRadius: 8,
                        border: '1px solid #ccc',
                        background: '#ffe5e5',
                        color: 'inherit',
                        cursor: busyJobId === job.id ? 'not-allowed' : 'pointer',
                        opacity: busyJobId === job.id ? 0.6 : 1
                      }}
                    >
                      {busyJobId === job.id ? 'Updating...' : "Couldn't Complete"}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleUndoStart(job.id)}
                      disabled={busyJobId === job.id}
                      style={{
                        padding: '12px 16px',
                        borderRadius: 8,
                        border: '1px solid #ccc',
                        background: '#fff',
                        color: 'inherit',
                        cursor: busyJobId === job.id ? 'not-allowed' : 'pointer',
                        opacity: busyJobId === job.id ? 0.6 : 1
                      }}
                    >
                      {busyJobId === job.id ? 'Updating...' : 'Undo Start'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExtendJob(job.id, 15)}
                      disabled={busyJobId === job.id}
                      style={{
                        padding: '12px 16px',
                        borderRadius: 8,
                        border: '1px solid #ccc',
                        background: '#fff',
                        color: 'inherit',
                        cursor: busyJobId === job.id ? 'not-allowed' : 'pointer',
                        opacity: busyJobId === job.id ? 0.6 : 1
                      }}
                    >
                      {busyJobId === job.id ? 'Updating...' : '+15'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExtendJob(job.id, 30)}
                      disabled={busyJobId === job.id}
                      style={{
                        padding: '12px 16px',
                        borderRadius: 8,
                        border: '1px solid #ccc',
                        background: '#fff',
                        color: 'inherit',
                        cursor: busyJobId === job.id ? 'not-allowed' : 'pointer',
                        opacity: busyJobId === job.id ? 0.6 : 1
                      }}
                    >
                      {busyJobId === job.id ? 'Updating...' : '+30'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExtendJob(job.id, 45)}
                      disabled={busyJobId === job.id}
                      style={{
                        padding: '12px 16px',
                        borderRadius: 8,
                        border: '1px solid #ccc',
                        background: '#fff',
                        color: 'inherit',
                        cursor: busyJobId === job.id ? 'not-allowed' : 'pointer',
                        opacity: busyJobId === job.id ? 0.6 : 1
                      }}
                    >
                      {busyJobId === job.id ? 'Updating...' : '+45'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExtendJob(job.id, 60)}
                      disabled={busyJobId === job.id}
                      style={{
                        padding: '12px 16px',
                        borderRadius: 8,
                        border: '1px solid #ccc',
                        background: '#fff',
                        color: 'inherit',
                        cursor: busyJobId === job.id ? 'not-allowed' : 'pointer',
                        opacity: busyJobId === job.id ? 0.6 : 1
                      }}
                    >
                      {busyJobId === job.id ? 'Updating...' : '+60'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOtherExtendJob(job.id)}
                      disabled={busyJobId === job.id}
                      style={{
                        padding: '12px 16px',
                        borderRadius: 8,
                        border: '1px solid #ccc',
                        background: '#fff',
                        color: 'inherit',
                        cursor: busyJobId === job.id ? 'not-allowed' : 'pointer',
                        opacity: busyJobId === job.id ? 0.6 : 1
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
                        padding: '12px 16px',
                        borderRadius: 8,
                        border: '1px solid #ccc',
                        background: '#fff',
                        color: 'inherit',
                        cursor: busyJobId === job.id ? 'not-allowed' : 'pointer',
                        opacity: busyJobId === job.id ? 0.6 : 1
                      }}
                    >
                      {busyJobId === job.id ? 'Updating...' : 'Finish Job'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCannotComplete(job.id)}
                      disabled={busyJobId === job.id}
                      style={{
                        padding: '12px 16px',
                        borderRadius: 8,
                        border: '1px solid #ccc',
                        background: '#ffe5e5',
                        color: 'inherit',
                        cursor: busyJobId === job.id ? 'not-allowed' : 'pointer',
                        opacity: busyJobId === job.id ? 0.6 : 1
                      }}
                    >
                      {busyJobId === job.id ? 'Updating...' : "Couldn't Complete"}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleUndoStart(job.id)}
                      disabled={busyJobId === job.id}
                      style={{
                        padding: '12px 16px',
                        borderRadius: 8,
                        border: '1px solid #ccc',
                        background: '#fff',
                        color: 'inherit',
                        cursor: busyJobId === job.id ? 'not-allowed' : 'pointer',
                        opacity: busyJobId === job.id ? 0.6 : 1
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

      {chasOpen && (
        <div
          onClick={() => setChasOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
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
              maxWidth: 860,
              height: '88vh',
              overflow: 'hidden',
              background: '#fff',
              borderRadius: 22,
              border: '1px solid #ddd',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 28px 80px rgba(0,0,0,0.24)'
            }}
          >
            <div
              style={{
                padding: 18,
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                background: 'linear-gradient(180deg, #111 0%, #1b1b1b 100%)',
                color: '#fff'
              }}
            >
              <div>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 10px',
                    borderRadius: 999,
                    border: '1px solid rgba(255,255,255,0.14)',
                    background: 'rgba(255,255,255,0.08)',
                    fontSize: 12,
                    fontWeight: 700,
                    marginBottom: 10
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: '#d7ff76',
                      display: 'inline-block'
                    }}
                  />
                  Always online
                </div>

                <div style={{ fontSize: 22, fontWeight: 800 }}>Chas 💬</div>
                <div style={{ fontSize: 13, opacity: 0.8 }}>
                  Like the office lad who’s always about to help
                </div>
              </div>

              <button
                type="button"
                onClick={() => setChasOpen(false)}
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
                background: 'linear-gradient(180deg, #fafafa 0%, #f4f4f4 100%)'
              }}
            >
              {chasMessages.length === 0 && (
                <div
                  style={{
                    padding: 18,
                    borderRadius: 18,
                    background: '#fffdf3',
                    border: '1px solid #f0e2a1',
                    fontSize: 14,
                    lineHeight: 1.6,
                    maxWidth: 560,
                    boxShadow: '0 10px 24px rgba(0,0,0,0.04)'
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>
                    Ask Chas anything from site
                  </div>
                  <div style={{ opacity: 0.88 }}>
                    • Rough guide price for a small job
                    <br />
                    • What plant is this?
                    <br />
                    • What’s the safest way to tackle this?
                    <br />
                    • Help pulling customer details together for Kelly
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
                      padding: 14,
                      borderRadius: 18,
                      background: message.role === 'user' ? '#111' : '#fffdf5',
                      color: message.role === 'user' ? '#fff' : '#111',
                      border:
                        message.role === 'user'
                          ? '1px solid #111'
                          : '1px solid #eee0a2',
                      boxShadow:
                        message.role === 'user'
                          ? '0 12px 28px rgba(0,0,0,0.12)'
                          : '0 10px 24px rgba(0,0,0,0.05)'
                    }}
                  >
                    {message.imageDataUrl && (
                      <img
                        src={message.imageDataUrl}
                        alt="Attached"
                        style={{
                          width: '100%',
                          maxWidth: 130,
                          maxHeight: 130,
                          objectFit: 'cover',
                          borderRadius: 12,
                          marginBottom: 10,
                          display: 'block'
                        }}
                      />
                    )}

                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
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
                      padding: 14,
                      borderRadius: 18,
                      background: '#fffdf5',
                      color: '#111',
                      border: '1px solid #eee0a2',
                      boxShadow: '0 10px 24px rgba(0,0,0,0.05)'
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>
                      Chas is typing...
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
              {chasImageDataUrl && (
                <div
                  style={{
                    marginBottom: 12,
                    padding: 12,
                    borderRadius: 14,
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
                      disabled={chasBusy}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: '1px solid #ccc',
                        background: '#fff',
                        cursor: chasBusy ? 'not-allowed' : 'pointer',
                        opacity: chasBusy ? 0.6 : 1
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
                  borderRadius: 20,
                  border: '1px solid #e3e3e3',
                  background: '#fafafa',
                  boxShadow: '0 6px 20px rgba(0,0,0,0.04)'
                }}
              >
                <textarea
                  value={chasQuestion}
                  onChange={(e) => setChasQuestion(e.target.value)}
                  placeholder="Message Chas..."
                  disabled={chasBusy}
                  style={{
                    width: '100%',
                    minHeight: 96,
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