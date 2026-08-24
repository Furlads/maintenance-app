'use client'

import { useEffect, useMemo, useState } from 'react'
import WorkerAvatar from '@/components/WorkerAvatar'

type AuthResponse = {
  authenticated?: boolean
  name?: string | null
  workerId?: number | null
}

type ScheduleJob = {
  id: number
  title: string
  jobType: string
  customerName: string
  postcode: string | null
  address: string
  startTime: string | null
  durationMinutes?: number | null
  status: string
}

type ScheduleWorker = {
  id: number
  name: string
  jobs: ScheduleJob[]
}

type ScheduleResponse = {
  date?: string
  workers?: ScheduleWorker[]
}

type CalendarDay = {
  key: string
  label: string
  shortLabel: string
  jobs: ScheduleJob[]
}

function londonDateKey(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function dateFromKey(key: string) {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
}

function addDaysToKey(key: string, amount: number) {
  const date = dateFromKey(key)
  date.setUTCDate(date.getUTCDate() + amount)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function makeDays(count = 14) {
  const days: Array<{ key: string; label: string; shortLabel: string }> = []
  const todayKey = londonDateKey(new Date())

  for (let i = 0; i < count; i += 1) {
    const key = addDaysToKey(todayKey, i)
    const date = dateFromKey(key)

    days.push({
      key,
      label: new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/London',
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(date),
      shortLabel: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/London',
        weekday: 'short',
        day: 'numeric',
      }).format(date),
    })
  }

  return days
}

function timeLabel(value?: string | null) {
  return value ? value.slice(0, 5) : 'Running order'
}

function durationLabel(minutes?: number | null) {
  if (!minutes) return ''
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours && mins) return `${hours}h ${mins}m`
  if (hours) return `${hours}h`
  return `${mins}m`
}

