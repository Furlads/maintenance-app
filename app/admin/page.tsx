import Link from 'next/link'
import * as prismaModule from '@/lib/prisma'
import SourceBadge from '@/components/admin/SourceBadge'
import AdminSchedulerButton from '@/app/components/admin/AdminSchedulerButton'
import { buildContactKey } from '@/lib/inbox/contactKey'

export const dynamic = 'force-dynamic'

const prisma = ((prismaModule as any).prisma ?? (prismaModule as any).default) as any

type InboxMessageRow = {
  id: number
  conversationId: string | null
  source: string
  senderName: string | null
  senderEmail: string | null
  senderPhone: string | null
  status: string
  createdAt: Date
  conversation: {
    id: string
    source: string
    contactName: string | null
    contactRef: string | null
    archived: boolean
    createdAt: Date
  } | null
}

type DashboardInboxSource =
  | 'whatsapp'
  | 'furlads-email'
  | 'threecounties-email'
  | 'facebook'
  | 'wix'
  | 'worker-quote'

function startOfToday() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
}

function endOfToday() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
}

function fullName(firstName?: string | null, lastName?: string | null) {
  return `${firstName ?? ''} ${lastName ?? ''}`.trim() || 'Unknown worker'
}

function formatTime(value: Date | null | undefined) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatDate(value: Date | null | undefined) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

function normaliseJobType(value?: string | null) {
  const raw = String(value || '').toLowerCase()

  if (raw.includes('maint')) {
    return {
      label: 'Maintenance',
      className: 'bg-green-50 text-green-700 ring-green-200',
    }
  }

  if (raw.includes('land')) {
    return {
      label: 'Landscaping',
      className: 'bg-blue-50 text-blue-700 ring-blue-200',
    }
  }

  if (raw.includes('quote')) {
    return {
      label: 'Quote',
      className: 'bg-amber-50 text-amber-700 ring-amber-200',
    }
  }

  return {
    label: value || 'Other',
    className: 'bg-zinc-100 text-zinc-700 ring-zinc-200',
  }
}

function normaliseStatus(value?: string | null) {
  const raw = String(value || '').toLowerCase()

  if (raw.includes('progress')) return 'In progress'
  if (raw.includes('done') || raw.includes('finish')) return 'Done'
  if (raw.includes('sched')) return 'Scheduled'
  if (raw.includes('cancel')) return 'Cancelled'
  if (raw.includes('archive')) return 'Archived'
  return value || 'Unscheduled'
}

function normaliseSource(value: string): DashboardInboxSource {
  const source = String(value || '').toLowerCase()

  if (source.includes('threecounties')) return 'threecounties-email'
  if (source.includes('furlads')) return 'furlads-email'
  if (source.includes('whatsapp')) return 'whatsapp'
  if (source.includes('facebook')) return 'facebook'
  if (source.includes('wix')) return 'wix'
  return 'worker-quote'
}

function buildThreadKey(message: InboxMessageRow) {
  const contactKey = buildContactKey({
    senderPhone: message.senderPhone,
    senderEmail: message.senderEmail,
    contactRef: message.conversation?.contactRef ?? null,
    conversationId: message.conversationId ?? null,
  })

  if (contactKey) return contactKey

  return message.conversationId || `message-${message.id}`
}

function statusIsUnread(status: string) {
  return String(status || '').toLowerCase() === 'unread'
}

function buildUnreadCountsBySource(messages: InboxMessageRow[]) {
  const grouped = new Map<string, InboxMessageRow[]>()

  for (const message of messages) {
    const key = buildThreadKey(message)

    if (!grouped.has(key)) {
      grouped.set(key, [])
    }

    grouped.get(key)!.push(message)
  }

  const counts: Record<DashboardInboxSource, number> = {
    whatsapp: 0,
    'furlads-email': 0,
    'threecounties-email': 0,
    facebook: 0,
    wix: 0,
    'worker-quote': 0,
  }

  for (const items of grouped.values()) {
    const sorted = [...items].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    const latest = sorted[0]
    const source = normaliseSource(latest.source)

    if (statusIsUnread(latest.status)) {
      counts[source] += 1
    }
  }

  return counts
}

