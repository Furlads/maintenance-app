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

function startOfTomorrow() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0)
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
    return { label: 'Maintenance', className: 'bg-green-50 text-green-700 ring-green-200' }
  }
  if (raw.includes('land')) {
    return { label: 'Landscaping', className: 'bg-blue-50 text-blue-700 ring-blue-200' }
  }
  if (raw.includes('quote')) {
    return { label: 'Quote', className: 'bg-amber-50 text-amber-700 ring-amber-200' }
  }

  return { label: value || 'Other', className: 'bg-zinc-100 text-zinc-700 ring-zinc-200' }
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
    if (!grouped.has(key)) grouped.set(key, [])
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
    const latest = [...items].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0]

    if (statusIsUnread(latest.status)) counts[normaliseSource(latest.source)] += 1
  }

  return counts
}

function DashboardSourceLink({ source, unreadCount }: { source: DashboardInboxSource; unreadCount: number }) {
  return (
    <Link
      href={`/admin/inbox?source=${encodeURIComponent(source)}`}
      className="inline-flex min-h-10 items-center gap-2 rounded-full transition hover:scale-[1.01]"
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
  tone?: 'default' | 'green' | 'blue' | 'amber' | 'red'
}) {
  const toneClasses =
    tone === 'green'
      ? 'border-green-200 bg-green-50'
      : tone === 'blue'
        ? 'border-blue-200 bg-blue-50'
        : tone === 'amber'
          ? 'border-amber-200 bg-amber-50'
          : tone === 'red'
            ? 'border-red-200 bg-red-50'
            : 'border-zinc-200 bg-white'

  return (
    <div className={`rounded-xl border p-3 shadow-sm sm:rounded-2xl sm:p-4 ${toneClasses}`}>
      <div className="text-[10px] font-black uppercase tracking-[0.13em] text-zinc-500 sm:text-[11px] sm:tracking-[0.16em]">{label}</div>
      <div className="mt-1.5 text-2xl font-black tracking-tight text-zinc-900 sm:mt-2 sm:text-3xl">{value}</div>
    </div>
  )
}

