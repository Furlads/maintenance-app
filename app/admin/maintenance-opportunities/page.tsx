import Link from 'next/link'
import { getMaintenanceOfficeOverview, type MaintenanceCompletionReason } from '@/lib/maintenance-controls'
import OpportunityActions from './OpportunityActions'

export const dynamic = 'force-dynamic'

const REASON_LABELS: Record<MaintenanceCompletionReason, string> = {
  '': 'Not categorised',
  no_access: 'No access / locked gate',
  weather: 'Weather stopped work',
  customer_cancelled: 'Customer cancelled',
  materials: 'Needed materials / equipment',
  ran_out_of_time: 'Ran out of time',
  other: 'Other',
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export default async function MaintenanceOpportunitiesPage() {
  const { opportunities, incomplete, nextVisitNotes, propertyNotes } = await getMaintenanceOfficeOverview()
  const open = opportunities.filter((item) => item.status === 'open')
  const quoteCreated = opportunities.filter((item) => item.status === 'quote_created')
  const dismissed = opportunities.filter((item) => item.status === 'dismissed')

  const incompleteCounts = incomplete.reduce<Record<string, number>>((acc, row) => {
    const key = row.reason || ''
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-zinc-950 p-5 text-white shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-yellow-300">Maintenance sales & follow-up</div>
            <h1 className="mt-2 text-2xl font-black sm:text-3xl">Opportunities from the round</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">Customer requests, work spotted, next-visit notes and property knowledge all land here so the office can see what needs following up.</p>
          </div>
          <Link href="/admin" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-4 text-sm font-black text-zinc-950">Back to admin</Link>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Stat label="Open opportunities" value={open.length} />
        <Stat label="Quote drafts created" value={quoteCreated.length} />
        <Stat label="Dismissed" value={dismissed.length} />
        <Stat label="Couldn’t complete" value={incomplete.length} />
        <Stat label="Next-visit notes" value={nextVisitNotes.length} />
        <Stat label="Property notes" value={propertyNotes.length} />
      </section>

      <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Quote opportunities</div>
            <h2 className="mt-1 text-xl font-black">New work coming out of maintenance visits</h2>
          </div>
          <Link href="/admin/inbox?source=worker-quote" className="text-sm font-black text-zinc-700">Open worker-quote inbox</Link>
        </div>

        <div className="mt-4 space-y-3">
          {opportunities.length ? opportunities.map((item) => (
            <article key={`${item.jobId}-${item.id}`} className={`rounded-2xl border p-4 ${item.status === 'dismissed' ? 'border-zinc-200 bg-zinc-50 opacity-70' : item.source === 'customer_requested' ? 'border-fuchsia-200 bg-fuchsia-50' : 'border-purple-200 bg-purple-50'}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${item.source === 'customer_requested' ? 'bg-fuchsia-100 text-fuchsia-800' : 'bg-purple-100 text-purple-800'}`}>{item.source === 'customer_requested' ? 'Customer asked' : 'Worker spotted'}</span>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-zinc-700 ring-1 ring-inset ring-zinc-200">{item.status === 'quote_created' ? `Quote #${item.quoteId} created` : item.status === 'dismissed' ? 'Dismissed' : 'Open'}</span>
                  </div>
                  <h3 className="mt-3 text-lg font-black text-zinc-950">{item.customerName}</h3>
                  <p className="mt-1 text-sm leading-6 text-zinc-800">{item.description}</p>
                  <div className="mt-2 text-xs font-semibold text-zinc-500">Job #{item.jobId} · {formatDate(item.visitDate)} · Reported by {item.reportedBy}</div>
                  {item.address || item.postcode ? <div className="mt-1 text-xs text-zinc-500">{item.address || item.postcode}</div> : null}
                  {item.photoUrl ? <a href={item.photoUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-black text-blue-700">View attached photo</a> : null}
                </div>

                <div className="flex min-w-[150px] flex-col gap-2">
                  <Link href={`/jobs/${item.jobId}`} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-zinc-300 bg-white px-3 text-xs font-black text-zinc-800">Open source job</Link>
                  {item.quoteId ? <Link href={`/admin/quotes/${item.quoteId}`} className="inline-flex min-h-10 items-center justify-center rounded-xl bg-zinc-950 px-3 text-xs font-black text-white">Open quote #{item.quoteId}</Link> : null}
                </div>
              </div>

              <OpportunityActions jobId={item.jobId} opportunityId={item.id} quoteId={item.quoteId} status={item.status} />
            </article>
          )) : (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-sm text-zinc-600">No maintenance opportunities have been logged yet.</div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">Needs attention next visit</div>
        <h2 className="mt-1 text-xl font-black text-blue-950">Notes the lads have left for the next maintenance visit</h2>
        <p className="mt-1 text-sm leading-6 text-blue-900">Use this to spot anything the office may need to prepare, order or make sure the next worker knows about.</p>

        <div className="mt-4 space-y-2">
          {nextVisitNotes.length ? nextVisitNotes.slice(0, 40).map((row) => (
            <div key={`${row.jobId}-${row.updatedAt}`} className="rounded-2xl bg-white p-4 ring-1 ring-inset ring-blue-200">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="font-black text-zinc-950">{row.customerName}</div>
                  <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700">{row.text}</div>
                  <div className="mt-2 text-xs text-zinc-500">Job #{row.jobId} · Visit {formatDate(row.visitDate)}{row.address || row.postcode ? ` · ${row.address || row.postcode}` : ''}</div>
                </div>
                <Link href={`/jobs/${row.jobId}`} className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-900">Open job</Link>
              </div>
            </div>
          )) : (
            <div className="rounded-2xl border border-dashed border-blue-300 bg-white/60 p-5 text-sm text-blue-900">No next-visit notes have been logged yet.</div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Property notes</div>
        <h2 className="mt-1 text-xl font-black text-emerald-950">Useful permanent knowledge about maintenance properties</h2>
        <p className="mt-1 text-sm leading-6 text-emerald-900">One latest property-memory entry per customer, so access details, preferences and recurring site issues are visible to the office as well as the worker.</p>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {propertyNotes.length ? propertyNotes.slice(0, 40).map((row) => (
            <div key={row.customerId} className="rounded-2xl bg-white p-4 ring-1 ring-inset ring-emerald-200">
              <div className="font-black text-zinc-950">{row.customerName}</div>
              <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700">{row.text}</div>
              <div className="mt-2 text-xs text-zinc-500">Latest from job #{row.jobId}{row.address || row.postcode ? ` · ${row.address || row.postcode}` : ''}</div>
              <Link href={`/jobs/${row.jobId}`} className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-900">Open latest job</Link>
            </div>
          )) : (
            <div className="rounded-2xl border border-dashed border-emerald-300 bg-white/60 p-5 text-sm text-emerald-900">No property notes have been saved yet.</div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Couldn’t-complete reporting</div>
        <h2 className="mt-1 text-xl font-black text-amber-950">Why maintenance visits are getting knocked off course</h2>

        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(incompleteCounts).length ? Object.entries(incompleteCounts).map(([reason, count]) => (
            <div key={reason} className="rounded-full bg-white px-3 py-2 text-xs font-black text-amber-950 ring-1 ring-inset ring-amber-200">{REASON_LABELS[reason as MaintenanceCompletionReason] || 'Other'}: {count}</div>
          )) : <div className="text-sm text-amber-900">No incomplete visits recorded yet.</div>}
        </div>

        {incomplete.length ? (
          <div className="mt-4 space-y-2">
            {incomplete.slice(0, 30).map((row) => (
              <div key={`${row.jobId}-${row.completedAt}`} className="rounded-2xl bg-white p-4 ring-1 ring-inset ring-amber-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-black text-zinc-950">{row.customerName}</div>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-black text-amber-900">{REASON_LABELS[row.reason] || 'Not categorised'}</span>
                </div>
                {row.note ? <div className="mt-2 text-sm leading-6 text-zinc-700">{row.note}</div> : null}
                <div className="mt-2 text-xs text-zinc-500">Job #{row.jobId} · {formatDate(row.visitDate)}</div>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="text-[11px] font-black uppercase tracking-[0.14em] text-zinc-500">{label}</div>
      <div className="mt-2 text-3xl font-black text-zinc-950">{value}</div>
    </div>
  )
}