export default function CalendarPage() {
  const [workerName, setWorkerName] = useState('')
  const [days, setDays] = useState<CalendarDay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const baseDays = useMemo(() => makeDays(14), [])
  const isJacob = /^jacob(?:\s|$)/i.test(workerName.trim())
  const brandLogo = isJacob
    ? '/branding/three-counties/three-counties-property-care-logo.webp'
    : '/branding/furlads-logo.png'

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const authRes = await fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' })
        const auth: AuthResponse | null = await authRes.json().catch(() => null)
        if (!authRes.ok || !auth?.authenticated || !auth.workerId) throw new Error('Could not load your calendar')

        if (cancelled) return
        setWorkerName(String(auth.name || '').trim())

        const loaded = await Promise.all(
          baseDays.map(async (day) => {
            const res = await fetch(`/api/schedule/day?date=${encodeURIComponent(day.key)}`, {
              cache: 'no-store',
              credentials: 'include',
            })
            const data: ScheduleResponse | null = await res.json().catch(() => null)
            const worker = data?.workers?.find((item) => item.id === auth.workerId)
            return {
              ...day,
              jobs: worker?.jobs || [],
            }
          }),
        )

        if (!cancelled) setDays(loaded)
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Could not load your calendar')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [baseDays])

  return (
    <main className={`worker-calendar ${isJacob ? 'worker-calendar-three' : ''}`}>
      <style>{`
        .worker-calendar { --accent:#facc15; --hero:#111; --hero2:#1c1c1c; --soft:#fff8d9; min-height:100dvh; background:#f3f4f1; padding:0 0 34px; color:#111; }
        .worker-calendar-three { --accent:#93b83d; --hero:#10240f; --hero2:#29401c; --soft:#eef5e2; background:#eef1e8; }
        .worker-calendar-shell { max-width:900px; margin:0 auto; padding:10px; }
        .worker-calendar-hero { background:linear-gradient(145deg,var(--hero),var(--hero2)); color:#fff; border-radius:26px; padding:20px; display:flex; align-items:center; justify-content:space-between; gap:16px; box-shadow:0 18px 42px rgba(0,0,0,.16); }
        .worker-calendar-person { display:flex; align-items:center; gap:12px; min-width:0; }
        .worker-calendar-kicker { color:var(--accent); font-size:11px; font-weight:950; text-transform:uppercase; letter-spacing:.9px; }
        .worker-calendar-title { margin:4px 0 0; font-size:38px; line-height:1; letter-spacing:-1.2px; }
        .worker-calendar-brand { width:84px; height:84px; padding:5px; border-radius:18px; background:var(--accent); display:flex; align-items:center; justify-content:center; box-shadow:0 10px 26px rgba(0,0,0,.2); }
        .worker-calendar-three .worker-calendar-brand { background:#fff; }
        .worker-calendar-brand img { width:100%; height:100%; object-fit:contain; border-radius:12px; }
        .worker-calendar-back { display:inline-flex; margin:13px 0 0; color:#fff; background:rgba(255,255,255,.09); border:1px solid rgba(255,255,255,.12); border-radius:999px; padding:8px 11px; text-decoration:none; font-size:12px; font-weight:850; }
        .worker-calendar-list { display:grid; gap:10px; margin-top:12px; }
        .worker-calendar-day { background:#fff; border:1px solid #e5e5e5; border-radius:20px; padding:16px; box-shadow:0 8px 22px rgba(0,0,0,.045); }
        .worker-calendar-three .worker-calendar-day { border-color:#dce6ce; }
        .worker-calendar-day-head { display:flex; align-items:center; justify-content:space-between; gap:12px; }
        .worker-calendar-day-title { font-size:18px; font-weight:950; }
        .worker-calendar-day-date { color:#777; font-size:11px; font-weight:750; }
        .worker-calendar-count { min-width:34px; height:28px; padding:0 8px; border-radius:999px; display:flex; align-items:center; justify-content:center; background:var(--soft); color:#4d4300; font-size:11px; font-weight:950; }
        .worker-calendar-three .worker-calendar-count { color:#3c551a; }
        .worker-calendar-empty { margin-top:10px; color:#8a8a8a; font-size:12px; font-weight:650; }
        .worker-calendar-jobs { display:grid; gap:8px; margin-top:11px; }
        .worker-calendar-job { display:flex; align-items:center; gap:11px; padding:11px; border-radius:14px; background:#f6f6f4; text-decoration:none; color:#111; }
        .worker-calendar-three .worker-calendar-job { background:#f2f6ec; }
        .worker-calendar-time { flex:0 0 58px; color:#666; font-size:11px; font-weight:900; }
        .worker-calendar-copy { min-width:0; flex:1; }
        .worker-calendar-customer { font-size:14px; line-height:1.2; font-weight:950; }
        .worker-calendar-meta { margin-top:3px; color:#737373; font-size:10px; line-height:1.25; font-weight:650; }
        .worker-calendar-arrow { color:#999; font-size:20px; }
        .worker-calendar-state { margin-top:12px; background:#fff; border-radius:18px; padding:18px; text-align:center; color:#666; font-size:13px; font-weight:750; }
        @media(max-width:600px) {
          .worker-calendar-shell { padding:0; }
          .worker-calendar-hero { border-radius:0 0 25px 25px; padding:17px 13px 18px; }
          .worker-calendar-title { font-size:34px; }
          .worker-calendar-brand { width:72px; height:72px; }
          .worker-calendar-list { padding:0 9px 20px; }
          .worker-calendar-day { border-radius:17px; padding:14px; }
        }
      `}</style>

      <div className="worker-calendar-shell">
        <section className="worker-calendar-hero">
          <div>
            <div className="worker-calendar-person">
              {workerName ? <WorkerAvatar name={workerName} size={58} /> : null}
              <div>
                <div className="worker-calendar-kicker">Your schedule</div>
                <h1 className="worker-calendar-title">Calendar</h1>
              </div>
            </div>
            <a href="/today" className="worker-calendar-back">← Back to Today</a>
          </div>
          <div className="worker-calendar-brand"><img src={brandLogo} alt="Company logo" /></div>
        </section>

        {loading && <div className="worker-calendar-state">Loading the next 14 days…</div>}
        {error && !loading && <div className="worker-calendar-state">{error}</div>}

        {!loading && !error && (
          <div className="worker-calendar-list">
            {days.map((day) => (
              <section className="worker-calendar-day" key={day.key}>
                <div className="worker-calendar-day-head">
                  <div>
                    <div className="worker-calendar-day-title">{day.shortLabel}</div>
                    <div className="worker-calendar-day-date">{day.label}</div>
                  </div>
                  <div className="worker-calendar-count">{day.jobs.length}</div>
                </div>

                {day.jobs.length === 0 ? (
                  <div className="worker-calendar-empty">Nothing booked</div>
                ) : (
                  <div className="worker-calendar-jobs">
                    {day.jobs.map((job) => (
                      <a href={`/jobs/${job.id}`} className="worker-calendar-job" key={job.id}>
                        <div className="worker-calendar-time">{timeLabel(job.startTime)}</div>
                        <div className="worker-calendar-copy">
                          <div className="worker-calendar-customer">{job.customerName || job.title}</div>
                          <div className="worker-calendar-meta">
                            {[job.jobType, job.postcode, durationLabel(job.durationMinutes)].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                        <div className="worker-calendar-arrow">›</div>
                      </a>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
