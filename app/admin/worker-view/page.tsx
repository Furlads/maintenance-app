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
    weekday: 'long',
    day: 'numeric',
    month: 'long',
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
    <div className="space-y-4 text-slate-100">
      <section className="rounded-3xl border border-white/10 bg-[#0d1928] p-5 shadow-xl sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-yellow-300">Read-only worker screens</div>
            <h1 className="mt-2 text-2xl font-black text-white sm:text-3xl">See exactly what each worker has on</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Office view only. Kelly can inspect the worker's jobs, timings, customer details and notes without being able to start, pause, finish or change anything.</p>
          </div>
          <span className="inline-flex self-start rounded-full bg-emerald-400/15 px-3 py-2 text-xs font-black text-emerald-300 ring-1 ring-inset ring-emerald-400/30">READ ONLY</span>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-[#0d1928] p-4 shadow-lg">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Choose worker</div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {workers.map((worker) => {
            const active = worker.id === selected?.id
            return (
              <Link
                key={worker.id}
                href={`/admin/worker-view?workerId=${worker.id}&date=${key}`}
                className={`shrink-0 rounded-2xl px-4 py-3 text-sm font-black ring-1 ring-inset ${active ? 'bg-yellow-300 text-slate-950 ring-yellow-300' : 'bg-[#142236] text-slate-200 ring-white/10'}`}
              >
                {name(worker.firstName, worker.lastName)}
              </Link>
            )
          })}
        </div>
      </section>

      {selected ? (
        <>
          <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 to-slate-900 p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.16em] text-yellow-300">Worker screen</div>
                <h2 className="mt-1 text-3xl font-black text-white">{name(selected.firstName, selected.lastName)}</h2>
                {selected.jobTitle ? <div className="mt-1 text-sm font-bold text-slate-400">{selected.jobTitle}</div> : null}
              </div>
              <div className="rounded-2xl bg-white/10 px-3 py-2 text-right ring-1 ring-inset ring-white/10">
                <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">Jobs</div>
                <div className="text-2xl font-black text-white">{jobs.length}</div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-2">
              <Link href={`/admin/worker-view?workerId=${selected.id}&date=${previous.toISOString().slice(0, 10)}`} className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-white ring-1 ring-inset ring-white/10">← Previous</Link>
              <div className="text-center text-sm font-black text-slate-200">{prettyDate(start)}</div>
              <Link href={`/admin/worker-view?workerId=${selected.id}&date=${next.toISOString().slice(0, 10)}`} className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-white ring-1 ring-inset ring-white/10">Next →</Link>
            </div>
          </section>

          <section className="space-y-3">
            {jobs.length ? jobs.map((job) => {
              const team = (job.assignments || []).map((assignment) => name(assignment.worker?.firstName, assignment.worker?.lastName)).filter(Boolean)
              return (
                <article key={job.id} className="rounded-3xl border border-white/10 bg-[#101d2d] p-5 shadow-lg">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-yellow-300/15 px-2.5 py-1 text-[10px] font-black uppercase text-yellow-200 ring-1 ring-inset ring-yellow-300/25">{job.jobType || 'Job'}</span>
                        <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase text-slate-300 ring-1 ring-inset ring-white/10">{statusLabel(job.status)}</span>
                      </div>
                      <h3 className="mt-3 text-xl font-black text-white">{job.customer?.name || job.title || `Job #${job.id}`}</h3>
                      {job.title && job.customer?.name && job.title.toLowerCase() !== job.customer.name.toLowerCase() ? <div className="mt-1 text-sm font-bold text-slate-300">{job.title}</div> : null}
                    </div>
                    <div className="shrink-0 rounded-xl bg-slate-950 px-3 py-2 text-sm font-black text-yellow-300">{time(job.startTime)}</div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Info label="Address" value={[job.address || job.customer?.address, job.customer?.postcode].filter(Boolean).join(', ') || 'No address saved'} />
                    <Info label="Team on this job" value={team.length ? team.join(' + ') : name(selected.firstName, selected.lastName)} />
                    <Info label="Phone" value={job.customer?.phone || 'No phone saved'} />
                    <Info label="Planned duration" value={job.durationMinutes ? `${job.durationMinutes} minutes` : 'Not set'} />
                  </div>

                  {job.notes ? <div className="mt-4 rounded-2xl bg-slate-950/70 p-4"><div className="text-[10px] font-black uppercase tracking-wide text-slate-500">Job notes</div><div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-200">{job.notes}</div></div> : null}

                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
                    <div className="text-xs font-bold text-slate-500">Job #{job.id} · office read-only view</div>
                    <Link href={`/jobs/${job.id}`} className="rounded-xl bg-yellow-300 px-3 py-2 text-xs font-black text-slate-950">Open job record</Link>
                  </div>
                </article>
              )
            }) : (
              <div className="rounded-3xl border border-dashed border-white/15 bg-[#0d1928] p-8 text-center text-sm font-bold text-slate-400">No jobs assigned to {selected.firstName} on this date.</div>
            )}
          </section>
        </>
      ) : (
        <div className="rounded-3xl border border-dashed border-white/15 bg-[#0d1928] p-8 text-center text-sm font-bold text-slate-400">No active workers found.</div>
      )}
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-950/55 p-3 ring-1 ring-inset ring-white/10">
      <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-bold leading-5 text-slate-200">{value}</div>
    </div>
  )
}