export default async function AdminPage() {
  const todayStart = startOfToday()
  const todayEnd = endOfToday()
  const tomorrowStart = startOfTomorrow()

  const [jobsTodayRaw, workers, quotesWaiting, inboxMessages, overdueCount, unscheduledCount] =
    await Promise.all([
      prisma.job.findMany({
        where: {
          visitDate: { gte: todayStart, lte: todayEnd },
          status: { notIn: ['cancelled', 'archived'] },
        },
        orderBy: [{ visitDate: 'asc' }, { startTime: 'asc' }, { createdAt: 'asc' }],
        take: 50,
        include: {
          customer: true,
          assignments: { include: { worker: true } },
        },
      }),
      prisma.worker.findMany({
        where: { active: true },
        orderBy: { firstName: 'asc' },
        take: 30,
      }),
      prisma.quote.count({
        where: {
          status: { in: ['needs_review', 'ready_to_send'] },
          archivedAt: null,
        },
      }),
      prisma.inboxMessage.findMany({
        orderBy: { createdAt: 'desc' },
        take: 300,
        include: { conversation: true },
        where: {
          OR: [{ conversation: { archived: false } }, { conversation: null }],
        },
      }) as Promise<InboxMessageRow[]>,
      prisma.job.count({
        where: {
          visitDate: { lt: todayStart },
          status: { notIn: ['done', 'completed', 'cancelled', 'archived'] },
        },
      }),
      prisma.job.count({
        where: {
          OR: [{ visitDate: null }, { status: 'unscheduled' }],
          status: { notIn: ['cancelled', 'archived'] },
        },
      }),
    ])

  const jobsToday = [...jobsTodayRaw].sort((a: any, b: any) => {
    const aTime = String(a.startTime || '99:99')
    const bTime = String(b.startTime || '99:99')
    if (aTime !== bTime) return aTime.localeCompare(bTime)
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })

  const maintenanceToday = jobsToday.filter((job: any) =>
    String(job.jobType || '').toLowerCase().includes('maint')
  )
  const landscapingToday = jobsToday.filter((job: any) =>
    String(job.jobType || '').toLowerCase().includes('land')
  )
  const quotesToday = jobsToday.filter((job: any) =>
    String(job.jobType || '').toLowerCase().includes('quote')
  )

  const todayWorkerJobCounts = new Map<number, number>()
  for (const job of jobsToday) {
    for (const assignment of job.assignments || []) {
      const workerId = assignment.worker?.id
      if (!workerId) continue
      todayWorkerJobCounts.set(workerId, (todayWorkerJobCounts.get(workerId) || 0) + 1)
    }
  }

  const todaysTeam = workers.filter((worker: any) => todayWorkerJobCounts.has(worker.id))
  const unreadBySource = buildUnreadCountsBySource(inboxMessages)

  const tomorrowJobsCount = await prisma.job.count({
    where: {
      visitDate: { gte: tomorrowStart },
      status: { notIn: ['cancelled', 'archived'] },
    },
  })

  return (
    <div className="space-y-3 sm:space-y-4">
      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500 sm:text-xs sm:tracking-[0.22em]">Daily overview</div>
            <h2 className="mt-1.5 text-2xl font-black tracking-tight text-zinc-950 sm:text-3xl">Office control for today</h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-5 text-zinc-600 sm:leading-6">
              Today&apos;s jobs, inbox pressure, quote follow-up and the main schedule in one place.
            </p>
          </div>

          <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 lg:w-auto">
            <Link href="/admin/inbox" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-center text-sm font-bold text-zinc-900 transition hover:bg-zinc-50">
              Open inbox
            </Link>
            <Link href="/admin/schedule" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-900 px-3 py-2.5 text-center text-sm font-bold text-yellow-300 transition hover:bg-black">
              Open schedule
            </Link>
            <Link href="/kelly/time-off" className="col-span-2 inline-flex min-h-11 items-center justify-center rounded-xl bg-yellow-300 px-3 py-2.5 text-center text-sm font-black text-zinc-950 transition hover:bg-yellow-400 sm:col-span-1">
              Time Off / Holidays
            </Link>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-6">
        <StatCard label="Jobs today" value={jobsToday.length} />
        <StatCard label="Maintenance" value={maintenanceToday.length} tone="green" />
        <StatCard label="Landscaping" value={landscapingToday.length} tone="blue" />
        <StatCard label="Quotes" value={quotesToday.length} tone="amber" />
        <StatCard label="Overdue" value={overdueCount} tone="red" />
        <StatCard label="Unscheduled" value={unscheduledCount} tone="amber" />
      </section>

      <div className="grid gap-3 sm:gap-4 xl:grid-cols-12">
        <section className="xl:col-span-7">
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-3.5 py-3.5 sm:px-4 sm:py-4">
              <div>
                <h3 className="text-base font-black text-zinc-900">Today&apos;s jobs</h3>
                <p className="mt-0.5 text-xs leading-5 text-zinc-500">First job at the top, then the rest of the day.</p>
              </div>
              <Link href="/jobs" className="shrink-0 rounded-lg bg-zinc-100 px-2.5 py-2 text-xs font-bold text-zinc-800">All jobs</Link>
            </div>

            <div className="p-3 sm:p-4">
              {jobsToday.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">
                  No jobs scheduled for today.
                </div>
              ) : (
                <div className="space-y-2.5 sm:space-y-3">
                  {jobsToday.map((job: any) => {
                    const jobType = normaliseJobType(job.jobType)
                    const assignedNames = (job.assignments || []).map((assignment: any) =>
                      fullName(assignment.worker?.firstName, assignment.worker?.lastName)
                    )

                    return (
                      <div key={job.id} className="rounded-xl border border-zinc-200 bg-white p-3 sm:rounded-2xl sm:p-4">
                        <div className="flex flex-col gap-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ring-inset ${jobType.className}`}>{jobType.label}</span>
                                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-200">{normaliseStatus(job.status)}</span>
                              </div>
                              <h4 className="mt-2.5 truncate text-base font-black leading-tight text-zinc-900 sm:text-lg">{job.customer?.name || 'Unknown customer'}</h4>
                              <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500 sm:text-sm sm:leading-6">{job.address || 'No address'} • {formatDate(job.visitDate)}</p>
                            </div>
                            <div className="shrink-0 rounded-lg bg-zinc-100 px-2.5 py-1.5 text-xs font-black text-zinc-700 ring-1 ring-inset ring-zinc-200 sm:rounded-full sm:text-sm">
                              {job.startTime || formatTime(job.visitDate)}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 rounded-xl bg-zinc-50 p-2.5 text-xs text-zinc-700 sm:p-3 sm:text-sm">
                            <div><span className="font-semibold">Start:</span> {job.startTime || 'TBC'}</div>
                            <div><span className="font-semibold">Job:</span> #{job.id}</div>
                            <div className="col-span-2 truncate"><span className="font-semibold">Assigned:</span> {assignedNames.length > 0 ? assignedNames.join(', ') : 'Unassigned'}</div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            <Link href={`/jobs/${job.id}`} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-bold text-zinc-800 transition hover:bg-zinc-100 sm:min-h-11 sm:rounded-xl sm:text-sm">Open</Link>
                            <Link href={`/jobs/edit/${job.id}`} className="inline-flex min-h-10 items-center justify-center rounded-lg bg-zinc-900 px-3 py-2 text-xs font-black text-yellow-300 transition hover:bg-black sm:min-h-11 sm:rounded-xl sm:text-sm">Edit</Link>
                            <Link href={`/jobs/edit/${job.id}`} className="col-span-2 inline-flex min-h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-center text-xs font-bold text-zinc-800 transition hover:bg-zinc-100 sm:col-span-1 sm:min-h-11 sm:rounded-xl sm:text-sm">Reschedule</Link>
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

        <section className="space-y-3 sm:space-y-4 xl:col-span-5">
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-3.5 py-3.5 sm:px-4 sm:py-4">
              <div>
                <h3 className="text-base font-black text-zinc-900">Today&apos;s team</h3>
                <p className="mt-0.5 text-xs text-zinc-500">Everyone assigned to at least one job today</p>
              </div>
              <Link href="/workers" className="shrink-0 rounded-lg bg-zinc-100 px-2.5 py-2 text-xs font-bold text-zinc-800">Workers</Link>
            </div>

            <div className="p-3 sm:p-4">
              {todaysTeam.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">No workers are assigned to today&apos;s jobs yet.</div>
              ) : (
                <div className="space-y-2">
                  {todaysTeam.map((worker: any) => {
                    const jobCount = todayWorkerJobCounts.get(worker.id) || 0
                    return (
                      <div key={worker.id} className="rounded-xl border border-zinc-200 p-3 sm:rounded-2xl sm:p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-black text-zinc-900">{fullName(worker.firstName, worker.lastName)}</div>
                            <div className="mt-0.5 truncate text-xs text-zinc-500">{worker.jobTitle || 'Worker'}</div>
                          </div>
                          <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-200">{jobCount} job{jobCount === 1 ? '' : 's'}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-200 px-3.5 py-3.5 sm:px-4 sm:py-4">
              <h3 className="text-base font-black text-zinc-900">Quick actions</h3>
              <p className="mt-0.5 text-xs text-zinc-500">Office tools kept close without cluttering the top.</p>
            </div>

            <div className="grid grid-cols-2 gap-2 p-3 sm:gap-3 sm:p-4">
              <Link href="/kelly/notes-summary" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-center text-xs font-black text-amber-800 transition hover:bg-amber-100 sm:text-sm">Notes summary</Link>
              <Link href="/jobs" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-center text-xs font-bold text-zinc-800 transition hover:bg-zinc-100 sm:text-sm">All jobs</Link>
              <Link href="/admin/inbox?source=worker-quote" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-center text-xs font-bold text-zinc-800 transition hover:bg-zinc-100 sm:text-sm">Worker quotes</Link>
              <Link href="/admin/todos" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-center text-xs font-bold text-zinc-800 transition hover:bg-zinc-100 sm:text-sm">To-Do List</Link>
              <Link href="/admin/activity" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-center text-xs font-bold text-zinc-800 transition hover:bg-zinc-100 sm:text-sm">Activity log</Link>
              <div className="flex min-w-0 [&>button]:w-full"><AdminSchedulerButton /></div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-3.5 py-3.5 sm:px-4 sm:py-4">
              <div>
                <h3 className="text-base font-black text-zinc-900">Inbox sources</h3>
                <p className="mt-0.5 text-xs text-zinc-500">Unread threads by channel</p>
              </div>
              <Link href="/admin/inbox" className="shrink-0 rounded-lg bg-zinc-100 px-2.5 py-2 text-xs font-bold text-zinc-800">Inbox</Link>
            </div>

            <div className="p-3 sm:p-4">
              <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                <DashboardSourceLink source="whatsapp" unreadCount={unreadBySource.whatsapp} />
                <DashboardSourceLink source="furlads-email" unreadCount={unreadBySource['furlads-email']} />
                <DashboardSourceLink source="threecounties-email" unreadCount={unreadBySource['threecounties-email']} />
                <DashboardSourceLink source="worker-quote" unreadCount={unreadBySource['worker-quote']} />
                <DashboardSourceLink source="facebook" unreadCount={unreadBySource.facebook} />
                <DashboardSourceLink source="wix" unreadCount={unreadBySource.wix} />
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-200 px-3.5 py-3.5 sm:px-4 sm:py-4">
              <h3 className="text-base font-black text-zinc-900">Forward view</h3>
              <p className="mt-0.5 text-xs text-zinc-500">Quick pressure check beyond today</p>
            </div>

            <div className="grid grid-cols-2 gap-2 p-3 sm:gap-3 sm:p-4">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 sm:rounded-2xl sm:p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.13em] text-zinc-500 sm:text-[11px]">Tomorrow onwards</div>
                <div className="mt-1.5 text-2xl font-black tracking-tight text-zinc-900 sm:mt-2 sm:text-3xl">{tomorrowJobsCount}</div>
              </div>
              <Link href="/admin/quotes?status=needs_review" className="rounded-xl border border-amber-200 bg-amber-50 p-3 transition hover:bg-amber-100 sm:rounded-2xl sm:p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.13em] text-amber-700 sm:text-[11px]">Quotes waiting</div>
                <div className="mt-1.5 text-2xl font-black tracking-tight text-zinc-900 sm:mt-2 sm:text-3xl">{quotesWaiting}</div>
                <div className="mt-1 text-[10px] font-semibold leading-4 text-amber-800 sm:text-xs">Needs review / ready</div>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
