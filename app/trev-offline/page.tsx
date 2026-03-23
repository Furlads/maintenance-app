'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type JobCard = {
  id: number
  title: string
  jobType: string
  status: string
  visitDate: string | null
  startTime: string | null
  durationMinutes: number | null
  address: string
  notes: string | null
  createdAt: string
  arrivedAt: string | null
  pausedAt: string | null
  finishedAt: string | null
  customer: {
    id: number
    name: string
    phone: string | null
    email: string | null
    address: string | null
    postcode: string | null
  } | null
  assignments?: Array<{
    id: number
    workerId: number
    worker: {
      id: number
      firstName: string
      lastName: string
    }
  }>
}

type ThreadCard = {
  threadKey: string
  conversationId: string
  displayName: string
  displayContact: string
  latestPreview: string
  latestStatus: string
  latestTime: string
  source: string
  businessLabel: string
  messageCount: number
  hasConversation: boolean
}

type TeamLiveCard = {
  workerId: number
  workerName: string
  job: JobCard | null
  statusLabel: string
  statusTone: 'green' | 'yellow' | 'blue' | 'zinc'
  withWorkers: string[]
}

type DashboardPayload = {
  session: {
    workerId: number
    workerName: string
    workerAccessLevel: string
  }
  generatedAt: string
  summary: {
    activeTeamCount: number
    myAssignedJobsCount: number
    myQuoteVisitsCount: number
    unreadThreadsCount: number
    needsAttention: number
    jobsCompletedToday: number
    jobsCompletedThisWeek: number
    quotesThisWeek: number
    enquiriesThisWeek: number
    workerQuoteThreadsCount: number
  }
  myAssignedJobs: JobCard[]
  myQuoteVisits: JobCard[]
  teamLive: TeamLiveCard[]
  trevInboxThreads: ThreadCard[]
}

const SNAPSHOT_KEY = 'furlads:trev-dashboard-snapshot'

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function formatTime(value: string | null | undefined) {
  if (!value) return '—'
  return value
}

