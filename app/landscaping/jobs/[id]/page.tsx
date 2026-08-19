import Link from 'next/link'
import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import { getLatestLandscapingPlan } from '@/lib/landscaping-plan'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: {
    id: string
  }
}

function fullName(firstName?: string | null, lastName?: string | null) {
  return `${firstName || ''} ${lastName || ''}`.trim()
}

function formatDate(value?: Date | null) {
  if (!value) return 'Not booked yet'
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(value)
}

export default async function LandscapingWorkerJobPage({ params }: PageProps) {
  const jobId = Number(params.id)
  if (!Number.isInteger(jobId) || jobId <= 0) notFound()

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      customer: true,
      assignments: {
        include: { worker: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!job || !String(job.jobType || '').toLowerCase().includes('land')) notFound()

  const plan = await getLatestLandscapingPlan(job.id)
  const assignedWorkers = job.assignments
    .map((assignment) => fullName(assignment.worker.firstName, assignment.worker.lastName))
    .filter(Boolean)

  return (
    <main className="min-h-screen bg-zinc-100 px-3 py-4 text-zinc-950 sm:px-5">
      <div className="mx-auto max-w-4xl space-y-4">
        <section className="rounded-3xl bg-zinc-950 p-5 text-white shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.18em] text-yellow-300">
                Landscaping job sheet
              </div>
              <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
                {job.customer.name}
              </h1>
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                {job.address || job.customer.address || job.customer.postcode || 'Address not saved'}
              </p>
            </div>
            <Link
              href="/today"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-4 text-sm font-black text-zinc-950"
            >
              Back to today
            </Link>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-white/10 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">Overall programme</div>
              <div className="mt-1 text-xl font-black">
                {plan ? `${plan.totalDays} working day${plan.totalDays === 1 ? '' : 's'}` : 'Being prepared'}
              </div>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">Team</div>
              <div className="mt-1 text-xl font-black">
                {assignedWorkers.length ? assignedWorkers.join(', ') : plan ? `${plan.teamSize} people planned` : 'TBC'}
              </div>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">Start</div>
              <div className="mt-1 text-xl font-black">{formatDate(job.visitDate)}</div>
            </div>
          </div>
        </section>

        {!plan ? (
          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <h2 className="text-lg font-black text-amber-950">Job pack is still being prepared</h2>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              The job has been accepted, but the day-by-day landscaping plan has not been generated yet. Kelly or Trev can regenerate it from the internal job planning page.
            </p>
            <div className="mt-4 rounded-2xl bg-white p-4 text-sm leading-6 text-zinc-800 ring-1 ring-inset ring-amber-200">
              <strong>Accepted scope:</strong><br />{job.title}
            </div>
          </section>
        ) : (
          <>
            <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">What we’re building</div>
              <h2 className="mt-2 text-xl font-black">The overall job</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-700">{plan.workerSummary}</p>
              <div className="mt-4 rounded-2xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-700">
                {plan.scope}
              </div>
            </section>

            <section className="space-y-3">
              <div className="px-1">
                <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Programme</div>
                <h2 className="mt-1 text-xl font-black">What we’re aiming to achieve each day</h2>
              </div>

              {plan.dayPlan.map((day) => (
                <article key={day.day} className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-yellow-300 text-lg font-black">
                      {day.day}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-black uppercase tracking-wide text-zinc-500">Day {day.day}</div>
                      <h3 className="mt-1 text-lg font-black">{day.heading}</h3>
                      <p className="mt-2 text-sm leading-6 text-zinc-700">{day.target}</p>
                    </div>
                  </div>

                  {day.tasks.length ? (
                    <div className="mt-4 space-y-2">
                      {day.tasks.map((task, index) => (
                        <div key={`${day.day}-${index}`} className="flex gap-3 rounded-2xl bg-zinc-50 px-4 py-3 text-sm leading-6 text-zinc-800">
                          <span className="font-black text-zinc-400">□</span>
                          <span>{task}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-950">
                    <strong>End-of-day checkpoint:</strong> {day.checkpoint}
                  </div>
                </article>
              ))}
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-black">Materials expected on the job</h2>
                <p className="mt-1 text-xs leading-5 text-zinc-500">Quantities marked TBC must be confirmed before the order is placed.</p>
                <div className="mt-4 space-y-2">
                  {plan.materials.length ? plan.materials.map((material, index) => (
                    <div key={`${material.item}-${index}`} className="rounded-2xl bg-zinc-50 p-4">
                      <div className="font-bold">{material.item}</div>
                      <div className="mt-1 text-sm text-zinc-700">{material.quantity}</div>
                      {material.note ? <div className="mt-1 text-xs leading-5 text-zinc-500">{material.note}</div> : null}
                    </div>
                  )) : <p className="text-sm text-zinc-500">No material list has been added yet.</p>}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-black">Plant & tools</h2>
                  <div className="mt-3 space-y-2 text-sm text-zinc-700">
                    {plan.plantTools.length ? plan.plantTools.map((item, index) => <div key={index}>• {item}</div>) : <div>Normal landscaping tools for the agreed scope.</div>}
                  </div>
                </div>

                <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                  <h2 className="text-lg font-black text-amber-950">Checks before / during the job</h2>
                  <div className="mt-3 space-y-2 text-sm leading-6 text-amber-950">
                    {plan.siteChecks.map((item, index) => <div key={index}>• {item}</div>)}
                    {plan.risks.map((item, index) => <div key={`risk-${index}`}>⚠ {item}</div>)}
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        <div className="pb-5 text-center text-xs font-medium text-zinc-400">
          Job #{job.id} · No customer pricing or profit information is shown in the worker job sheet.
        </div>
      </div>
    </main>
  )
}
