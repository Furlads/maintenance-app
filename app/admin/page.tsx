import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type WorkerCard = {
  id: number
  firstName: string
  lastName: string
  jobTitle: string | null
  accessLevel: string | null
  active: boolean
}

type DashboardJob = {
  id: number
  title: string
  address: string
  status: string
  visitDate: Date | null
  customer: {
    id: number
    name: string
    phone: string | null
    postcode: string | null
  } | null
  assignments: Array<{
    id: number
    worker: {
      id: number
      firstName: string
      lastName: string
    }
  }>
}

type QuoteRequestCard = {
  id: string | number
  customerName: string
  phone: string
  address: string
  postcode: string
  jobDescription: string
  estimatedTime: string
  notes: string
  imageUrl: string
  workerName: string
  createdAt: Date | string | null
}

function startOfToday() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
}

function endOfToday() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
}

function fmtDateTime(value: Date | string | null | undefined) {
  if (!value) return '—'

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function fmtDate(value: Date | null | undefined) {
  if (!value) return '—'

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function fullName(firstName?: string | null, lastName?: string | null) {
  return `${firstName ?? ''} ${lastName ?? ''}`.trim() || 'Unknown worker'
}

function statusClasses(status: string) {
  const s = String(status || '').toLowerCase()

  if (s === 'done') return 'bg-green-50 text-green-700 ring-green-200'
  if (s === 'in_progress') return 'bg-blue-50 text-blue-700 ring-blue-200'
  if (s === 'scheduled') return 'bg-amber-50 text-amber-700 ring-amber-200'
  if (s === 'unscheduled') return 'bg-zinc-100 text-zinc-700 ring-zinc-200'

  return 'bg-zinc-100 text-zinc-700 ring-zinc-200'
}

async function getQuoteRequestsSafe(): Promise<QuoteRequestCard[]> {
  const prismaAny = prisma as any

  try {
    if (!prismaAny.quoteRequest?.findMany) return []

    const rows = await prismaAny.quoteRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: {
        worker: true,
      },
    })

    return (Array.isArray(rows) ? rows : []).map((row: any) => ({
      id: row.id,
      customerName: row.customerName ?? row.name ?? 'No customer name',
      phone: row.phone ?? '',
      address: row.address ?? '',
      postcode: row.postcode ?? '',
      jobDescription: row.jobDescription ?? row.description ?? '',
      estimatedTime:
        row.estimatedTime ??
        row.estimatedDuration ??
        row.timeEstimate ??
        '',
      notes: row.notes ?? '',
      imageUrl: row.imageUrl ?? row.image ?? row.photoUrl ?? '',
      workerName:
        row.worker
          ? fullName(row.worker.firstName, row.worker.lastName)
          : row.workerName ?? row.submittedBy ?? '',
      createdAt: row.createdAt ?? null,
    }))
  } catch {
    return []
  }
}

