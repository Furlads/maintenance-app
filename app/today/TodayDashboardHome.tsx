'use client'

import { useEffect, useMemo, useState } from 'react'
import WorkerAvatar from '@/components/WorkerAvatar'

type Job = {
  id: number
  title: string
  jobType?: string | null
  address?: string | null
  status?: string | null
  startTime?: string | null
  customer?: {
    name?: string | null
    postcode?: string | null
    address?: string | null
  } | null
}

type ScheduleJob = {
  id: number
  title: string
  jobType: string
  customerName: string
  postcode: string | null
  address: string
  startTime: string | null
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

type AuthResponse = {
  authenticated?: boolean
  name?: string | null
  workerId?: number | null
}

type WeatherResponse = {
  summary?: string | null
  locationName?: string | null
}

type ToolSuggestion = {
  name: string
  extra?: boolean
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

function displayTime(value?: string | null) {
  if (!value) return 'Running order'
  return value.slice(0, 5)
}

function getDestination(job: Job | null) {
  if (!job) return ''
  return job.customer?.postcode || job.address || job.customer?.address || ''
}

function toDashboardJob(job: ScheduleJob): Job {
  return {
    id: job.id,
    title: job.title,
    jobType: job.jobType,
    address: job.address,
    status: job.status,
    startTime: job.startTime,
    customer: {
      name: job.customerName,
      postcode: job.postcode,
      address: job.address
    }
  }
}

function getToolSuggestions(jobs: Job[]): ToolSuggestion[] {
  if (jobs.length === 0) return []

  const text = jobs.map((job) => `${job.title} ${job.jobType || ''}`).join(' ').toLowerCase()
  const tools = new Map<string, ToolSuggestion>()

  const add = (name: string, extra = false) => {
    if (!tools.has(name)) tools.set(name, { name, extra })
  }

  add('PPE')
  add('Hand tools')
  add('Broom / tidy-up kit')

  if (/hedge|shrub|prun|cut back|trimming/.test(text)) {
    add('Hedge cutter')
    add('Blower')
    add('Long-reach cutter', true)
  }
  if (/grass|mow|lawn|strim/.test(text)) {
    add('Mower')
    add('Strimmer')
    add('Blower')
  }
  if (/tree|branch|conifer|stump/.test(text)) {
    add('Chainsaw', true)
    add('Pole saw', true)
    add('Chipper', true)
  }
  if (/fenc|post|gate/.test(text)) {
    add('Post hole tools')
    add('Impact driver')
    add('Spirit level')
    add('Postcrete kit')
  }
  if (/patio|paving|slab|porcelain|sandstone|block paving/.test(text)) {
    add('Disc cutter', true)
    add('Mixer')
    add('Levels / straight edge')
    add('Rubber mallet')
  }
  if (/dig|excavat|scrape|driveway|groundwork|soil|pond|hardcore/.test(text)) {
    add('Digger', true)
    add('Dumper', true)
    add('Shovels / rakes')
  }
  if (/concrete|break out|breakout|remove concrete/.test(text)) {
    add('Breaker', true)
    add('Disc cutter', true)
  }
  if (/gravel|stone|membrane/.test(text)) {
    add('Wheelbarrow')
    add('Rakes')
    add('Membrane knife')
  }
  if (/turf|topsoil|seed/.test(text)) {
    add('Landscaping rake')
    add('Wheelbarrow')
    add('Roller', true)
  }
  if (/deck|timber|sleeper|shed|pergola/.test(text)) {
    add('Impact driver')
    add('Circular / mitre saw', true)
    add('Levels')
  }
  if (/pressure wash|jet wash|cleaning/.test(text)) {
    add('Pressure washer', true)
    add('Hose / connectors')
  }

  return Array.from(tools.values()).slice(0, 9)
}

export default function TodayDashboardHome() {
  const [workerName, setWorkerName] = useState('')
  const [jobs, setJobs] = useState<Job[]>([])
  const [weather, setWeather] = useState('Loading today’s forecast…')
  const [weatherLocation, setWeatherLocation] = useState('')
  const [loading, setLoading] = useState(true)

  const activeJobs = useMemo(() => jobs.filter((job) => !isFinished(job)), [jobs])
  const nextJob = activeJobs[0] || null
  const toolSuggestions = useMemo(() => getToolSuggestions(activeJobs), [activeJobs])
  const extraTools = toolSuggestions.filter((tool) => tool.extra)
  const isJacob = /^jacob(?:\s|$)/i.test(workerName.trim())

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
    if (loading || activeJobs.length > 0) return

    const hideDuplicateEmptyState = () => {
      const elements = Array.from(document.querySelectorAll('div, p')) as HTMLElement[]
      const emptyMessage = elements.find((element) => element.textContent?.trim() === 'No jobs booked for today.')
      const card = emptyMessage?.closest('section') || emptyMessage?.parentElement?.parentElement
      if (card instanceof HTMLElement && !card.closest('[data-today-dashboard-home]')) card.style.display = 'none'
    }

    hideDuplicateEmptyState()
    const observer = new MutationObserver(hideDuplicateEmptyState)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [loading, activeJobs.length])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const authRes = await fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' })
        const auth: AuthResponse | null = await authRes.json().catch(() => null)

        if (!authRes.ok || !auth?.authenticated || !auth.workerId) return
        if (cancelled) return

        setWorkerName(String(auth.name || '').trim())

        const scheduleRes = await fetch(`/api/schedule/day?date=${encodeURIComponent(todayKey())}`, {
          cache: 'no-store',
          credentials: 'include'
        })
        const scheduleData: ScheduleResponse | null = await scheduleRes.json().catch(() => null)
        const workerSchedule = scheduleData?.workers?.find((worker) => worker.id === auth.workerId)
        const nextJobs = (workerSchedule?.jobs || []).map(toDashboardJob)

        if (!cancelled) setJobs(nextJobs)

        const nextActive = nextJobs.find((job) => !isFinished(job)) || null
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
    <div data-today-dashboard-home className={`worker-home-page ${isJacob ? 'worker-home-three-counties' : ''}`}>
      <style>{`
        .worker-home-page { background:#f3f4f1; padding:14px 14px 8px; }
        .worker-home-shell { max-width:984px; margin:0 auto; }
        .worker-home-hero { background:linear-gradient(145deg,#111,#1d1d1d); color:#fff; border-radius:24px; padding:20px; box-shadow:0 16px 38px rgba(0,0,0,.14); }
        .worker-home-top { display:flex; align-items:center; justify-content:space-between; gap:14px; }
        .worker-home-person { display:flex; align-items:center; gap:12px; min-width:0; }
        .worker-home-kicker { font-size:12px; opacity:.68; font-weight:850; text-transform:uppercase; letter-spacing:.7px; }
        .worker-home-brand { margin-top:4px; font-size:10px; font-weight:900; letter-spacing:.85px; text-transform:uppercase; color:#9ac43c; }
        .worker-home-title { margin:3px 0 0; font-size:34px; line-height:1; font-weight:950; }
        .worker-home-status { font-size:13px; font-weight:800; color:#d4d4d8; text-align:right; }
        .worker-home-status strong { color:#facc15; }
        .worker-home-brief { display:grid; grid-template-columns:1.12fr .88fr; gap:12px; margin-top:16px; }
        .worker-home-next { background:#fff; color:#111; border-radius:18px; padding:17px; }
        .worker-home-weather { background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.11); border-radius:18px; padding:17px; }
        .worker-home-label { font-size:11px; opacity:.62; font-weight:900; text-transform:uppercase; letter-spacing:.75px; }
        .worker-home-next-name { font-size:22px; font-weight:950; line-height:1.08; margin-top:6px; }
        .worker-home-next-meta { margin-top:7px; color:#666; font-size:14px; font-weight:650; }
        .worker-home-next-link { color:#111; text-decoration:none; display:inline-flex; margin-top:11px; font-size:13px; font-weight:900; border-bottom:1px solid #aaa; }
        .worker-home-weather-main { font-size:19px; font-weight:900; margin-top:6px; line-height:1.25; }
        .worker-home-weather-place { margin-top:5px; font-size:12px; opacity:.62; }
        .worker-home-tools { margin-top:12px; background:#fff; color:#111; border-radius:18px; padding:15px 16px; }
        .worker-home-tools-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
        .worker-home-tools-title { font-size:16px; font-weight:950; }
        .worker-home-tools-sub { margin-top:2px; color:#71717a; font-size:12px; line-height:1.35; }
        .worker-home-tool-list { display:flex; flex-wrap:wrap; gap:7px; margin-top:10px; }
        .worker-home-tool { background:#f4f4f5; border:1px solid #e4e4e7; border-radius:999px; padding:6px 9px; font-size:12px; font-weight:800; }
        .worker-home-tool-extra { background:#fff8db; border-color:#f5cf38; }
        .worker-home-extra { color:#8a6700; font-size:11px; font-weight:900; white-space:nowrap; }
        .worker-home-actions { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:9px; margin-top:12px; }
        .worker-home-action { border:1px solid rgba(255,255,255,.16); border-radius:15px; min-height:70px; padding:12px; background:rgba(255,255,255,.96); color:#111; font-weight:900; cursor:pointer; text-decoration:none; display:flex; flex-direction:column; justify-content:center; gap:4px; text-align:left; }
        .worker-home-action-primary { background:#facc15; border-color:#facc15; }
        .worker-home-action-icon { font-size:19px; line-height:1; }
        .worker-home-action small { font-weight:650; color:#666; line-height:1.2; }
        .worker-home-action-primary small { color:#514100; }
        .worker-home-empty { margin-top:14px; display:flex; align-items:center; justify-content:space-between; gap:10px; background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.1); border-radius:15px; padding:12px 14px; }
        .worker-home-empty strong { font-size:14px; }
        .worker-home-empty a { color:#facc15; text-decoration:none; font-size:13px; font-weight:900; }

        .worker-home-three-counties { background:#eef1e8; }
        .worker-home-three-counties .worker-home-hero { background:linear-gradient(145deg,#13220f,#253817 58%,#31481b); box-shadow:0 16px 38px rgba(25,46,17,.24); }
        .worker-home-three-counties .worker-home-status strong { color:#a8cf45; }
        .worker-home-three-counties .worker-home-next { border:2px solid #91b83d; }
        .worker-home-three-counties .worker-home-label { color:#638126; opacity:1; }
        .worker-home-three-counties .worker-home-weather .worker-home-label { color:#b8d874; }
        .worker-home-three-counties .worker-home-tools { border:1px solid #d7e3bf; }
        .worker-home-three-counties .worker-home-tool { background:#f1f6e8; border-color:#d8e6bf; }
        .worker-home-three-counties .worker-home-tool-extra { background:#edf6dc; border-color:#9cc34b; }
        .worker-home-three-counties .worker-home-extra { color:#58751e; }
        .worker-home-three-counties .worker-home-action-primary { background:#8eb43c; border-color:#8eb43c; color:#10200b; }
        .worker-home-three-counties .worker-home-action-primary small { color:#26370f; }
        .worker-home-three-counties .worker-home-empty a { color:#acd354; }

        @media(max-width:760px) {
          .worker-home-page { padding:10px 10px 6px; }
          .worker-home-hero { border-radius:20px; padding:15px; }
          .worker-home-top { align-items:flex-start; }
          .worker-home-title { font-size:30px; }
          .worker-home-status { font-size:12px; padding-top:4px; }
          .worker-home-brief { grid-template-columns:1fr; gap:9px; margin-top:13px; }
          .worker-home-next,.worker-home-weather { padding:14px; }
          .worker-home-weather-main { font-size:17px; }
          .worker-home-actions { grid-template-columns:repeat(2,minmax(0,1fr)); }
          .worker-home-action { min-height:76px; }
        }
      `}</style>

      <div className="worker-home-shell">
        <section className="worker-home-hero">
          <div className="worker-home-top">
            <div className="worker-home-person">
              {workerName ? <WorkerAvatar name={workerName} size={62} /> : null}
              <div>
                <div className="worker-home-kicker">
                  {workerName ? `Morning, ${workerName.split(/\s+/)[0]}` : 'Morning'}
                </div>
                {isJacob && <div className="worker-home-brand">Three Counties Property Care</div>}
                <h1 className="worker-home-title">Today</h1>
              </div>
            </div>
            <div className="worker-home-status">
              {loading ? 'Loading your day…' : activeJobs.length === 0 ? <><strong>Clear day</strong><br />No jobs booked</> : <><strong>{activeJobs.length} job{activeJobs.length === 1 ? '' : 's'}</strong><br />on your run</>}
            </div>
          </div>

          <div className="worker-home-brief">
            <div className="worker-home-next">
              <div className="worker-home-label">{nextJob ? 'Next up' : 'Your day'}</div>
              {nextJob ? (
                <>
                  <div className="worker-home-next-name">{nextJob.customer?.name || nextJob.title}</div>
                  <div className="worker-home-next-meta">
                    {displayTime(nextJob.startTime)}{destination ? ` · ${destination}` : ''}
                  </div>
                  {mapsHref && <a className="worker-home-next-link" href={mapsHref} target="_blank" rel="noreferrer">Directions →</a>}
                </>
              ) : (
                <>
                  <div className="worker-home-next-name">Nothing booked today 🎉</div>
                  <div className="worker-home-next-meta">A clear run — check tomorrow or the calendar if you’re planning ahead.</div>
                </>
              )}
            </div>

            <div className="worker-home-weather">
              <div className="worker-home-label">Weather</div>
              <div className="worker-home-weather-main">{weather}</div>
              {weatherLocation && <div className="worker-home-weather-place">{weatherLocation}</div>}
            </div>
          </div>

          {activeJobs.length > 0 && (
            <div className="worker-home-tools">
              <div className="worker-home-tools-head">
                <div>
                  <div className="worker-home-tools-title">🧰 Quick tool check</div>
                  <div className="worker-home-tools-sub">Suggested from today’s job types — worth a glance before you leave the yard.</div>
                </div>
                {extraTools.length > 0 && <div className="worker-home-extra">⚠ {extraTools.length} extra</div>}
              </div>
              <div className="worker-home-tool-list">
                {toolSuggestions.map((tool) => (
                  <span key={tool.name} className={`worker-home-tool ${tool.extra ? 'worker-home-tool-extra' : ''}`}>
                    {tool.extra ? '⚠ ' : ''}{tool.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="worker-home-actions">
            <button type="button" className="worker-home-action worker-home-action-primary" onClick={scrollToJobs}>
              <span className="worker-home-action-icon">📋</span>
              Today’s Jobs
              <small>Full running order</small>
            </button>
            <button type="button" className="worker-home-action" onClick={openChas}>
              <span className="worker-home-action-icon">💬</span>
              Ask CHAS
              <small>Jobs, plants & safety</small>
            </button>
            <a className="worker-home-action" href="/worker/time-off">
              <span className="worker-home-action-icon">🏖️</span>
              Holiday
              <small>View or request leave</small>
            </a>
            <a className="worker-home-action" href={`tel:${OFFICE_PHONE}`}>
              <span className="worker-home-action-icon">☎️</span>
              Office
              <small>Call Kelly or Trev</small>
            </a>
          </div>

          {!loading && activeJobs.length === 0 && (
            <div className="worker-home-empty">
              <strong>Want to look ahead?</strong>
              <a href="/calendar">View calendar →</a>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
