import Link from 'next/link'
import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import {
  findNextAvailableInstallWindow,
  getLatestLandscapingPlan,
} from '@/lib/landscaping-plan'
import PlanActions from './PlanActions'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: {
    id: string
  }
}

function money(value: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(Number.isFinite(value) ? value : 0)
}

function formatDate(value: string | null) {
  if (!value) return 'No suitable date found yet'
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function fullName(firstName?: string | null, lastName?: string | null) {
  return `${firstName || ''} ${lastName || ''}`.trim()
}

export default async function LandscapingPlanningPage({ params }: PageProps) {
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
      quotes: {
        orderBy: [{ acceptedAt: 'desc' }, { updatedAt: 'desc' }],
        take: 1,
      },
    },
  })

  if (!job || !String(job.jobType || '').toLowerCase().includes('land')) notFound()

  const quote = job.quotes[0] || null
  const plan = await getLatestLandscapingPlan(job.id)
  const availability = plan
    ? await findNextAvailableInstallWindow({
        jobId: job.id,
        totalDays: plan.totalDays,
        teamSize: plan.teamSize,
      })
    : null

  const assignedWorkers = job.assignments
    .map((assignment) => fullName(assignment.worker.firstName, assignment.worker.lastName))
    .filter(Boolean)

  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-zinc-950 p-5 text-white shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-yellow-300">
              Landscaping project planning
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
              {job.customer.name}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-300">
              {quote?.scope || job.title}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-full bg-white/10 px-3 py-1.5">Job #{job.id}</span>
              <span className="rounded-full bg-white/10 px-3 py-1.5">{job.status.replaceAll('_', ' ')}</span>
              <span className="rounded-full bg-white/10 px-3 py-1.5">
                {assignedWorkers.length ? assignedWorkers.join(', ') : 'Team not assigned yet'}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {quote ? (
              <Link
                href={`/admin/quotes/${quote.id}`}
                className="inline-flex min-h-11 items-center rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-black text-white"
              >
                Open quote #{quote.id}
              </Link>
            ) : null}
            <Link
              href="/jobs"
              className="inline-flex min-h-11 items-center rounded-xl bg-white px-4 text-sm font-black text-zinc-950"
            >
              Back to jobs
            </Link>
          </div>
        </div>
      </section>

      {!plan ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <h2 className="text-xl font-black text-amber-950">The landscaping pack still needs generating</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-amber-900">
            The accepted job exists, but CHAS has not yet produced the internal programme, material-order list and projected profitability plan. Generate it here without changing the accepted quote.
          </p>
          <div className="mt-4">
            <PlanActions jobId={job.id} scheduleDate={null} />
          </div>
        </section>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-black uppercase tracking-wide text-zinc-500">Selling price ex VAT</div>
              <div className="mt-2 text-2xl font-black">{money(plan.projectedCosts.sellingPriceExVat)}</div>
            </div>
            <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-black uppercase tracking-wide text-zinc-500">Projected job cost</div>
              <div className="mt-2 text-2xl font-black">{money(plan.projectedCosts.totalCostExVat)}</div>
            </div>
            <div className="rounded-3xl border border-green-200 bg-green-50 p-5 shadow-sm">
              <div className="text-xs font-black uppercase tracking-wide text-green-800">Projected gross profit</div>
              <div className="mt-2 text-2xl font-black text-green-950">{money(plan.projectedCosts.projectedGrossProfitExVat)}</div>
            </div>
            <div className="rounded-3xl border border-green-200 bg-green-50 p-5 shadow-sm">
              <div className="text-xs font-black uppercase tracking-wide text-green-800">Projected GP %</div>
              <div className="mt-2 text-2xl font-black text-green-950">{plan.projectedCosts.projectedGrossProfitPercent.toFixed(1)}%</div>
            </div>
          </section>

          <section className="rounded-3xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">Next available install window</div>
                <h2 className="mt-2 text-xl font-black text-blue-950">
                  {availability?.startDate
                    ? `${formatDate(availability.startDate)} → ${formatDate(availability.endDate)}`
                    : 'No continuous slot found yet'}
                </h2>
                <p className="mt-2 text-sm leading-6 text-blue-900">
                  {availability?.workerNames.length
                    ? `Available team: ${availability.workerNames.join(', ')}. `
                    : ''}
                  {availability?.explanation || 'Generate the pack to calculate the first available install run.'}
                </p>
              </div>
              <PlanActions jobId={job.id} scheduleDate={availability?.startDate || null} />
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-black uppercase tracking-wide text-zinc-500">Programme</div>
              <div className="mt-2 text-2xl font-black">{plan.totalDays} working day{plan.totalDays === 1 ? '' : 's'}</div>
              <p className="mt-2 text-sm leading-6 text-zinc-600">Planned team size: {plan.teamSize}</p>
            </div>
            <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-black uppercase tracking-wide text-zinc-500">Projected labour</div>
              <div className="mt-2 text-2xl font-black">{money(plan.projectedCosts.labourExVat)}</div>
              <p className="mt-2 text-xs leading-5 text-zinc-500">Internal planning allowance, not a customer figure.</p>
            </div>
            <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-black uppercase tracking-wide text-zinc-500">Materials + plant/waste</div>
              <div className="mt-2 text-2xl font-black">
                {money(plan.projectedCosts.materialsExVat + plan.projectedCosts.plantWasteExVat + plan.projectedCosts.otherExVat)}
              </div>
              <p className="mt-2 text-xs leading-5 text-zinc-500">Projected until supplier/order costs are checked.</p>
            </div>
          </section>

          <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Ordering</div>
                <h2 className="mt-1 text-xl font-black">Materials to order</h2>
              </div>
              <div className="text-xs font-semibold text-zinc-500">Check supplier quantities/prices before committing the order.</div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                    <th className="px-3 py-3">Item</th>
                    <th className="px-3 py-3">Quantity</th>
                    <th className="px-3 py-3">Needed</th>
                    <th className="px-3 py-3">Projected cost ex VAT</th>
                    <th className="px-3 py-3">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.materials.length ? plan.materials.map((material, index) => (
                    <tr key={`${material.item}-${index}`} className="border-b border-zinc-100 align-top">
                      <td className="px-3 py-3 font-bold text-zinc-900">{material.item}</td>
                      <td className="px-3 py-3 text-zinc-700">{material.quantity}</td>
                      <td className="px-3 py-3 text-zinc-700">{material.orderFor}</td>
                      <td className="px-3 py-3 font-bold text-zinc-900">{money(material.estimatedCostExVat)}</td>
                      <td className="px-3 py-3 text-zinc-600">{material.note || '—'}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-zinc-500">No materials have been identified yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-black">Day-by-day job plan</h2>
              <div className="mt-4 space-y-3">
                {plan.dayPlan.map((day) => (
                  <div key={day.day} className="rounded-2xl bg-zinc-50 p-4">
                    <div className="text-xs font-black uppercase tracking-wide text-zinc-500">Day {day.day}</div>
                    <div className="mt-1 font-black text-zinc-950">{day.heading}</div>
                    <p className="mt-2 text-sm leading-6 text-zinc-700">{day.target}</p>
                    <div className="mt-2 space-y-1 text-sm text-zinc-600">
                      {day.tasks.map((task, index) => <div key={index}>• {task}</div>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-black">Plant & tools</h2>
                <div className="mt-3 space-y-2 text-sm text-zinc-700">
                  {plan.plantTools.map((item, index) => <div key={index}>• {item}</div>)}
                </div>
              </div>
              <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                <h2 className="text-lg font-black text-amber-950">Site checks & risks</h2>
                <div className="mt-3 space-y-2 text-sm leading-6 text-amber-950">
                  {plan.siteChecks.map((item, index) => <div key={index}>• {item}</div>)}
                  {plan.risks.map((item, index) => <div key={`risk-${index}`}>⚠ {item}</div>)}
                </div>
              </div>
              <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-black">Commercial planning notes</h2>
                <div className="mt-3 space-y-2 text-sm leading-6 text-zinc-700">
                  {plan.commercialNotes.map((item, index) => <div key={index}>• {item}</div>)}
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