export default async function AdminDashboardPage() {
  const todayStart = startOfToday()
  const todayEnd = endOfToday()

  const [jobsToday, workers, quoteRequests] = await Promise.all([
    prisma.job.findMany({
      where: {
        visitDate: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
      orderBy: [{ visitDate: 'asc' }, { createdAt: 'desc' }],
      take: 12,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            postcode: true,
          },
        },
        assignments: {
          include: {
            worker: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    }) as Promise<DashboardJob[]>,
    prisma.worker.findMany({
      where: {
        active: true,
      },
      orderBy: {
        firstName: 'asc',
      },
      take: 24,
    }) as Promise<WorkerCard[]>,
    getQuoteRequestsSafe(),
  ])

  const activeWorkerIds = new Set<number>()
  for (const job of jobsToday) {
    if (String(job.status).toLowerCase() === 'in_progress') {
      for (const assignment of job.assignments) {
        activeWorkerIds.add(assignment.worker.id)
      }
    }
  }

  const workersActiveToday = workers.filter((worker) =>
    activeWorkerIds.has(worker.id)
  )

  const workersWithJobsToday = workers
    .map((worker) => {
      const assignedJobs = jobsToday.filter((job) =>
        job.assignments.some((assignment) => assignment.worker.id === worker.id)
      )

      return {
        ...worker,
        assignedJobs,
      }
    })
    .filter((worker) => worker.assignedJobs.length > 0)

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Furlads Admin
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Quotes, today&apos;s jobs, active workers and quick business view.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/quotes"
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
            >
              Quotes
            </Link>
            <Link
              href="/admin/jobs"
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
            >
              Jobs
            </Link>
            <Link
              href="/admin/customers"
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
            >
              Customers
            </Link>
            <Link
              href="/admin/workers"
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
            >
              Workers
            </Link>
          </div>
        </div>

        <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Jobs today
            </div>
            <div className="mt-2 text-3xl font-bold">{jobsToday.length}</div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Quotes waiting
            </div>
            <div className="mt-2 text-3xl font-bold">{quoteRequests.length}</div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Workers active
            </div>
            <div className="mt-2 text-3xl font-bold">
              {workersActiveToday.length}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Active workers total
            </div>
            <div className="mt-2 text-3xl font-bold">{workers.length}</div>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-12">
          <section className="lg:col-span-6">
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
                <div>
                  <h2 className="text-base font-bold">Quote requests</h2>
                  <p className="text-xs text-zinc-500">
                    Latest requests sent in from workers
                  </p>
                </div>
                <Link
                  href="/admin/quotes"
                  className="text-sm font-semibold text-zinc-700 hover:text-zinc-900"
                >
                  View all
                </Link>
              </div>

              <div className="p-3">
                {quoteRequests.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">
                    No quote requests found yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {quoteRequests.map((quote) => (
                      <div
                        key={String(quote.id)}
                        className="rounded-xl border border-zinc-200 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-bold">
                              {quote.customerName || 'Unnamed customer'}
                            </div>
                            <div className="mt-1 text-xs text-zinc-500">
                              {fmtDateTime(quote.createdAt)}
                            </div>
                          </div>

                          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                            Waiting
                          </span>
                        </div>

                        <div className="mt-3 grid gap-2 text-sm text-zinc-700 sm:grid-cols-2">
                          <div>
                            <span className="font-semibold">Phone:</span>{' '}
                            {quote.phone || '—'}
                          </div>
                          <div>
                            <span className="font-semibold">Worker:</span>{' '}
                            {quote.workerName || '—'}
                          </div>
                          <div className="sm:col-span-2">
                            <span className="font-semibold">Address:</span>{' '}
                            {quote.address || '—'}
                            {quote.postcode ? `, ${quote.postcode}` : ''}
                          </div>
                          <div className="sm:col-span-2">
                            <span className="font-semibold">Job:</span>{' '}
                            {quote.jobDescription || '—'}
                          </div>
                          <div>
                            <span className="font-semibold">Estimated time:</span>{' '}
                            {quote.estimatedTime || '—'}
                          </div>
                          <div>
                            <span className="font-semibold">Image:</span>{' '}
                            {quote.imageUrl ? 'Attached' : 'None'}
                          </div>
                          {quote.notes ? (
                            <div className="sm:col-span-2">
                              <span className="font-semibold">Notes:</span>{' '}
                              {quote.notes}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="lg:col-span-6">
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
                <div>
                  <h2 className="text-base font-bold">Today&apos;s jobs</h2>
                  <p className="text-xs text-zinc-500">
                    Jobs scheduled for today
                  </p>
                </div>
                <Link
                  href="/admin/jobs"
                  className="text-sm font-semibold text-zinc-700 hover:text-zinc-900"
                >
                  View all
                </Link>
              </div>

              <div className="p-3">
                {jobsToday.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">
                    No jobs booked for today.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {jobsToday.map((job) => {
                      const assignedNames = job.assignments.map((assignment) =>
                        fullName(
                          assignment.worker.firstName,
                          assignment.worker.lastName
                        )
                      )

                      return (
                        <div
                          key={job.id}
                          className="rounded-xl border border-zinc-200 p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-bold">
                                {job.customer?.name || job.title}
                              </div>
                              <div className="mt-1 text-xs text-zinc-500">
                                {fmtDate(job.visitDate)}
                              </div>
                            </div>

                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${statusClasses(
                                job.status
                              )}`}
                            >
                              {job.status || '—'}
                            </span>
                          </div>

                          <div className="mt-3 grid gap-2 text-sm text-zinc-700">
                            <div>
                              <span className="font-semibold">Address:</span>{' '}
                              {job.address || '—'}
                              {job.customer?.postcode
                                ? `, ${job.customer.postcode}`
                                : ''}
                            </div>
                            <div>
                              <span className="font-semibold">Phone:</span>{' '}
                              {job.customer?.phone || '—'}
                            </div>
                            <div>
                              <span className="font-semibold">Assigned:</span>{' '}
                              {assignedNames.length > 0
                                ? assignedNames.join(', ')
                                : 'Unassigned'}
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

          <section className="lg:col-span-5">
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
                <div>
                  <h2 className="text-base font-bold">Workers currently active</h2>
                  <p className="text-xs text-zinc-500">
                    Based on today&apos;s jobs marked in progress
                  </p>
                </div>
                <Link
                  href="/admin/workers"
                  className="text-sm font-semibold text-zinc-700 hover:text-zinc-900"
                >
                  View all
                </Link>
              </div>

              <div className="p-3">
                {workersActiveToday.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">
                    No workers currently marked active.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {workersActiveToday.map((worker) => {
                      const jobCount = jobsToday.filter((job) =>
                        job.assignments.some(
                          (assignment) => assignment.worker.id === worker.id
                        )
                      ).length

                      return (
                        <div
                          key={worker.id}
                          className="rounded-xl border border-zinc-200 p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-bold">
                                {fullName(worker.firstName, worker.lastName)}
                              </div>
                              <div className="mt-1 text-xs text-zinc-500">
                                {worker.jobTitle || worker.accessLevel || 'Worker'}
                              </div>
                            </div>

                            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-200">
                              Active
                            </span>
                          </div>

                          <div className="mt-3 text-sm text-zinc-700">
                            <span className="font-semibold">Jobs today:</span>{' '}
                            {jobCount}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="lg:col-span-7">
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
                <div>
                  <h2 className="text-base font-bold">Worker overview</h2>
                  <p className="text-xs text-zinc-500">
                    Active workers and their assigned jobs today
                  </p>
                </div>
                <Link
                  href="/admin/workers"
                  className="text-sm font-semibold text-zinc-700 hover:text-zinc-900"
                >
                  Manage workers
                </Link>
              </div>

              <div className="p-3">
                {workersWithJobsToday.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">
                    No worker assignments for today yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {workersWithJobsToday.map((worker) => (
                      <div
                        key={worker.id}
                        className="rounded-xl border border-zinc-200 p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-bold">
                              {fullName(worker.firstName, worker.lastName)}
                            </div>
                            <div className="mt-1 text-xs text-zinc-500">
                              {worker.jobTitle || worker.accessLevel || 'Worker'}
                            </div>
                          </div>

                          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-200">
                            {worker.assignedJobs.length} job
                            {worker.assignedJobs.length === 1 ? '' : 's'}
                          </span>
                        </div>

                        <div className="mt-3 space-y-2">
                          {worker.assignedJobs.map((job) => (
                            <div
                              key={job.id}
                              className="rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-700"
                            >
                              <div className="font-semibold">
                                {job.customer?.name || job.title}
                              </div>
                              <div className="text-xs text-zinc-500">
                                {job.address || 'No address'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}