import Link from 'next/link'
import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import { LANDSCAPING_WORKDAY_MINUTES } from '@/lib/landscaping-schedule'
import {
  findNextAvailableInstallWindow,
  getLatestLandscapingPlan,
} from '@/lib/landscaping-plan'
import { getLatestLandscapingControls } from '@/lib/landscaping-controls'
import PlanActions from './PlanActions'
import CostTracker from './CostTracker'
import LandscapingControlsPanel from './LandscapingControlsPanel'
import VariationApprovalPanel from './VariationApprovalPanel'
import SiteIssuesPanel from './SiteIssuesPanel'
import AddCompletedQuote from './AddCompletedQuote'

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

function formatStatus(value: string) {
  const cleaned = String(value || '').replaceAll('_', ' ').trim()
  if (!cleaned) return 'Unscheduled'
  return cleaned.replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function compactScope(value: string) {
  const cleaned = String(value || '').replace(/\s+/g, ' ').trim()
  if (cleaned.length <= 170) return cleaned
  const shortened = cleaned.slice(0, 170)
  const lastSpace = shortened.lastIndexOf(' ')
  return `${shortened.slice(0, lastSpace > 130 ? lastSpace : 170).trim()}…`
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

  const [availability, controls, reviewMessages] = plan
    ? await Promise.all([
        findNextAvailableInstallWindow({
          jobId: job.id,
          totalDays: plan.totalDays,
          teamSize: plan.teamSize,
        }),
        getLatestLandscapingControls(job.id),
        prisma.chasMessage.findMany({
          where: { jobId: job.id, intent: 'landscaping_plan_review' },
          orderBy: { createdAt: 'desc' },
          take: 6,
          select: { question: true, answer: true },
        }),
      ])
    : [null, null, []]

  const assignedWorkers = job.assignments
    .map((assignment) => fullName(assignment.worker.firstName, assignment.worker.lastName))
    .filter(Boolean)

  const headerScope = compactScope(quote?.scope || job.title)
  const bookedStartDate = job.visitDate ? job.visitDate.toISOString().slice(0, 10) : null
  const teamBooked = Boolean(plan && bookedStartDate && assignedWorkers.length >= plan.teamSize)
  const initialDays = Math.max(
    1,
    Math.ceil(
      (job.durationMinutes || LANDSCAPING_WORKDAY_MINUTES) /
        LANDSCAPING_WORKDAY_MINUTES
    )
  )

  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-zinc-950 p-4 text-white shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em]">
              <span className="text-yellow-300">Landscaping</span>
              <span className="text-zinc-500">/</span>
              <span className="text-zinc-400">Project planning</span>
            </div>
            <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{job.customer.name}</h1>
              <span className="text-sm font-bold text-zinc-500">Job #{job.id}</span>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-5 text-zinc-300">{headerScope}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-zinc-200">{formatStatus(job.status)}</span>
              <span className="rounded-full bg-yellow-300 px-3 py-1.5 text-zinc-950">{plan ? `${plan.totalDays} working day${plan.totalDays === 1 ? '' : 's'}` : 'Pack pending'}</span>
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-zinc-200">{plan ? `${plan.teamSize}-person team` : assignedWorkers.length ? assignedWorkers.join(', ') : 'Team not assigned'}</span>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
            {quote ? <Link href={`/admin/quotes/${quote.id}`} className="inline-flex min-h-10 items-center rounded-xl border border-white/15 bg-white/10 px-4 text-sm font-black text-white transition hover:bg-white/15">Quote #{quote.id}</Link> : null}
            <Link href="/jobs" className="inline-flex min-h-10 items-center rounded-xl bg-white px-4 text-sm font-black text-zinc-950 transition hover:bg-zinc-100">← Jobs</Link>
          </div>
        </div>
      </section>

      {!quote ? (
        <AddCompletedQuote
          jobId={job.id}
          initialScope={[job.title, job.notes].filter(Boolean).join('\n\n')}
          initialDays={initialDays}
          initialTeamSize={Math.max(1, assignedWorkers.length)}
        />
      ) : null}

      {quote && !plan ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <h2 className="text-xl font-black text-amber-950">The landscaping pack still needs generating</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-amber-900">The accepted job exists, but CHAS has not yet produced the internal programme, material-order list and projected profitability plan. Generate it here without changing the accepted quote.</p>
          <div className="mt-4"><PlanActions jobId={job.id} scheduleDate={null} /></div>
        </section>
      ) : plan ? (
        <>
          <LandscapingControlsPanel jobId={job.id} materials={plan.materials} initialControls={controls || { materials: {} }} packReady={true} teamBooked={teamBooked} bookedStartDate={bookedStartDate} initialMessages={reviewMessages.slice().reverse()} />
          <SiteIssuesPanel jobId={job.id} initialIssues={controls?.siteIssues || []} />
          <VariationApprovalPanel jobId={job.id} initialVariations={controls?.variations || []} />

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm"><div className="text-xs font-black uppercase tracking-wide text-zinc-500">Selling price ex VAT</div><div className="mt-2 text-2xl font-black">{money(plan.projectedCosts.sellingPriceExVat)}</div></div>
            <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm"><div className="text-xs font-black uppercase tracking-wide text-zinc-500">Projected job cost</div><div className="mt-2 text-2xl font-black">{money(plan.projectedCosts.totalCostExVat)}</div></div>
            <div className="rounded-3xl border border-green-200 bg-green-50 p-5 shadow-sm"><div className="text-xs font-black uppercase tracking-wide text-green-800">Projected gross profit</div><div className="mt-2 text-2xl font-black text-green-950">{money(plan.projectedCosts.projectedGrossProfitExVat)}</div></div>
            <div className="rounded-3xl border border-green-200 bg-green-50 p-5 shadow-sm"><div className="text-xs font-black uppercase tracking-wide text-green-800">Projected GP %</div><div className="mt-2 text-2xl font-black text-green-950">{plan.projectedCosts.projectedGrossProfitPercent.toFixed(1)}%</div></div>
          </section>

          <section className="rounded-3xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">Next available install window</div>
                <h2 className="mt-2 text-xl font-black text-blue-950">{availability?.startDate ? `${formatDate(availability.startDate)} → ${formatDate(availability.endDate)}` : 'No continuous slot found yet'}</h2>
                <p className="mt-2 text-sm leading-6 text-blue-900">{availability?.workerNames.length ? `Available team: ${availability.workerNames.join(', ')}. ` : ''}{availability?.explanation || 'Generate the pack to calculate the first available install run.'}</p>
              </div>
              <PlanActions jobId={job.id} scheduleDate={availability?.startDate || null} />
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm"><div className="text-xs font-black uppercase tracking-wide text-zinc-500">Programme</div><div className="mt-2 text-2xl font-black">{plan.totalDays} working day{plan.totalDays === 1 ? '' : 's'}</div><p className="mt-2 text-sm leading-6 text-zinc-600">Planned team size: {plan.teamSize}</p></div>
            <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm"><div className="text-xs font-black uppercase tracking-wide text-zinc-500">Projected labour</div><div className="mt-2 text-2xl font-black">{money(plan.projectedCosts.labourExVat)}</div><p className="mt-2 text-xs leading-5 text-zinc-500">Internal planning allowance, not a customer figure.</p></div>
            <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm"><div className="text-xs font-black uppercase tracking-wide text-zinc-500">Materials + plant/waste</div><div className="mt-2 text-2xl font-black">{money(plan.projectedCosts.materialsExVat + plan.projectedCosts.plantWasteExVat + plan.projectedCosts.otherExVat)}</div><p className="mt-2 text-xs leading-5 text-zinc-500">Projected baseline stays locked; enter actual costs below.</p></div>
          </section>

          <CostTracker jobId={job.id} sellingPriceExVat={plan.projectedCosts.sellingPriceExVat} projectedLabourExVat={plan.projectedCosts.labourExVat} projectedPlantWasteExVat={plan.projectedCosts.plantWasteExVat} projectedOtherExVat={plan.projectedCosts.otherExVat} materials={plan.materials} actualCosts={plan.actualCosts} />

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-black">Day-by-day job plan</h2>
              <div className="mt-4 space-y-3">
                {plan.dayPlan.map((day) => (
                  <div key={day.day} className="rounded-2xl bg-zinc-50 p-4">
                    <div className="text-xs font-black uppercase tracking-wide text-zinc-500">Day {day.day}</div>
                    <div className="mt-1 font-black text-zinc-950">{day.heading}</div>
                    <p className="mt-2 text-sm leading-6 text-zinc-700">{day.target}</p>
                    <div className="mt-2 space-y-1 text-sm text-zinc-600">{day.tasks.map((task, index) => <div key={index}>• {task}</div>)}</div>
                    <div className="mt-3 rounded-xl border border-green-200 bg-green-50 px-3 py-3 text-sm leading-6 text-green-950"><strong>⚡ If ahead:</strong><div className="mt-1 space-y-1">{day.ifAhead.map((task, index) => <div key={`ahead-${index}`}>• {task}</div>)}</div></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black">Plant & tools</h2><div className="mt-3 space-y-2 text-sm text-zinc-700">{plan.plantTools.map((item, index) => <div key={index}>• {item}</div>)}</div></div>
              <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm"><h2 className="text-lg font-black text-amber-950">Site checks & risks</h2><div className="mt-3 space-y-2 text-sm leading-6 text-amber-950">{plan.siteChecks.map((item, index) => <div key={index}>• {item}</div>)}{plan.risks.map((item, index) => <div key={`risk-${index}`}>⚠ {item}</div>)}</div></div>
              <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black">Commercial planning notes</h2><div className="mt-3 space-y-2 text-sm leading-6 text-zinc-700">{plan.commercialNotes.map((item, index) => <div key={index}>• {item}</div>)}</div></div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
