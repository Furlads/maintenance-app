import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams?: {
    workerId?: string
    date?: string
  }
}

function dayBounds(value?: string) {
  const parsed = value ? new Date(`${value}T12:00:00`) : new Date()
  const base = Number.isNaN(parsed.getTime()) ? new Date() : parsed
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0, 0)
  const end = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 23, 59, 59, 999)
  return { start, end, key: start.toISOString().slice(0, 10) }
}

function name(firstName?: string | null, lastName?: string | null) {
  return `${firstName || ''} ${lastName || ''}`.trim() || 'Worker'
}

function prettyDate(value: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(value)
}

function time(value?: string | null) {
  return value?.trim() || 'Time not set'
}

function statusLabel(value?: string | null) {
  return String(value || 'scheduled').replaceAll('_', ' ').replace(/\b\w/g, (m) => m.toUpperCase())
}

export default async function AdminWorkerViewPage({ searchParams }: PageProps) {
  const workers = await prisma.worker.findMany({
    where: { active: true },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    select: { id: true, firstName: true, lastName: true, jobTitle: true },
  })

  const requestedId = Number(searchParams?.workerId)
  const selected = workers.find((worker) => worker.id === requestedId) || workers[0] || null
  const { start, end, key } = dayBounds(searchParams?.date)

  const jobs = selected
    ? await prisma.job.findMany({
        where: {
          visitDate: { gte: start, lte: end },
          status: { notIn: ['cancelled', 'archived'] },
          assignments: { some: { workerId: selected.id } },
        },
        orderBy: [{ startTime: 'asc' }, { createdAt: 'asc' }],
        include: {
          customer: true,
          assignments: { include: { worker: true } },
        },
      })
    : []

  const previous = new Date(start)
  previous.setDate(previous.getDate() - 1)
  const next = new Date(start)
  next.setDate(next.getDate() + 1)

  return (
    <div className="space-y-3 text-slate-950 sm:space-y-4">
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.17em] text-zinc-500 sm:text-xs">Read-only worker screens</div>
            <h1 className="mt-1.5 text-2xl font-black leading-tight text-slate-950 sm:text-3xl">See exactly what each worker has on</h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-5 text-zinc-600 sm:leading-6">Office view only. Inspect jobs, timings, customer details and notes without changing the worker's live screen.</p>
          </div>
          <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1.5 text-[10px] font-black text-emerald-900 ring-1 ring-inset ring-emerald-300 sm:px-3 sm:py-2 sm:text-xs">READ ONLY</span>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-600 sm:text-xs">Choose worker</div>
        <div className="mt-2.5 flex gap-2 overflow-x-auto pb-0.5">
          {workers.map((worker) => {
            const active = worker.id === selected?.id
            return (
              <Link
                key={worker.id}
                href={`/admin/worker-view?workerId=${worker.id}&date=${key}`}
                className={`shrink-0 rounded-xl px-3 py-2.5 text-xs font-black ring-1 ring-inset sm:px-4 sm:py-3 sm:text-sm ${active ? 'bg-yellow-300 text-slate-950 ring-yellow-400' : 'bg-zinc-900 text-yellow-300 ring-zinc-900'}`}
              >
                {name(worker.firstName, worker.lastName)}
              </Link>
            )
          })}
        </div>
      </section>

      {selected ? (
        <>
          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-500 sm:text-xs">Worker screen</div>
                <h2 className="mt-1 truncate text-2xl font-black text-slate-950 sm:text-3xl">{name(selected.firstName, selected.lastName)}</h2>
                {selected.jobTitle ? <div className="mt-0.5 truncate text-xs font-bold text-zinc-600 sm:text-sm">{selected.jobTitle}</div> : null}
              </div>
              <div className="shrink-0 rounded-xl bg-zinc-50 px-3 py-2 text-right ring-1 ring-inset ring-zinc-200">
                <div className="text-[9px] font-black uppercase tracking-wide text-zinc-500 sm:text-[10px]">Jobs</div>
                <div className="text-2xl font-black text-slate-950">{jobs.length}</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-[auto_1fr_auto] items-center gap-2">
              <Link href={`/admin/worker-view?workerId=${selected.id}&date=${previous.toISOString().slice(0, 10)}`} className="inline-flex min-h-10 items-center justify-center rounded-lg bg-zinc-900 px-3 text-[11px] font-black text-yellow-300 sm:min-h-11 sm:rounded-xl sm:text-xs">← Prev</Link>
              <div className="min-w-0 truncate text-center text-xs font-black text-slate-950 sm:text-sm">{prettyDate(start)}</div>
              <Link href={`/admin/worker-view?workerId=${selected.id}&date=${next.toISOString().slice(0, 10)}`} className="inline-flex min-h-10 items-center justify-center rounded-lg bg-zinc-900 px-3 text-[11px] font-black text-yellow-300 sm:min-h-11 sm:rounded-xl sm:text-xs">Next →</Link>
            </div>
          </section>

          <section className="space-y-2.5 sm:space-y-3">
            {jobs.length ? jobs.map((job) => {
              const team = (job.assignments || []).map((assignment) => name(assignment.worker?.firstName, assignment.worker?.lastName)).filter(Boolean)
              return (
                <article key={job.id} className="rounded-2xl border border-zinc-200 bg-white p-3.5 shadow-sm sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-yellow-100 px-2.5 py-1 text-[10px] font-black uppercase text-yellow-900 ring-1 ring-inset ring-yellow-300">{job.jobType || 'Job'}</span>
                        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-black uppercase text-zinc-700 ring-1 ring-inset ring-zinc-200">{statusLabel(job.status)}</span>
                      </div>
                      <h3 className="mt-2.5 truncate text-lg font-black text-slate-950 sm:text-xl">{job.customer?.name || job.title || `Job #${job.id}`}</h3>
                      {job.title && job.customer?.name && job.title.toLowerCase() !== job.customer.name.toLowerCase() ? <div className="mt-0.5 line-clamp-2 text-xs font-bold text-zinc-700 sm:text-sm">{job.title}</div> : null}
                    </div>
                    <div className="shrink-0 rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs font-black text-yellow-300 sm:rounded-xl sm:px-3 sm:py-2 sm:text-sm">{time(job.startTime)}</div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:grid-cols-2 sm:gap-3">
                    <Info label="Address" value={[job.address || job.customer?.address, job.customer?.postcode].filter(Boolean).join(', ') || 'No address saved'} />
                    <Info label="Team" value={team.length ? team.join(' + ') : name(selected.firstName, selected.lastName)} />
                    <Info label="Phone" value={job.customer?.phone || 'No phone saved'} />
                    <Info label="Duration" value={job.durationMinutes ? `${job.durationMinutes} minutes` : 'Not set'} />
                  </div>

                  {job.notes ? <div className="mt-3 rounded-xl bg-zinc-50 p-3 ring-1 ring-inset ring-zinc-200 sm:mt-4 sm:rounded-2xl sm:p-4"><div className="text-[10px] font-black uppercase tracking-wide text-zinc-600">Job notes</div><div className="mt-1.5 whitespace-pre-wrap text-sm leading-5 text-zinc-800 sm:leading-6">{job.notes}</div></div> : null}

                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-zinc-200 pt-3 sm:mt-4 sm:pt-4">
                    <div className="min-w-0 truncate text-[11px] font-bold text-zinc-500 sm:text-xs">Job #{job.id} · read-only</div>
                    <Link href={`/jobs/${job.id}`} className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-yellow-300 px-3 text-[11px] font-black text-slate-950 sm:rounded-xl sm:text-xs">Open job</Link>
                  </div>
                </article>
              )
            }) : (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm font-bold text-zinc-600 sm:p-8">No jobs assigned to {selected.firstName} on this date.</div>
            )}
          </section>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm font-bold text-zinc-600 sm:p-8">No active workers found.</div>
      )}
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-zinc-50 p-2.5 ring-1 ring-inset ring-zinc-200 sm:rounded-2xl sm:p-3">
      <div className="text-[9px] font-black uppercase tracking-wide text-zinc-500 sm:text-[10px]">{label}</div>
      <div className="mt-1 break-words text-xs font-bold leading-5 text-zinc-900 sm:text-sm">{value}</div>
    </div>
  )
}
