'use client'

import { useEffect, useMemo, useState } from 'react'

type Job = {
  id: number
  title: string
  address?: string | null
  status?: string | null
  startTime?: string | null
  visitDate?: string | null
  customer?: {
    name?: string | null
    postcode?: string | null
    address?: string | null
  } | null
}

type AuthResponse = {
  authenticated?: boolean
  name?: string | null
  workerId?: number | null
}

type WeatherResponse = {
  summary?: string | null
  locationName?: string | null
}

const OFFICE_PHONE = '07903192711'
const DEFAULT_POSTCODE = 'TF9 4BQ'

function todayKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date())
}

function isFinished(job: Job) {
  const status = String(job.status || '').trim().toLowerCase()
  return ['done', 'complete', 'completed', 'cancelled', 'archived'].includes(status)
}

function jobTime(job: Job) {
  return String(job.startTime || '99:99')
}

function displayTime(value?: string | null) {
  if (!value) return 'Time not set'
  return value.slice(0, 5)
}

function getDestination(job: Job | null) {
  if (!job) return ''
  return job.customer?.postcode || job.address || job.customer?.address || ''
}

export default function TodayDashboardHome() {
  const [workerName, setWorkerName] = useState('')
  const [jobs, setJobs] = useState<Job[]>([])
  const [weather, setWeather] = useState('Loading today’s forecast…')
  const [weatherLocation, setWeatherLocation] = useState('')
  const [loading, setLoading] = useState(true)

  const activeJobs = useMemo(
    () => jobs.filter((job) => !isFinished(job)).sort((a, b) => jobTime(a).localeCompare(jobTime(b))),
    [jobs]
  )

  const nextJob = activeJobs[0] || null

  useEffect(() => {
    const hideLegacyHeader = () => {
      const header = document.querySelector('.today-top-header')
      const legacySection = header?.closest('section') as HTMLElement | null
      if (legacySection) legacySection.style.display = 'none'
    }

    hideLegacyHeader()
    const observer = new MutationObserver(hideLegacyHeader)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const authRes = await fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' })
        const auth: AuthResponse | null = await authRes.json().catch(() => null)

        if (!authRes.ok || !auth?.authenticated || !auth.workerId) return
        if (cancelled) return

        setWorkerName(String(auth.name || '').trim())

        const params = new URLSearchParams({
          workerId: String(auth.workerId),
          date: todayKey(),
          pageSize: '50'
        })

        const jobsRes = await fetch(`/api/jobs?${params.toString()}`, {
          cache: 'no-store',
          credentials: 'include'
        })
        const jobsData = await jobsRes.json().catch(() => null)
        const nextJobs: Job[] = Array.isArray(jobsData?.items) ? jobsData.items : []

        if (!cancelled) setJobs(nextJobs)

        const nextActive = nextJobs
          .filter((job) => !isFinished(job))
          .sort((a, b) => jobTime(a).localeCompare(jobTime(b)))[0] || null

        const postcode = nextActive?.customer?.postcode || DEFAULT_POSTCODE
        const weatherRes = await fetch(`/api/weather/postcode?postcode=${encodeURIComponent(postcode)}`, {
          cache: 'no-store',
          credentials: 'include'
        })
        const weatherData: WeatherResponse | null = await weatherRes.json().catch(() => null)

        if (!cancelled) {
          setWeather(weatherData?.summary || 'Forecast unavailable — check conditions before setting off.')
          setWeatherLocation(weatherData?.locationName || postcode)
        }
      } catch {
        if (!cancelled) setWeather('Forecast unavailable — check conditions before setting off.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  function openChas() {
    const existingButton = document.querySelector('.today-ask-chas-button') as HTMLButtonElement | null
    if (existingButton) {
      existingButton.click()
      return
    }
    window.location.href = '/today?openChas=1'
  }

  function scrollToJobs() {
    const main = document.querySelector('main')
    if (!main) return

    const sections = Array.from(main.querySelectorAll('section')) as HTMLElement[]
    const firstVisible = sections.find((section) => section.style.display !== 'none' && !section.closest('[data-today-dashboard-home]'))
    firstVisible?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const destination = getDestination(nextJob)
  const mapsHref = destination
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`
    : ''

  return (
    <div data-today-dashboard-home style={{ background: '#f4f4f0', padding: '14px 14px 0' }}>
      <style>{`
        .worker-home-shell { max-width: 984px; margin: 0 auto; }
        .worker-home-hero { background: linear-gradient(145deg,#111,#242424); color:#fff; border-radius:24px; padding:20px; box-shadow:0 18px 45px rgba(0,0,0,.15); }
        .worker-home-grid { display:grid; grid-template-columns:1.1fr .9fr; gap:14px; margin-top:14px; }
        .worker-home-card { background:rgba(255,255,255,.09); border:1px solid rgba(255,255,255,.12); border-radius:18px; padding:16px; }
        .worker-home-actions { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; margin-top:14px; }
        .worker-home-action { border:0; border-radius:15px; min-height:72px; padding:12px; background:#fff; color:#111; font-weight:850; cursor:pointer; text-decoration:none; display:flex; flex-direction:column; justify-content:center; gap:3px; text-align:left; }
        .worker-home-action small { font-weight:600; color:#666; line-height:1.25; }
        .worker-home-next-link { color:#fff; text-decoration:none; display:inline-flex; margin-top:12px; font-weight:800; border-bottom:1px solid rgba(255,255,255,.45); }
        @media(max-width:760px) {
          .worker-home-grid { grid-template-columns:1fr; }
          .worker-home-actions { grid-template-columns:repeat(2,minmax(0,1fr)); }
          .worker-home-hero { border-radius:18px; padding:16px; }
        }
      `}</style>

      <div className="worker-home-shell">
        <section className="worker-home-hero">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 13, opacity: 0.72, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {workerName ? `Morning, ${workerName.split(/\s+/)[0]}` : 'Today'}
              </div>
              <h1 style={{ margin: '4px 0 0', fontSize: 32, lineHeight: 1, fontWeight: 950 }}>Your day</h1>
            </div>
            <div style={{ padding: '8px 12px', borderRadius: 999, background: '#facc15', color: '#111', fontWeight: 900 }}>
              {loading ? 'Loading…' : `${activeJobs.length} job${activeJobs.length === 1 ? '' : 's'} today`}
            </div>
          </div>

          <div className="worker-home-grid">
            <div className="worker-home-card">
              <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 850, textTransform: 'uppercase', letterSpacing: 0.5 }}>Next job</div>
              {nextJob ? (
                <>
                  <div style={{ fontSize: 24, fontWeight: 950, marginTop: 6, lineHeight: 1.1 }}>
                    {nextJob.customer?.name || nextJob.title}
                  </div>
                  <div style={{ marginTop: 7, opacity: 0.82 }}>
                    {displayTime(nextJob.startTime)}{destination ? ` · ${destination}` : ''}
                  </div>
                  {mapsHref && <a className="worker-home-next-link" href={mapsHref} target="_blank" rel="noreferrer">Open directions →</a>}
                </>
              ) : (
                <div style={{ fontSize: 20, fontWeight: 850, marginTop: 8 }}>Nothing else booked today</div>
              )}
            </div>

            <div className="worker-home-card">
              <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 850, textTransform: 'uppercase', letterSpacing: 0.5 }}>Today’s weather</div>
              <div style={{ fontSize: 19, fontWeight: 850, marginTop: 7, lineHeight: 1.25 }}>{weather}</div>
              {weatherLocation && <div style={{ marginTop: 7, fontSize: 13, opacity: 0.68 }}>{weatherLocation}</div>}
            </div>
          </div>

          <div className="worker-home-actions">
            <button type="button" className="worker-home-action" onClick={scrollToJobs}>
              Today’s Jobs
              <small>See the full running order</small>
            </button>
            <button type="button" className="worker-home-action" onClick={openChas}>
              Ask CHAS
              <small>Jobs, plants and safety</small>
            </button>
            <a className="worker-home-action" href="/worker/time-off">
              Holiday Request
              <small>View or request time off</small>
            </a>
            <a className="worker-home-action" href={`tel:${OFFICE_PHONE}`}>
              Contact Office
              <small>Call Kelly or Trev</small>
            </a>
          </div>
        </section>
      </div>
    </div>
  )
}
