import Link from 'next/link'
import * as prismaModule from '@/lib/prisma'
import SourceBadge from '@/components/admin/SourceBadge'
import AdminSchedulerButton from '@/components/admin/AdminSchedulerButton'

export const dynamic = 'force-dynamic'

const prisma = ((prismaModule as any).prisma ?? (prismaModule as any).default) as any

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
  return value || 'Unscheduled'
}

export default async function AdminPage() {
  const todayStart = startOfToday()
  const todayEnd = endOfToday()

  const [jobsToday, workers, quotesWaiting] = await Promise.all([
    prisma.job.findMany({
      where: {
        visitDate: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
      orderBy: [{ visitDate: 'asc' }, { createdAt: 'desc' }],
      take: 20,
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
  ])

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

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.22em] text-zinc-500">
              Daily overview
            </div>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">
              Office control for today
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-zinc-600">
              One dashboard for maintenance visits, landscaping jobs, worker activity
              and office follow-up.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/inbox"
              className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Open inbox
            </Link>
            <Link
              href="/admin/jobs"
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800"
            >
              View jobs
            </Link>
            <AdminSchedulerButton />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Jobs today
          </div>
          <div className="mt-2 text-3xl font-bold">{jobsToday.length}</div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Maintenance today
          </div>
          <div className="mt-2 text-3xl font-bold">{maintenanceToday.length}</div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Landscaping today
          </div>
          <div className="mt-2 text-3xl font-bold">{landscapingToday.length}</div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Quotes waiting
          </div>
          <div className="mt-2 text-3xl font-bold">{quotesWaiting}</div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-12">
        <section className="xl:col-span-7">
          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <div>
                <h3 className="text-base font-bold">Today&apos;s jobs</h3>
                <p className="text-xs text-zinc-500">
                  Mixed view of maintenance and landscaping work
                </p>
              </div>
              <Link href="/admin/jobs" className="text-sm font-semibold text-zinc-700">
                All jobs
              </Link>
            </div>

            <div className="p-3">
              {jobsToday.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">
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
                      <div key={job.id} className="rounded-2xl border border-zinc-200 p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
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

                            <h4 className="mt-3 text-base font-bold text-zinc-900">
                              {job.customer?.name || job.title}
                            </h4>
                            <p className="mt-1 text-sm text-zinc-500">
                              {job.address || 'No address'} • {formatDate(job.visitDate)}
                            </p>

                            <div className="mt-3 grid gap-2 text-sm text-zinc-700 sm:grid-cols-2">
                              <div>
                                <span className="font-semibold">Title:</span> {job.title}
                              </div>
                              <div>
                                <span className="font-semibold">Start:</span>{' '}
                                {job.startTime || formatTime(job.visitDate)}
                              </div>
                              <div className="sm:col-span-2">
                                <span className="font-semibold">Assigned:</span>{' '}
                                {assignedNames.length > 0 ? assignedNames.join(', ') : 'Unassigned'}
                              </div>
                            </div>
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

        <section className="xl:col-span-5 space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <div>
                <h3 className="text-base font-bold">Workers active</h3>
                <p className="text-xs text-zinc-500">
                  Live view from jobs currently in progress
                </p>
              </div>
              <Link href="/admin/workers" className="text-sm font-semibold text-zinc-700">
                Workers
              </Link>
            </div>

            <div className="p-3">
              {activeWorkers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">
                  No workers currently marked active.
                </div>
              ) : (
                <div className="space-y-3">
                  {activeWorkers.map((worker: any) => (
                    <div key={worker.id} className="rounded-2xl border border-zinc-200 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-bold">
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

          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <div>
                <h3 className="text-base font-bold">Inbox sources</h3>
                <p className="text-xs text-zinc-500">
                  Colour-coded so office can scan quickly
                </p>
              </div>
              <Link href="/admin/inbox" className="text-sm font-semibold text-zinc-700">
                Inbox
              </Link>
            </div>

            <div className="p-4">
              <div className="flex flex-wrap gap-2">
                <SourceBadge source="whatsapp" />
                <SourceBadge source="furlads-email" />
                <SourceBadge source="threecounties-email" />
                <SourceBadge source="worker-quote" />
                <SourceBadge source="facebook" />
                <SourceBadge source="wix" />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}