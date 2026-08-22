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
  const isJacob = /^jacob(?:\s|$)/i.test(workerName)
  const jobs = worker.assignedJobs
    .map((assignment) => assignment.job)
    .sort((a, b) => String(a.startTime || '99:99').localeCompare(String(b.startTime || '99:99')))

  const pageClass = isJacob ? 'bg-[#eef2e8] text-[#14200d]' : 'bg-zinc-100 text-zinc-950'
  const heroClass = isJacob
    ? 'bg-gradient-to-br from-[#142611] to-[#29401c] text-white'
    : 'bg-zinc-950 text-white'
  const accentClass = isJacob ? 'text-[#b7d66f]' : 'text-yellow-300'
  const mutedHeroClass = isJacob ? 'text-[#dbe7cb]' : 'text-zinc-300'
  const primaryButtonClass = isJacob
    ? 'bg-[#93b83d] text-[#14200d]'
    : 'bg-white text-zinc-950'
  const cardBorderClass = isJacob ? 'border-[#d7e4bf]' : 'border-zinc-200'
  const labelClass = isJacob ? 'text-[#64812c]' : 'text-zinc-500'
  const readOnlyBadgeClass = isJacob
    ? 'bg-[#eef5e2] text-[#567126]'
    : 'bg-zinc-100 text-zinc-600'
  const emptyClass = isJacob
    ? 'border-[#b9cf89] bg-[#f6f9f1] text-[#486036]'
    : 'border-zinc-300 bg-zinc-50 text-zinc-600'
  const jobCardClass = isJacob
    ? 'border-[#d7e4bf] bg-[#f6f9f1]'
    : 'border-zinc-200 bg-zinc-50'
  const detailRingClass = isJacob ? 'ring-[#d7e4bf]' : 'ring-zinc-200'
  const notesClass = isJacob
    ? 'bg-[#eef5e2] text-[#263817] ring-[#cfe0ab]'
    : 'bg-yellow-50 text-yellow-950 ring-yellow-200'
  const notesLabelClass = isJacob ? 'text-[#64812c]' : 'text-yellow-800'

  return (
    <main className={`min-h-screen ${pageClass}`}>
      <div className="mx-auto max-w-3xl px-3 pb-28 pt-3 sm:px-6 sm:py-6">
        <section className={`rounded-3xl p-5 shadow-lg ${heroClass}`}>
          <div className="flex items-center gap-4">
            <WorkerAvatar name={workerName} size={74} />
            <div className="min-w-0 flex-1">
              <div className={`text-xs font-black uppercase tracking-[0.16em] ${accentClass}`}>Read-only today view</div>
              <h1 className="mt-1 truncate text-3xl font-black">{workerName}</h1>
              <p className={`mt-1 text-sm ${mutedHeroClass}`}>{date} · You can see their day, but nothing here can be changed.</p>
            </div>
            {isJacob ? (
              <img
                src="/branding/three-counties/three-counties-property-care-logo.webp"
                alt="Three Counties Property Care Ltd"
                className="hidden h-20 w-20 rounded-2xl bg-white object-contain p-1.5 shadow-md sm:block"
              />
            ) : null}
          </div>

          <Link href="/trev" className={`mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-2xl px-4 text-sm font-black ${primaryButtonClass}`}>
            Back to your dashboard
          </Link>
        </section>

        <section className={`mt-4 rounded-3xl border bg-white p-4 shadow-sm ${cardBorderClass}`}>
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className={`text-xs font-black uppercase tracking-wide ${labelClass}`}>Today</div>
              <h2 className="mt-1 text-2xl font-black">{jobs.length ? `${jobs.length} ${jobs.length === 1 ? 'job' : 'jobs'}` : 'No jobs assigned'}</h2>
            </div>
            <div className={`rounded-full px-3 py-1.5 text-xs font-black ${readOnlyBadgeClass}`}>READ ONLY</div>
          </div>

          {jobs.length === 0 ? (
            <div className={`mt-4 rounded-2xl border border-dashed p-5 text-sm ${emptyClass}`}>
              Nothing is currently assigned to {worker.firstName || workerName} for today.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {jobs.map((job, index) => {
                const team = job.assignments
                  .map((assignment) => `${assignment.worker.firstName || ''} ${assignment.worker.lastName || ''}`.trim())
                  .filter(Boolean)

                return (
                  <article key={job.id} className={`rounded-2xl border p-4 ${jobCardClass}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className={`text-[11px] font-black uppercase tracking-wide ${labelClass}`}>Job {index + 1} · {displayTime(job.startTime)}</div>
                        <h3 className="mt-1 text-xl font-black leading-tight">{job.title || job.jobType || 'Job'}</h3>
                        <div className="mt-1 text-sm font-semibold text-zinc-700">{job.customer?.name || 'No customer name'}</div>
                      </div>
                      <div className={`rounded-full bg-white px-3 py-1.5 text-xs font-black text-zinc-700 ring-1 ${detailRingClass}`}>{displayStatus(job.status)}</div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className={`rounded-xl bg-white p-3 ring-1 ${detailRingClass}`}>
                        <div className={`text-[10px] font-black uppercase tracking-wide ${labelClass}`}>Location</div>
                        <div className="mt-1 text-sm font-semibold text-zinc-800">{job.customer?.postcode || job.address || job.customer?.address || 'No location saved'}</div>
                      </div>
                      <div className={`rounded-xl bg-white p-3 ring-1 ${detailRingClass}`}>
                        <div className={`text-[10px] font-black uppercase tracking-wide ${labelClass}`}>Working with</div>
                        <div className="mt-1 text-sm font-semibold text-zinc-800">{team.join(', ') || workerName}</div>
                      </div>
                    </div>

                    {job.notes ? (
                      <div className={`mt-3 rounded-xl p-3 text-sm leading-5 ring-1 ${notesClass}`}>
                        <div className={`text-[10px] font-black uppercase tracking-wide ${notesLabelClass}`}>Job notes</div>
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
