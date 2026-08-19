import Link from 'next/link'
import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import { getLatestLandscapingPlan } from '@/lib/landscaping-plan'
import { getLatestLandscapingControls } from '@/lib/landscaping-controls'

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

function workerSafeText(value: string) {
  return String(value || '')
    .replace(/£\s*\d[\d,]*(?:\.\d+)?(?:\s*\/\s*(?:m²|m2|m|day))?/gi, '')
    .replace(/\b(?:ex|inc)\.?\s*VAT\b/gi, '')
    .replace(/\bVAT\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .trim()
}

function workerTask(value: string) {
  const text = String(value || '')

  if (/prepare full-bedding mortar\s*\(1:4 cement\\?:sand/i.test(text)) {
    return 'Prepare full-bedding mortar at 1:4 cement:sand with SBR/FEB admixture added to the mix in line with the product instructions. Mix workable quantities and maintain the planned ~40mm average full bed.'
  }

  if (/point joints with appropriate mortar mix/i.test(text)) {
    return 'Point the joints with the specified brush-in jointing grout/compound. Work it fully into the joints and clean the paving in line with the jointing-product instructions.'
  }

  if (/begin pointing\/flush finishing of joints with mortar/i.test(text)) {
    return 'If the paving and joints are ready, begin the specified brush-in jointing grout only where doing so will not disturb freshly laid slabs.'
  }

  return workerSafeText(text)
}

function materialStatus(value?: string) {
  if (value === 'ordered') return 'Ordered'
  if (value === 'delivered') return 'Delivered'
  if (value === 'stock') return 'Using Furlads stock'
  return 'Not yet marked as sorted'
}

function extraStatus(value: string) {
  if (value === 'bought') return 'Bought'
  if (value === 'on_site') return 'On site'
  return 'Needed'
}

function needsSbr(scope: string) {
  const text = scope.toLowerCase()
  return (
    (text.includes('patio') || text.includes('sandstone') || text.includes('porcelain') || text.includes('indian stone')) &&
    !text.includes('block paving')
  )
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

  const [plan, controls] = await Promise.all([
    getLatestLandscapingPlan(job.id),
    getLatestLandscapingControls(job.id),
  ])

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
                {assignedWorkers.length ? assignedWorkers.join(', ') : plan ? `${plan.teamSize} people planned` : 'Not assigned'}
              </div>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">Start</div>
              <div className="mt-1 text-xl font-black">{formatDate(job.visitDate)}</div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-yellow-300 bg-yellow-50 p-5 shadow-sm">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-yellow-800">Furlads site standard — every job</div>
          <h2 className="mt-1 text-xl font-black text-zinc-950">Set it out properly. Protect the site. Keep the whole job moving.</h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-zinc-800">
            <div className="rounded-2xl bg-white p-4 ring-1 ring-inset ring-yellow-200">
              <strong>📐 Lines, levels and finish:</strong> Use string lines, profiles, levels and square checks properly. Do not eyeball work or cut corners to save time. Measure, check and build it to the agreed Furlads standard. If site conditions make the specification impossible, stop and speak to Trev/Kelly before changing the method.
            </div>
            <div className="rounded-2xl bg-white p-4 ring-1 ring-inset ring-yellow-200">
              <strong>🪵 Boards / ground protection:</strong> Put boards or suitable ground-protection sheets down before spoil or waste is stacked ready for the grabber. Once the waste has gone, move/reuse the boards under the mixer, cement, sand, paving and other materials so the customer’s drive, paths and garden are kept clean and protected.
            </div>
            <div className="rounded-2xl bg-white p-4 ring-1 ring-inset ring-yellow-200">
              <strong>⚡ Get ahead — don’t bank an early finish:</strong> Finishing today’s target early does not mean finishing early later in the week. If it is safe and the next stage is ready, use the time to pull work forward: set out the next area, move materials, make cuts, prep edges, compact, tidy waste, clean down, organise tools or complete snagging. A strong day should create headroom for weather, delays and problems later in the job.
            </div>
            <div className="rounded-2xl bg-white p-4 ring-1 ring-inset ring-yellow-200">
              <strong>✅ Before leaving:</strong> Leave the job safe, tidy and ready to restart quickly. Check the day target, photos, materials, tools and next-day setup before packing up.
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
              <strong>Accepted scope:</strong><br />{workerSafeText(job.title)}
            </div>
          </section>
        ) : (
          <>
            <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">What we’re building</div>
              <h2 className="mt-2 text-xl font-black">The overall job</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-700">{workerSafeText(plan.workerSummary)}</p>

              <div className="mt-5 border-t border-zinc-200 pt-4">
                <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Programme at a glance</div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {plan.dayPlan.map((day) => (
                    <div key={`summary-${day.day}`} className="flex items-center gap-3 rounded-2xl bg-zinc-50 px-3 py-3">
                      <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-yellow-300 text-sm font-black text-zinc-950">
                        {day.day}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-black uppercase tracking-wide text-zinc-500">Day {day.day}</div>
                        <div className="text-sm font-black leading-5 text-zinc-900">{workerSafeText(day.heading)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {controls.customerExtras.length || controls.extraItems.length ? (
              <section className="rounded-3xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
                <div className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">Live additions</div>
                <h2 className="mt-1 text-xl font-black text-blue-950">Customer extras & extra kit</h2>
                <p className="mt-1 text-sm leading-6 text-blue-900">
                  These have been added after the original job pack. Check them before starting and flag anything unclear to the office.
                </p>

                {controls.customerExtras.length ? (
                  <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-inset ring-blue-200">
                    <div className="text-xs font-black uppercase tracking-wide text-blue-700">Customer-requested extras</div>
                    <div className="mt-2 space-y-2 text-sm leading-6 text-zinc-800">
                      {controls.customerExtras.map((item, index) => <div key={index}>• {workerSafeText(item)}</div>)}
                    </div>
                  </div>
                ) : null}

                {controls.extraItems.length ? (
                  <div className="mt-3 space-y-2">
                    {controls.extraItems.map((item) => (
                      <div key={item.id} className="rounded-2xl bg-white p-4 ring-1 ring-inset ring-blue-200">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-black text-zinc-950">
                            {item.type === 'tool' ? '🛠 ' : '📦 '}{workerSafeText(item.item)}
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-black ${item.status === 'on_site' ? 'bg-green-100 text-green-800' : item.status === 'bought' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-900'}`}>
                            {extraStatus(item.status)}
                          </span>
                        </div>
                        {item.quantity ? <div className="mt-1 text-sm font-semibold text-zinc-700">Quantity: {workerSafeText(item.quantity)}</div> : null}
                        {item.note ? <div className="mt-1 text-sm leading-6 text-zinc-600">{workerSafeText(item.note)}</div> : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}

            <section className="space-y-3">
              <div className="px-1">
                <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Detailed programme</div>
                <h2 className="mt-1 text-xl font-black">What we’re aiming to achieve each day</h2>
                <p className="mt-1 text-sm text-zinc-600">Finish the day target first. If you are ahead, keep the whole job moving by pulling forward safe next-stage work. Do not bank an early finish for later in the week.</p>
              </div>

              {plan.dayPlan.map((day) => (
                <article key={day.day} className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-yellow-300 text-lg font-black">
                      {day.day}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-black uppercase tracking-wide text-zinc-500">Day {day.day}</div>
                      <h3 className="mt-1 text-lg font-black">{workerSafeText(day.heading)}</h3>
                      <p className="mt-2 text-sm leading-6 text-zinc-700">{workerSafeText(day.target)}</p>
                    </div>
                  </div>

                  {day.tasks.length ? (
                    <div className="mt-4 space-y-2">
                      {day.tasks.map((task, index) => (
                        <div key={`${day.day}-${index}`} className="flex gap-3 rounded-2xl bg-zinc-50 px-4 py-3 text-sm leading-6 text-zinc-800">
                          <span className="font-black text-zinc-400">□</span>
                          <span>{workerTask(task)}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm leading-6 text-green-950">
                    <strong>⚡ If you’re ahead:</strong>
                    <div className="mt-2 space-y-1">
                      {day.ifAhead.map((task, index) => (
                        <div key={`ahead-${day.day}-${index}`}>• {workerTask(task)}</div>
                      ))}
                    </div>
                    <div className="mt-2 text-xs font-semibold text-green-800">Keep pulling safe work forward while the next stage is ready. The aim is to protect the whole programme, not just finish today’s list.</div>
                  </div>

                  <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-950">
                    <strong>End-of-day checkpoint:</strong> {workerSafeText(day.checkpoint)}
                  </div>
                </article>
              ))}
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-black">Materials for this job</h2>
                <p className="mt-1 text-xs leading-5 text-zinc-500">These are site quantities only. Pricing and supplier-cost notes stay in the office view.</p>
                <div className="mt-4 space-y-2">
                  {plan.materials.length ? plan.materials.map((material, index) => {
                    const tracking = controls.materials[material.item]
                    return (
                      <div key={`${material.item}-${index}`} className="rounded-2xl bg-zinc-50 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="font-bold">{workerSafeText(material.item)}</div>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${tracking?.status === 'delivered' || tracking?.status === 'stock' ? 'bg-green-100 text-green-800' : tracking?.status === 'ordered' ? 'bg-blue-100 text-blue-800' : 'bg-zinc-200 text-zinc-700'}`}>
                            {materialStatus(tracking?.status)}
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-zinc-700">{workerSafeText(material.neededQuantity || material.quantity)}</div>
                      </div>
                    )
                  }) : <p className="text-sm text-zinc-500">No material list has been added yet.</p>}

                  {needsSbr(plan.scope) ? (
                    <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
                      <div className="font-bold text-yellow-950">SBR / FEB mortar admixture</div>
                      <div className="mt-1 text-sm leading-6 text-yellow-900">
                        Required in the 1:4 bedding mortar. Make sure SBR/FEB is available and add it in line with the product instructions for the mix being used.
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-black">Plant & tools</h2>
                  <div className="mt-3 space-y-2 text-sm text-zinc-700">
                    <div className="font-semibold text-zinc-900">• Boards / plywood / suitable ground-protection sheets for waste, grabber area, mixer and material storage</div>
                    {plan.plantTools.length ? plan.plantTools.map((item, index) => <div key={index}>• {workerSafeText(item)}</div>) : <div>Normal landscaping tools for the agreed scope.</div>}
                    {controls.extraItems.filter((item) => item.type === 'tool').map((item) => (
                      <div key={`extra-tool-${item.id}`} className="font-semibold text-blue-800">+ {workerSafeText(item.item)}{item.quantity ? ` — ${workerSafeText(item.quantity)}` : ''} ({extraStatus(item.status)})</div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                  <h2 className="text-lg font-black text-amber-950">Checks before / during the job</h2>
                  <div className="mt-3 space-y-2 text-sm leading-6 text-amber-950">
                    <div>• Confirm string lines/profiles/levels are set and checked before committing to excavation, edges or laying.</div>
                    <div>• Confirm boards/ground protection are down before spoil, waste, mixer or materials are placed on customer surfaces.</div>
                    {plan.siteChecks.map((item, index) => <div key={index}>• {workerSafeText(item)}</div>)}
                    {plan.risks.map((item, index) => <div key={`risk-${index}`}>⚠ {workerSafeText(item)}</div>)}
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
