import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function formatDate(date: Date | null) {
  if (!date) return 'Not scheduled'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

function formatWorkers(
  assignments: Array<{
    worker: {
      firstName: string
      lastName: string
    }
  }>
) {
  if (!assignments || assignments.length === 0) return 'Unassigned'

  return assignments
    .map((assignment) => `${assignment.worker.firstName} ${assignment.worker.lastName}`)
    .join(', ')
}

export default async function ArchivedJobsPage() {
  const archivedJobs = await prisma.job.findMany({
    where: {
      status: 'archived',
    },
    include: {
      customer: true,
      assignments: {
        include: {
          worker: true,
        },
      },
    },
    orderBy: [{ createdAt: 'desc' }],
  })

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-7xl px-4 py-5 md:px-6 lg:px-8">
        <div className="space-y-5">
          <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
            <div className="bg-zinc-900 px-5 py-5 text-white md:px-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.22em] text-yellow-400">
                    Furlads Jobs
                  </div>
                  <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">
                    Archived Jobs
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm text-zinc-300 md:text-base">
                    Jobs that have been fully archived and removed from the live diary.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/jobs"
                    className="inline-flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700"
                  >
                    Back to Jobs
                  </Link>
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 md:px-5">
              Archived jobs are stored here only and kept out of normal live job views.
            </div>
          </section>

          <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-200 px-4 py-4 md:px-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-zinc-900">Archive</h2>
                  <p className="text-sm text-zinc-500">
                    Historic jobs removed from the normal jobs list.
                  </p>
                </div>

                <div className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-zinc-600">
                  {archivedJobs.length} archived
                </div>
              </div>
            </div>

            {archivedJobs.length === 0 ? (
              <div className="p-5">
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-600">
                  No archived jobs yet.
                </div>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {archivedJobs.map((job) => (
                  <div key={job.id} className="p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="text-lg font-bold text-zinc-900">
                          {job.customer?.name || 'Unknown customer'}
                        </div>
                        <div className="mt-1 text-sm text-zinc-600 whitespace-pre-line">
                          {job.address || 'No address'}
                        </div>

                        <div className="mt-3 grid gap-2 text-sm text-zinc-700 sm:grid-cols-2">
                          <div>
                            <span className="font-semibold">Job ID:</span> #{job.id}
                          </div>
                          <div>
                            <span className="font-semibold">Type:</span> {job.jobType || 'General'}
                          </div>
                          <div>
                            <span className="font-semibold">Original date:</span> {formatDate(job.visitDate)}
                          </div>
                          <div>
                            <span className="font-semibold">Workers:</span> {formatWorkers(job.assignments)}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/jobs/${job.id}`}
                          className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100"
                        >
                          Open
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}