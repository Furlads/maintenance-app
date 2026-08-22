import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import WorkerAvatar from '@/components/WorkerAvatar'

export const dynamic = 'force-dynamic'

type Props = {
  params: { workerId: string }
}

function dayRange() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const date = formatter.format(new Date())
  const [year, month, day] = date.split('-').map(Number)
  return {
    date,
    start: new Date(year, month - 1, day, 0, 0, 0, 0),
    end: new Date(year, month - 1, day, 23, 59, 59, 999),
  }
}

function displayTime(value: string | null | undefined) {
  return value?.slice(0, 5) || 'Running order'
}

function displayStatus(value: string | null | undefined) {
  const status = String(value || '').trim().toLowerCase()
  if (['done', 'complete', 'completed'].includes(status)) return 'Completed'
  if (status === 'cancelled') return 'Cancelled'
  if (status === 'in_progress') return 'In progress'
  return 'Planned'
}

export default async function WorkerReadOnlyTodayPage({ params }: Props) {
  const session = await getSession()
  if (!session?.workerId) redirect('/login')

  const workerId = Number(params.workerId)
  if (!Number.isInteger(workerId) || workerId <= 0) notFound()

  const { date, start, end } = dayRange()

  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      active: true,
      assignedJobs: {
        where: {
          job: {
            visitDate: { gte: start, lte: end },
            status: { not: 'cancelled' },
          },
        },
        include: {
          job: {
            include: {
              customer: true,
              assignments: {
                include: {
                  worker: {
                    select: { id: true, firstName: true, lastName: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  if (!worker) notFound()

  const workerName = `${worker.firstName || ''} ${worker.lastName || ''}`.trim() || `Worker #${worker.id}`
  const jobs = worker.assignedJobs
    .map((assignment) => assignment.job)
    .sort((a, b) => String(a.startTime || '99:99').localeCompare(String(b.startTime || '99:99')))

  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-950">
      <div className="mx-auto max-w-3xl px-3 pb-28 pt-3 sm:px-6 sm:py-6">
        <section className="rounded-3xl bg-zinc-950 p-5 text-white shadow-lg">
          <div className="flex items-center gap-4">
            <WorkerAvatar name={workerName} size={74} />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-yellow-300">Read-only today view</div>
              <h1 className="mt-1 truncate text-3xl font-black">{workerName}</h1>
              <p className="mt-1 text-sm text-zinc-300">{date} · You can see their day, but nothing here can be changed.</p>
            </div>
          </div>

          <Link href="/trev" className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-white px-4 text-sm font-black text-zinc-950">
            Back to your dashboard
          </Link>
        </section>

        <section className="mt-4 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase tracking-wide text-zinc-500">Today</div>
              <h2 className="mt-1 text-2xl font-black">{jobs.length ? `${jobs.length} ${jobs.length === 1 ? 'job' : 'jobs'}` : 'No jobs assigned'}</h2>
            </div>
            <div className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-black text-zinc-600">READ ONLY</div>
          </div>

          {jobs.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-sm text-zinc-600">
              Nothing is currently assigned to {worker.firstName || workerName} for today.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {jobs.map((job, index) => {
                const team = job.assignments
                  .map((assignment) => `${assignment.worker.firstName || ''} ${assignment.worker.lastName || ''}`.trim())
                  .filter(Boolean)

                return (
                  <article key={job.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-black uppercase tracking-wide text-zinc-500">Job {index + 1} · {displayTime(job.startTime)}</div>
                        <h3 className="mt-1 text-xl font-black leading-tight">{job.title || job.jobType || 'Job'}</h3>
                        <div className="mt-1 text-sm font-semibold text-zinc-700">{job.customer?.name || 'No customer name'}</div>
                      </div>
                      <div className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-zinc-700 ring-1 ring-zinc-200">{displayStatus(job.status)}</div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-xl bg-white p-3 ring-1 ring-zinc-200">
                        <div className="text-[10px] font-black uppercase tracking-wide text-zinc-500">Location</div>
                        <div className="mt-1 text-sm font-semibold text-zinc-800">{job.customer?.postcode || job.address || job.customer?.address || 'No location saved'}</div>
                      </div>
                      <div className="rounded-xl bg-white p-3 ring-1 ring-zinc-200">
                        <div className="text-[10px] font-black uppercase tracking-wide text-zinc-500">Working with</div>
                        <div className="mt-1 text-sm font-semibold text-zinc-800">{team.join(', ') || workerName}</div>
                      </div>
                    </div>

                    {job.notes ? (
                      <div className="mt-3 rounded-xl bg-yellow-50 p-3 text-sm leading-5 text-yellow-950 ring-1 ring-yellow-200">
                        <div className="text-[10px] font-black uppercase tracking-wide text-yellow-800">Job notes</div>
                        <div className="mt-1 whitespace-pre-wrap">{job.notes}</div>
                      </div>
                    ) : null}
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