function DashboardSourceLink({
  source,
  unreadCount,
}: {
  source: DashboardInboxSource
  unreadCount: number
}) {
  return (
    <Link
      href={`/admin/inbox?source=${encodeURIComponent(source)}`}
      className="inline-flex items-center gap-2 rounded-full transition hover:scale-[1.01]"
    >
      <SourceBadge source={source} />
      <span
        className={`inline-flex min-w-[28px] items-center justify-center rounded-full px-2 py-1 text-[11px] font-bold ring-1 ring-inset ${
          unreadCount > 0
            ? 'bg-amber-50 text-amber-700 ring-amber-200'
            : 'bg-zinc-100 text-zinc-500 ring-zinc-200'
        }`}
      >
        {unreadCount}
      </span>
    </Link>
  )
}

function StatCard({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: number
  tone?: 'default' | 'green' | 'blue' | 'amber'
}) {
  const toneClasses =
    tone === 'green'
      ? 'border-green-200 bg-green-50'
      : tone === 'blue'
        ? 'border-blue-200 bg-blue-50'
        : tone === 'amber'
          ? 'border-amber-200 bg-amber-50'
          : 'border-zinc-200 bg-white'

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneClasses}`}>
      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </div>
      <div className="mt-2 text-3xl font-bold tracking-tight text-zinc-900">{value}</div>
    </div>
  )
}

export default async function AdminPage() {
  const todayStart = startOfToday()
  const todayEnd = endOfToday()

  const [jobsTodayRaw, workers, quotesWaiting, inboxMessages] = await Promise.all([
    prisma.job.findMany({
      where: {
        visitDate: {
          gte: todayStart,
          lte: todayEnd,
        },
        status: {
          notIn: ['cancelled', 'archived'],
        },
      },
      orderBy: [{ visitDate: 'asc' }, { startTime: 'asc' }, { createdAt: 'asc' }],
      take: 50,
      include: {
        customer: true,
        assignments: {
          include: {
            worker: true,
          },
        },
      },
    }),
    prisma.worker.findMany({
      where: {
        active: true,
      },
      orderBy: {
        firstName: 'asc',
      },
      take: 30,
    }),
    prisma.chasMessage.count({
      where: {
        enquiryReadyForKelly: true,
      },
    }),
    prisma.inboxMessage.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: 300,
      include: {
        conversation: true,
      },
      where: {
        OR: [{ conversation: { archived: false } }, { conversation: null }],
      },
    }) as Promise<InboxMessageRow[]>,
  ])

  const jobsToday = [...jobsTodayRaw].sort((a: any, b: any) => {
    const aTime = String(a.startTime || '99:99')
    const bTime = String(b.startTime || '99:99')

    if (aTime !== bTime) {
      return aTime.localeCompare(bTime)
    }

    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })

  const maintenanceToday = jobsToday.filter((job: any) =>
    String(job.jobType || '').toLowerCase().includes('maint')
  )

  const landscapingToday = jobsToday.filter((job: any) =>
    String(job.jobType || '').toLowerCase().includes('land')
  )

  const workersActive = jobsToday.filter((job: any) => {
    const status = String(job.status || '').toLowerCase()
    return (job.arrivedAt && !job.finishedAt) || status.includes('progress')
  })

  const activeWorkerIds = new Set<number>()
  for (const job of workersActive) {
    for (const assignment of job.assignments || []) {
      activeWorkerIds.add(assignment.worker.id)
    }
  }

  const activeWorkers = workers.filter((worker: any) => activeWorkerIds.has(worker.id))
  const unreadBySource = buildUnreadCountsBySource(inboxMessages)

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-800 p-5 text-white shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-black uppercase tracking-[0.22em] text-zinc-300">
              Daily overview
            </div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Office control for today
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">
              One dashboard for maintenance visits, landscaping jobs, worker activity,
              inbox pressure and office follow-up.
            </p>
          </div>

          <div className="grid w-full gap-2 sm:grid-cols-2 xl:w-auto xl:grid-cols-2">
            <Link
              href="/admin/inbox"
              className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-bold text-zinc-900 transition hover:bg-zinc-100"
            >
              Open inbox
            </Link>
            <Link
              href="/jobs"
              className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              View jobs
            </Link>
            <Link
              href="/admin/schedule"
              className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              Schedule board
            </Link>
            <div className="flex">
              <AdminSchedulerButton />
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Jobs today" value={jobsToday.length} />
        <StatCard label="Maintenance today" value={maintenanceToday.length} tone="green" />
        <StatCard label="Landscaping today" value={landscapingToday.length} tone="blue" />
        <StatCard label="Quotes waiting" value={quotesWaiting} tone="amber" />
      </section>

      <div className="grid gap-4 xl:grid-cols-12">
        <section className="xl:col-span-7">
          <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-bold text-zinc-900">Today&apos;s jobs</h3>
                <p className="text-xs text-zinc-500">
                  First job at the top, then the rest of the diary flows down the page
                </p>
              </div>
              <Link href="/jobs" className="text-sm font-semibold text-zinc-700">
                All jobs
              </Link>
            </div>

            <div className="p-3 sm:p-4">
              {jobsToday.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-sm text-zinc-600">
                  No jobs scheduled for today.
                </div>
              ) : (
                <div className="space-y-3">
                  {jobsToday.map((job: any) => {
                    const jobType = normaliseJobType(job.jobType)
                    const assignedNames = (job.assignments || []).map((assignment: any) =>
                      fullName(assignment.worker?.firstName, assignment.worker?.lastName)
                    )

                    return (
                      <div key={job.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
                        <div className="flex flex-col gap-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${jobType.className}`}
                                >
                                  {jobType.label}
                                </span>
                                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-200">
                                  {normaliseStatus(job.status)}
                                </span>
                              </div>

                              <h4 className="mt-3 text-lg font-bold leading-tight text-zinc-900">
                                {job.customer?.name || 'Unknown customer'}
                              </h4>

                              <p className="mt-1 text-sm leading-6 text-zinc-500">
                                {job.address || 'No address'} • {formatDate(job.visitDate)}
                              </p>
                            </div>

                            <div className="inline-flex w-fit rounded-full bg-zinc-100 px-3 py-1.5 text-sm font-bold text-zinc-700 ring-1 ring-inset ring-zinc-200">
                              {job.startTime || formatTime(job.visitDate)}
                            </div>
                          </div>

                          <div className="grid gap-2 rounded-2xl bg-zinc-50 p-3 text-sm text-zinc-700 sm:grid-cols-2">
                            <div>
                              <span className="font-semibold">Start:</span>{' '}
                              {job.startTime || 'Time TBC'}
                            </div>
                            <div>
                              <span className="font-semibold">Job ID:</span> #{job.id}
                            </div>
                            <div className="sm:col-span-2">
                              <span className="font-semibold">Assigned:</span>{' '}
                              {assignedNames.length > 0 ? assignedNames.join(', ') : 'Unassigned'}
                            </div>
                          </div>

                          <div className="grid gap-2 sm:grid-cols-3">
                            <Link
                              href={`/jobs/${job.id}`}
                              className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100"
                            >
                              Open
                            </Link>

                            <Link
                              href={`/jobs/edit/${job.id}`}
                              className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-black"
                            >
                              Edit
                            </Link>

                            <Link
                              href={`/jobs/edit/${job.id}`}
                              className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100"
                            >
                              Reschedule / push back
                            </Link>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-4 xl:col-span-5">
          <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-bold text-zinc-900">Workers active</h3>
                <p className="text-xs text-zinc-500">
                  Live view from jobs currently in progress
                </p>
              </div>
              <Link href="/workers" className="text-sm font-semibold text-zinc-700">
                Workers
              </Link>
            </div>

            <div className="p-3 sm:p-4">
              {activeWorkers.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-sm text-zinc-600">
                  No workers currently marked active.
                </div>
              ) : (
                <div className="space-y-3">
                  {activeWorkers.map((worker: any) => (
                    <div key={worker.id} className="rounded-2xl border border-zinc-200 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-zinc-900">
                            {fullName(worker.firstName, worker.lastName)}
                          </div>
                          <div className="mt-1 text-xs text-zinc-500">
                            {worker.jobTitle || 'Worker'}
                          </div>
                        </div>

                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-200">
                          Active
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-bold text-zinc-900">Inbox sources</h3>
                <p className="text-xs text-zinc-500">
                  Unread thread counts with click-through to each channel
                </p>
              </div>
              <Link href="/admin/inbox" className="text-sm font-semibold text-zinc-700">
                Inbox
              </Link>
            </div>

            <div className="p-4">
              <div className="flex flex-wrap gap-2">
                <DashboardSourceLink
                  source="whatsapp"
                  unreadCount={unreadBySource.whatsapp}
                />
                <DashboardSourceLink
                  source="furlads-email"
                  unreadCount={unreadBySource['furlads-email']}
                />
                <DashboardSourceLink
                  source="threecounties-email"
                  unreadCount={unreadBySource['threecounties-email']}
                />
                <DashboardSourceLink
                  source="worker-quote"
                  unreadCount={unreadBySource['worker-quote']}
                />
                <DashboardSourceLink
                  source="facebook"
                  unreadCount={unreadBySource.facebook}
                />
                <DashboardSourceLink
                  source="wix"
                  unreadCount={unreadBySource.wix}
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}