function formatClock(value: string | null | undefined) {
  if (!value) return '—'

  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'

  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatDuration(minutes: number | null | undefined) {
  if (!minutes || minutes <= 0) return '—'

  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`
  if (hours > 0) return `${hours}h`
  return `${mins}m`
}

function normaliseSource(value: string) {
  const source = String(value || '').toLowerCase()

  if (source.includes('threecounties')) return 'threecounties-email'
  if (source.includes('furlads')) return 'furlads-email'
  if (source.includes('whatsapp')) return 'whatsapp'
  if (source.includes('facebook')) return 'facebook'
  if (source.includes('wix')) return 'wix'
  return 'worker-quote'
}

function getReadableSourceName(source: string) {
  const normalised = normaliseSource(source)

  if (normalised === 'threecounties-email') return 'Three Counties Email'
  if (normalised === 'furlads-email') return 'Furlads Email'
  if (normalised === 'whatsapp') return 'WhatsApp'
  if (normalised === 'facebook') return 'Facebook'
  if (normalised === 'wix') return 'Wix'
  return 'Worker Quote'
}

function statusIsUnread(status: string) {
  return String(status || '').toLowerCase() === 'unread'
}

function getThreadHref(thread: ThreadCard) {
  if (thread.hasConversation && thread.conversationId) {
    return `/admin/inbox/${thread.conversationId}`
  }

  return '/admin/inbox'
}

function getStatusClasses(tone: TeamLiveCard['statusTone']) {
  if (tone === 'green') {
    return 'bg-green-50 text-green-700 ring-green-200'
  }

  if (tone === 'yellow') {
    return 'bg-yellow-50 text-yellow-800 ring-yellow-200'
  }

  if (tone === 'blue') {
    return 'bg-blue-50 text-blue-700 ring-blue-200'
  }

  return 'bg-zinc-100 text-zinc-700 ring-zinc-200'
}

function getSnapshot(): DashboardPayload | null {
  if (typeof window === 'undefined') return null

  const raw = window.localStorage.getItem(SNAPSHOT_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as DashboardPayload
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch (error) {
    console.error('Failed to parse Trev dashboard snapshot:', error)
    return null
  }
}

function saveSnapshot(payload: DashboardPayload) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(payload))
  } catch (error) {
    console.error('Failed to save Trev dashboard snapshot:', error)
  }
}

function JobSection({
  title,
  empty,
  jobs,
  accent,
}: {
  title: string
  empty: string
  jobs: JobCard[]
  accent: 'yellow' | 'blue'
}) {
  const accentClasses =
    accent === 'yellow'
      ? 'border-yellow-200 bg-yellow-50 text-yellow-900'
      : 'border-blue-200 bg-blue-50 text-blue-900'

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 px-4 py-4">
        <h2 className="text-lg font-bold text-zinc-950">{title}</h2>
      </div>

      <div className="p-4">
        {jobs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">
            {empty}
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => {
              const withWorkers =
                job.assignments
                  ?.map((assignment) => `${assignment.worker.firstName} ${assignment.worker.lastName}`.trim())
                  .filter(Boolean) || []

              return (
                <div
                  key={job.id}
                  className={`rounded-2xl border p-4 ${accentClasses}`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold">
                          {job.customer?.name || job.title || `Job #${job.id}`}
                        </h3>
                        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ring-black/10">
                          {cleanString(job.jobType) || 'Job'}
                        </span>
                        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ring-black/10">
                          {cleanString(job.status) || 'Open'}
                        </span>
                      </div>

                      {job.title && job.customer?.name !== job.title ? (
                        <p className="mt-1 text-sm opacity-90">{job.title}</p>
                      ) : null}

                      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-wide opacity-70">
                            Date
                          </div>
                          <div>{formatDate(job.visitDate)}</div>
                        </div>

                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-wide opacity-70">
                            Time
                          </div>
                          <div>
                            {formatTime(job.startTime)}
                            {job.durationMinutes ? ` • ${formatDuration(job.durationMinutes)}` : ''}
                          </div>
                        </div>

                        <div className="sm:col-span-2">
                          <div className="text-[11px] font-bold uppercase tracking-wide opacity-70">
                            Address
                          </div>
                          <div>{job.address || job.customer?.address || '—'}</div>
                        </div>

                        {withWorkers.length > 0 ? (
                          <div className="sm:col-span-2">
                            <div className="text-[11px] font-bold uppercase tracking-wide opacity-70">
                              Team on this job
                            </div>
                            <div>{withWorkers.join(', ')}</div>
                          </div>
                        ) : null}

                        {job.notes ? (
                          <div className="sm:col-span-2">
                            <div className="text-[11px] font-bold uppercase tracking-wide opacity-70">
                              Notes
                            </div>
                            <div className="whitespace-pre-wrap">{job.notes}</div>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Link
                        href={`/jobs/${job.id}`}
                        className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
                      >
                        Open
                      </Link>

                      {job.customer?.phone ? (
                        <a
                          href={`tel:${job.customer.phone}`}
                          className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
                        >
                          Call
                        </a>
                      ) : null}

                      {job.customer?.postcode || job.address || job.customer?.address ? (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            job.customer?.postcode || job.address || job.customer?.address || ''
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
                        >
                          Navigate
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) }
      </div>
    </section>
  )
}

export default function TrevOfflinePage() {
  const [data, setData] = useState<DashboardPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showingOfflineSnapshot, setShowingOfflineSnapshot] = useState(false)

  async function loadDashboard() {
    try {
      setError('')

      const res = await fetch('/api/trev-dashboard', { cache: 'no-store' })

      if (!res.ok) {
        throw new Error('Failed to load Trev dashboard')
      }

      const nextData = (await res.json()) as DashboardPayload

      setData(nextData)
      saveSnapshot(nextData)
      setShowingOfflineSnapshot(false)
    } catch (err) {
      console.error(err)

      const snapshot = getSnapshot()

      if (snapshot) {
        setData(snapshot)
        setShowingOfflineSnapshot(true)
        setError('')
      } else {
        setData(null)
        setShowingOfflineSnapshot(false)
        setError('Could not load Trev dashboard.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const snapshot = getSnapshot()

    if (snapshot) {
      setData(snapshot)
      setShowingOfflineSnapshot(true)
    }

    loadDashboard()
  }, [])

  useEffect(() => {
    function handleOnline() {
      loadDashboard()
    }

    window.addEventListener('online', handleOnline)

    return () => {
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  const summary = data?.summary
  const myAssignedJobs = useMemo(() => data?.myAssignedJobs || [], [data])
  const myQuoteVisits = useMemo(() => data?.myQuoteVisits || [], [data])
  const teamLive = useMemo(() => data?.teamLive || [], [data])
  const trevInboxThreads = useMemo(() => data?.trevInboxThreads || [], [data])

  if (loading && !data) {
    return (
      <main className="min-h-screen bg-zinc-100">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm">
            Loading Trev dashboard...
          </div>
        </div>
      </main>
    )
  }

  if (error && !data) {
    return (
      <main className="min-h-screen bg-zinc-100">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
            {error}
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-zinc-100">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {showingOfflineSnapshot && (
          <div className="mb-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900 shadow-sm">
            <div className="font-bold">Showing saved offline data</div>
            <div className="mt-1 text-yellow-800">
              Signal looks weak, so this page is using the last saved Trev dashboard from this phone.
            </div>
          </div>
        )}

        <section className="rounded-3xl border border-zinc-200 bg-gradient-to-br from-zinc-950 to-zinc-800 px-5 py-5 text-white shadow-xl sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-300">
                Trev dashboard
              </div>
              <h1 className="mt-2 text-3xl font-black tracking-tight">Owner overview</h1>
              <p className="mt-2 max-w-2xl text-sm text-zinc-300">
                Your day, the team live board, quotes, inbox, and business pulse in one place.
              </p>
              <div className="mt-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-zinc-200 ring-1 ring-inset ring-white/10">
                Logged in as: {data?.session?.workerName || 'Trev'}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/jobs"
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
              >
                All jobs
              </Link>
              <Link
                href="/admin/inbox"
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
              >
                Inbox
              </Link>
              <Link
                href="/today"
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
              >
                Worker today
              </Link>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-300">
                Team active
              </div>
              <div className="mt-1 text-2xl font-black">{summary?.activeTeamCount || 0}</div>
              <div className="mt-1 text-xs text-zinc-300">Live on today’s work</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-300">
                Jobs today
              </div>
              <div className="mt-1 text-2xl font-black">{summary?.myAssignedJobsCount || 0}</div>
              <div className="mt-1 text-xs text-zinc-300">Assigned to you</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-300">
                Quotes today
              </div>
              <div className="mt-1 text-2xl font-black">{summary?.myQuoteVisitsCount || 0}</div>
              <div className="mt-1 text-xs text-zinc-300">Your quote visits</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-300">
                Inbox unread
              </div>
              <div className="mt-1 text-2xl font-black">{summary?.unreadThreadsCount || 0}</div>
              <div className="mt-1 text-xs text-zinc-300">Needs reply</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-300">
                Needs attention
              </div>
              <div className="mt-1 text-2xl font-black">{summary?.needsAttention || 0}</div>
              <div className="mt-1 text-xs text-zinc-300">Paused team jobs</div>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <JobSection
              title="Your jobs today"
              empty="No jobs assigned to your login for today."
              jobs={myAssignedJobs}
              accent="yellow"
            />

            <JobSection
              title="Your quote visits"
              empty="No quote visits assigned to your login for today."
              jobs={myQuoteVisits}
              accent="blue"
            />
          </div>

          <div className="space-y-6">
            <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-200 px-4 py-4">
                <h2 className="text-lg font-bold text-zinc-950">Team live board</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  See where everyone is and who’s together on the same job.
                </p>
              </div>

              <div className="space-y-3 p-4">
                {teamLive.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">
                    No team activity showing for today yet.
                  </div>
                ) : (
                  teamLive.map((card) => (
                    <div
                      key={card.workerId}
                      className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-base font-bold text-zinc-950">
                              {card.workerName}
                            </div>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${getStatusClasses(
                                card.statusTone
                              )}`}
                            >
                              {card.statusLabel}
                            </span>
                          </div>

                          {card.job ? (
                            <>
                              <div className="mt-2 text-sm font-semibold text-zinc-900">
                                {card.job.customer?.name || card.job.title || `Job #${card.job.id}`}
                              </div>

                              <div className="mt-1 text-sm text-zinc-600">
                                {card.job.address || card.job.customer?.address || '—'}
                              </div>

                              <div className="mt-2 grid gap-2 text-xs text-zinc-500 sm:grid-cols-2">
                                <div>Start: {formatTime(card.job.startTime)}</div>
                                <div>Arrived: {formatClock(card.job.arrivedAt)}</div>
                              </div>

                              {card.withWorkers.length > 0 ? (
                                <div className="mt-2 text-sm text-zinc-700">
                                  <span className="font-semibold">With:</span>{' '}
                                  {card.withWorkers.join(', ')}
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <div className="mt-2 text-sm text-zinc-600">
                              No current job assigned today.
                            </div>
                          )}
                        </div>

                        {card.job ? (
                          <Link
                            href={`/jobs/${card.job.id}`}
                            className="shrink-0 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
                          >
                            Open
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-200 px-4 py-4">
                <h2 className="text-lg font-bold text-zinc-950">Quotes & inbox</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Filtered for the things Trev is most likely to care about.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 p-4">
                <Link
                  href="/admin/inbox?source=worker-quote"
                  className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 hover:bg-zinc-100"
                >
                  <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-600">
                    Worker quotes
                  </div>
                  <div className="mt-1 text-2xl font-black text-zinc-950">
                    {summary?.workerQuoteThreadsCount || 0}
                  </div>
                </Link>

                <Link
                  href="/admin/inbox?view=needs-reply"
                  className="rounded-2xl border border-amber-200 bg-amber-50 p-4 hover:bg-amber-100"
                >
                  <div className="text-[11px] font-bold uppercase tracking-wide text-amber-700">
                    Needs reply
                  </div>
                  <div className="mt-1 text-2xl font-black text-amber-950">
                    {summary?.unreadThreadsCount || 0}
                  </div>
                </Link>
              </div>

              <div className="space-y-3 px-4 pb-4">
                {trevInboxThreads.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">
                    Nothing urgent in inbox right now.
                  </div>
                ) : (
                  trevInboxThreads.map((thread) => {
                    const isUnread = statusIsUnread(thread.latestStatus)

                    return (
                      <Link
                        key={thread.threadKey}
                        href={getThreadHref(thread)}
                        className="block rounded-2xl border border-zinc-200 bg-zinc-50 p-4 transition hover:border-zinc-300 hover:bg-zinc-100"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div
                                className={`truncate text-sm ${
                                  isUnread
                                    ? 'font-bold text-zinc-950'
                                    : 'font-semibold text-zinc-900'
                                }`}
                              >
                                {thread.displayName}
                              </div>

                              {isUnread ? (
                                <span className="h-2 w-2 rounded-full bg-amber-500" />
                              ) : null}

                              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-200">
                                {getReadableSourceName(thread.source)}
                              </span>
                            </div>

                            <div className="mt-1 truncate text-xs text-zinc-500">
                              {thread.displayContact}
                            </div>

                            <p
                              className={`mt-2 line-clamp-2 text-sm ${
                                isUnread ? 'font-medium text-zinc-900' : 'text-zinc-600'
                              }`}
                            >
                              {thread.latestPreview}
                            </p>
                          </div>

                          <div className="shrink-0 text-right text-[11px] text-zinc-500">
                            {formatDateTime(thread.latestTime)}
                          </div>
                        </div>
                      </Link>
                    )
                  })
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-200 px-4 py-4">
                <h2 className="text-lg font-bold text-zinc-950">Performance snapshot</h2>
              </div>

              <div className="grid grid-cols-2 gap-3 p-4">
                <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-green-700">
                    Completed today
                  </div>
                  <div className="mt-1 text-2xl font-black text-green-950">
                    {summary?.jobsCompletedToday || 0}
                  </div>
                </div>

                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-blue-700">
                    Completed this week
                  </div>
                  <div className="mt-1 text-2xl font-black text-blue-950">
                    {summary?.jobsCompletedThisWeek || 0}
                  </div>
                </div>

                <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-yellow-700">
                    Quotes this week
                  </div>
                  <div className="mt-1 text-2xl font-black text-yellow-950">
                    {summary?.quotesThisWeek || 0}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-600">
                    Enquiries this week
                  </div>
                  <div className="mt-1 text-2xl font-black text-zinc-950">
                    {summary?.enquiriesThisWeek || 0}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}