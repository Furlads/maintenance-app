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
    day: '2-digit',
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
      address: job.address,
    },
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

  return Array.from(tools.values()).slice(0, 6)
}

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Morning'
  if (hour < 18) return 'Afternoon'
  return 'Evening'
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
  const firstName = workerName.split(/\s+/)[0] || ''
  const brandLogo = isJacob
    ? '/branding/three-counties/three-counties-property-care-logo.webp'
    : '/branding/furlads-logo.png'
  const brandAlt = isJacob ? 'Three Counties Property Care Ltd' : 'Furlads Garden Services'

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
          credentials: 'include',
        })
        const scheduleData: ScheduleResponse | null = await scheduleRes.json().catch(() => null)
        const workerSchedule = scheduleData?.workers?.find((worker) => worker.id === auth.workerId)
        const nextJobs = (workerSchedule?.jobs || []).map(toDashboardJob)
        if (!cancelled) setJobs(nextJobs)

        const nextActive = nextJobs.find((job) => !isFinished(job)) || null
        const postcode = nextActive?.customer?.postcode || DEFAULT_POSTCODE
        const weatherRes = await fetch(`/api/weather/postcode?postcode=${encodeURIComponent(postcode)}`, {
          cache: 'no-store',
          credentials: 'include',
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
    const firstVisible = sections.find(
      (section) => section.style.display !== 'none' && !section.closest('[data-today-dashboard-home]'),
    )
    firstVisible?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const destination = getDestination(nextJob)
  const mapsHref = destination
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`
    : ''

  return (
    <div data-today-dashboard-home className={`today-v2 ${isJacob ? 'today-v2-three-counties' : 'today-v2-furlads'}`}>
      <style>{`
        .today-v2 { --accent:#facc15; --accentText:#18130a; --hero:#111111; --hero2:#1c1c1c; --soft:#fff9d9; --muted:#666; --page:#f4f4f0; background:var(--page); padding:10px 10px 102px; min-height:100dvh; }
        .today-v2-three-counties { --accent:#93b83d; --accentText:#14200d; --hero:#10240f; --hero2:#29401c; --soft:#eef5e2; --page:#eef1e8; }
        .today-v2-shell { width:100%; max-width:980px; margin:0 auto; }
        .today-v2-hero { position:relative; overflow:hidden; background:linear-gradient(145deg,var(--hero),var(--hero2)); color:white; border-radius:28px; padding:22px; box-shadow:0 20px 48px rgba(0,0,0,.16); }
        .today-v2-hero:after { content:''; position:absolute; right:-100px; top:-120px; width:300px; height:300px; border-radius:50%; background:radial-gradient(circle, color-mix(in srgb, var(--accent) 20%, transparent), transparent 68%); pointer-events:none; }
        .today-v2-header { position:relative; z-index:1; display:grid; grid-template-columns:minmax(0,1fr) auto auto; gap:16px; align-items:center; }
        .today-v2-person { display:flex; gap:14px; align-items:center; min-width:0; }
        .today-v2-greeting { font-size:13px; text-transform:uppercase; letter-spacing:1px; font-weight:900; color:#d7d7d7; }
        .today-v2-three-counties .today-v2-greeting { color:#b9d777; }
        .today-v2-title { margin:4px 0 0; font-size:46px; line-height:.95; letter-spacing:-1.8px; font-weight:950; }
        .today-v2-brand { width:105px; height:105px; display:flex; align-items:center; justify-content:center; border-radius:20px; overflow:hidden; background:var(--accent); padding:7px; box-shadow:0 10px 28px rgba(0,0,0,.22); position:relative; z-index:1; }
        .today-v2-brand img { width:100%; height:100%; object-fit:contain; border-radius:13px; }
        .today-v2-three-counties .today-v2-brand { background:white; }
        .today-v2-status { position:relative; z-index:1; min-width:110px; text-align:right; font-size:15px; line-height:1.45; font-weight:800; color:#e3e3e3; }
        .today-v2-status strong { color:var(--accent); font-size:17px; }
        .today-v2-next { position:relative; z-index:1; margin-top:22px; background:white; color:#111; border-radius:24px; padding:22px; display:flex; align-items:center; justify-content:space-between; gap:16px; box-shadow:0 10px 26px rgba(0,0,0,.08); }
        .today-v2-three-counties .today-v2-next { border:1px solid #9abb55; }
        .today-v2-label { font-size:11px; font-weight:950; text-transform:uppercase; letter-spacing:.9px; color:#7a7a7a; }
        .today-v2-three-counties .today-v2-label { color:#64812c; }
        .today-v2-next-name { margin-top:7px; font-size:29px; line-height:1.05; font-weight:950; letter-spacing:-.8px; }
        .today-v2-next-meta { margin-top:8px; color:#696969; font-size:15px; line-height:1.45; font-weight:650; }
        .today-v2-next-link { flex:0 0 auto; min-width:54px; min-height:54px; border-radius:18px; display:flex; align-items:center; justify-content:center; text-decoration:none; background:var(--soft); color:var(--accentText); font-size:25px; font-weight:900; }
        .today-v2-mid { position:relative; z-index:1; display:grid; grid-template-columns:.9fr 1.1fr; gap:14px; margin-top:14px; }
        .today-v2-weather,.today-v2-tools { border-radius:22px; padding:20px; min-height:205px; }
        .today-v2-weather { background:linear-gradient(145deg,var(--hero),var(--hero2)); border:1px solid rgba(255,255,255,.1); color:white; }
        .today-v2-weather .today-v2-label { color:var(--accent); }
        .today-v2-weather-main { margin-top:15px; font-size:24px; line-height:1.22; font-weight:950; }
        .today-v2-weather-place { margin-top:14px; color:#c7c7c7; font-size:13px; font-weight:700; }
        .today-v2-tools { background:white; color:#111; border:1px solid #e5e5e5; box-shadow:0 10px 28px rgba(0,0,0,.05); }
        .today-v2-three-counties .today-v2-tools { border-color:#d7e4bf; }
        .today-v2-tools-title { font-size:17px; font-weight:950; }
        .today-v2-tools-sub { margin-top:3px; color:#777; font-size:12px; font-weight:650; }
        .today-v2-tool-list { display:grid; gap:7px; margin-top:13px; }
        .today-v2-tool { display:flex; align-items:center; justify-content:space-between; gap:10px; border-radius:11px; padding:7px 10px; background:#f4f4f4; font-size:12px; font-weight:850; }
        .today-v2-furlads .today-v2-tool { background:#fff9d9; }
        .today-v2-three-counties .today-v2-tool { background:#eef5e3; }
        .today-v2-tool-extra { outline:1px solid color-mix(in srgb, var(--accent) 70%, #b98d00); }
        .today-v2-tool-mark { color:var(--accentText); font-size:10px; font-weight:950; }
        .today-v2-no-tools { margin-top:18px; border-radius:15px; padding:16px; background:var(--soft); color:#555; font-size:13px; line-height:1.45; font-weight:750; }
        .today-v2-actions { position:relative; z-index:1; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; margin-top:14px; }
        .today-v2-action { min-height:112px; border:1px solid #e4e4e4; border-radius:22px; background:#fff; color:#111; padding:18px; text-decoration:none; display:flex; align-items:center; justify-content:space-between; gap:14px; text-align:left; cursor:pointer; box-shadow:0 8px 22px rgba(0,0,0,.045); }
        .today-v2-action-primary { background:linear-gradient(145deg,var(--hero),var(--hero2)); border-color:transparent; color:white; }
        .today-v2-action-icon { width:52px; height:52px; flex:0 0 52px; display:flex; align-items:center; justify-content:center; border-radius:50%; background:var(--soft); font-size:24px; }
        .today-v2-action-primary .today-v2-action-icon { background:var(--accent); }
        .today-v2-action-copy { min-width:0; flex:1; }
        .today-v2-action-title { font-size:18px; font-weight:950; }
        .today-v2-action-sub { margin-top:4px; color:#777; font-size:12px; font-weight:650; }
        .today-v2-action-primary .today-v2-action-sub { color:#d6d6d6; }
        .today-v2-action-arrow { font-size:25px; font-weight:800; color:#777; }
        .today-v2-action-primary .today-v2-action-arrow { color:var(--accent); }
        .today-v2-lookahead { position:relative; z-index:1; margin-top:14px; border-radius:22px; padding:17px 20px; display:flex; align-items:center; justify-content:space-between; gap:14px; background:var(--soft); color:#111; }
        .today-v2-lookahead strong { font-size:16px; }
        .today-v2-lookahead a { text-decoration:none; color:var(--accentText); border:1px solid color-mix(in srgb,var(--accent) 72%, #777); padding:9px 13px; border-radius:12px; font-size:13px; font-weight:950; white-space:nowrap; }
        .today-v2-three-counties .today-v2-lookahead a { color:#395017; }
        .today-v2-nav { position:fixed; left:10px; right:10px; bottom:calc(8px + env(safe-area-inset-bottom)); z-index:70; max-width:760px; margin:0 auto; display:grid; grid-template-columns:repeat(5,1fr); gap:3px; padding:8px; border-radius:23px; background:linear-gradient(145deg,var(--hero),var(--hero2)); box-shadow:0 16px 38px rgba(0,0,0,.24); }
        .today-v2-nav a,.today-v2-nav button { min-width:0; border:0; background:transparent; color:#d4d4d4; text-decoration:none; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; min-height:56px; border-radius:15px; padding:4px 2px; font-size:10px; font-weight:850; cursor:pointer; }
        .today-v2-nav .active { color:var(--accent); background:rgba(255,255,255,.06); }
        .today-v2-nav-icon { font-size:20px; line-height:1; }

        @media(max-width:680px) {
          .today-v2 { padding:0 0 96px; background:#f2f3f1; }
          .today-v2-three-counties { background:#eef1e8; }
          .today-v2-shell { max-width:none; }
          .today-v2-hero { border-radius:0 0 28px 28px; padding:18px 14px 20px; min-height:calc(100dvh - 96px); box-shadow:none; }
          .today-v2-header { grid-template-columns:minmax(0,1fr) 76px; gap:10px; }
          .today-v2-person { gap:10px; }
          .today-v2-greeting { font-size:11px; }
          .today-v2-title { font-size:40px; }
          .today-v2-brand { width:76px; height:76px; border-radius:18px; padding:5px; }
          .today-v2-status { grid-column:1 / -1; text-align:left; display:flex; gap:7px; align-items:baseline; min-width:0; margin-top:-2px; font-size:12px; }
          .today-v2-status br { display:none; }
          .today-v2-status strong { font-size:13px; }
          .today-v2-next { margin-top:15px; border-radius:22px; padding:18px; }
          .today-v2-next-name { font-size:25px; }
          .today-v2-next-meta { font-size:13px; }
          .today-v2-mid { grid-template-columns:1fr 1.12fr; gap:10px; }
          .today-v2-weather,.today-v2-tools { min-height:190px; border-radius:20px; padding:16px; }
          .today-v2-weather-main { font-size:18px; }
          .today-v2-tools-title { font-size:15px; }
          .today-v2-tools-sub { font-size:10px; }
          .today-v2-tool-list { gap:5px; margin-top:10px; }
          .today-v2-tool { padding:6px 7px; font-size:10px; }
          .today-v2-actions { gap:10px; }
          .today-v2-action { min-height:96px; border-radius:19px; padding:13px; gap:9px; }
          .today-v2-action-icon { width:42px; height:42px; flex-basis:42px; font-size:20px; }
          .today-v2-action-title { font-size:15px; }
          .today-v2-action-sub { font-size:10px; }
          .today-v2-action-arrow { display:none; }
          .today-v2-lookahead { border-radius:19px; padding:14px 15px; }
          .today-v2-lookahead strong { font-size:14px; }
          .today-v2-nav { left:6px; right:6px; bottom:calc(5px + env(safe-area-inset-bottom)); border-radius:20px; padding:6px; }
          .today-v2-nav a,.today-v2-nav button { min-height:52px; font-size:9px; }
          .today-v2-nav-icon { font-size:18px; }
        }

        @media(max-width:390px) {
          .today-v2-mid { grid-template-columns:1fr; }
          .today-v2-weather,.today-v2-tools { min-height:0; }
          .today-v2-header { grid-template-columns:minmax(0,1fr) 66px; }
          .today-v2-brand { width:66px; height:66px; }
        }
      `}</style>

      <div className="today-v2-shell">
        <section className="today-v2-hero">
          <div className="today-v2-header">
            <div className="today-v2-person">
              {workerName ? <WorkerAvatar name={workerName} size={70} /> : null}
              <div>
                <div className="today-v2-greeting">{workerName ? `${greeting()}, ${firstName}` : greeting()}</div>
                <h1 className="today-v2-title">Today</h1>
              </div>
            </div>

            <div className="today-v2-brand">
              <img src={brandLogo} alt={brandAlt} />
            </div>

            <div className="today-v2-status">
              {loading ? (
                'Loading your day…'
              ) : activeJobs.length === 0 ? (
                <><strong>Clear day</strong><br />No jobs booked</>
              ) : (
                <><strong>{activeJobs.length} job{activeJobs.length === 1 ? '' : 's'} today</strong><br />Ready to go</>
              )}
            </div>
          </div>

          <div className="today-v2-next">
            <div>
              <div className="today-v2-label">{nextJob ? 'Next job' : 'Your day'}</div>
              {nextJob ? (
                <>
                  <div className="today-v2-next-name">{nextJob.customer?.name || nextJob.title}</div>
                  <div className="today-v2-next-meta">{displayTime(nextJob.startTime)}{destination ? ` · ${destination}` : ''}</div>
                </>
              ) : (
                <>
                  <div className="today-v2-next-name">Nothing else booked today 🎉</div>
                  <div className="today-v2-next-meta">You’re all clear. Check tomorrow’s schedule or use the time to prep and get ahead.</div>
                </>
              )}
            </div>
            {mapsHref ? (
              <a className="today-v2-next-link" href={mapsHref} target="_blank" rel="noreferrer" aria-label="Directions">➜</a>
            ) : (
              <a className="today-v2-next-link" href="/calendar" aria-label="Calendar">📅</a>
            )}
          </div>

          <div className="today-v2-mid">
            <div className="today-v2-weather">
              <div className="today-v2-label">Today’s weather</div>
              <div className="today-v2-weather-main">🌦️ {weather}</div>
              {weatherLocation && <div className="today-v2-weather-place">📍 {weatherLocation}</div>}
            </div>

            <div className="today-v2-tools">
              <div className="today-v2-tools-title">🔧 Quick tool check</div>
              <div className="today-v2-tools-sub">Based on today’s booked work</div>
              {toolSuggestions.length > 0 ? (
                <div className="today-v2-tool-list">
                  {toolSuggestions.map((tool) => (
                    <div key={tool.name} className={`today-v2-tool ${tool.extra ? 'today-v2-tool-extra' : ''}`}>
                      <span>{tool.name}</span>
                      <span className="today-v2-tool-mark">{tool.extra ? 'EXTRA' : '✓'}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="today-v2-no-tools">Nothing special flagged today. Standard PPE, hand tools and tidy-up kit should cover the basics.</div>
              )}
              {extraTools.length > 0 && <div className="today-v2-tools-sub" style={{ marginTop: 8 }}>⚠ {extraTools.length} easy-to-forget extra{extraTools.length === 1 ? '' : 's'}</div>}
            </div>
          </div>

          <div className="today-v2-actions">
            <button type="button" className="today-v2-action today-v2-action-primary" onClick={scrollToJobs}>
              <span className="today-v2-action-icon">📋</span>
              <span className="today-v2-action-copy">
                <span className="today-v2-action-title">Today’s Jobs</span>
                <span className="today-v2-action-sub">See the full running order</span>
              </span>
              <span className="today-v2-action-arrow">›</span>
            </button>

            <button type="button" className="today-v2-action" onClick={openChas}>
              <span className="today-v2-action-icon">💬</span>
              <span className="today-v2-action-copy">
                <span className="today-v2-action-title">Ask CHAS</span>
                <span className="today-v2-action-sub">Jobs, plants and safety</span>
              </span>
              <span className="today-v2-action-arrow">›</span>
            </button>

            <a className="today-v2-action" href="/worker/time-off">
              <span className="today-v2-action-icon">📅</span>
              <span className="today-v2-action-copy">
                <span className="today-v2-action-title">Holiday Request</span>
                <span className="today-v2-action-sub">View or request time off</span>
              </span>
              <span className="today-v2-action-arrow">›</span>
            </a>

            <a className="today-v2-action" href={`tel:${OFFICE_PHONE}`}>
              <span className="today-v2-action-icon">☎️</span>
              <span className="today-v2-action-copy">
                <span className="today-v2-action-title">Contact Office</span>
                <span className="today-v2-action-sub">Call Kelly or Trevor</span>
              </span>
              <span className="today-v2-action-arrow">›</span>
            </a>
          </div>

          {!loading && activeJobs.length === 0 && (
            <div className="today-v2-lookahead">
              <strong>Nothing booked today 🎉</strong>
              <a href="/calendar">View calendar</a>
            </div>
          )}
        </section>
      </div>

      <nav className="today-v2-nav" aria-label="Today navigation">
        <a href="/today" className="active"><span className="today-v2-nav-icon">⌂</span><span>Today</span></a>
        <button type="button" onClick={scrollToJobs}><span className="today-v2-nav-icon">🚚</span><span>Next Job</span></button>
        <button type="button" onClick={openChas}><span className="today-v2-nav-icon">💬</span><span>Ask CHAS</span></button>
        <a href="/worker/time-off"><span className="today-v2-nav-icon">📅</span><span>Holiday</span></a>
        <a href={`tel:${OFFICE_PHONE}`}><span className="today-v2-nav-icon">☎</span><span>Office</span></a>
      </nav>
    </div>
  )
}
