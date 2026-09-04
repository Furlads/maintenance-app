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
    <div className="space-y-3 sm:space-y-4">
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.17em] text-yellow-700 sm:text-xs">Maintenance sales & follow-up</div>
            <h1 className="mt-1.5 text-2xl font-black tracking-tight text-zinc-950 sm:text-3xl">Opportunities from the round</h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-5 text-zinc-600 sm:leading-6">Customer requests, work spotted and visit notes in one office view so nothing gets missed.</p>
          </div>
          <Link href="/admin" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-black text-yellow-300">Back to admin</Link>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-6">
        <Stat label="Open" value={open.length} />
        <Stat label="Quote drafts" value={quoteCreated.length} />
        <Stat label="Dismissed" value={dismissed.length} />
        <Stat label="Couldn’t complete" value={incomplete.length} />
        <Stat label="Next-visit notes" value={nextVisitNotes.length} />
        <Stat label="Property notes" value={propertyNotes.length} />
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-3.5 shadow-sm sm:p-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-500 sm:text-xs">Quote opportunities</div>
            <h2 className="mt-1 text-lg font-black text-zinc-950 sm:text-xl">New work from maintenance visits</h2>
          </div>
          <Link href="/admin/inbox?source=worker-quote" className="shrink-0 rounded-lg bg-zinc-100 px-2.5 py-2 text-[11px] font-black text-zinc-700 sm:text-sm">Worker quotes</Link>
        </div>

        <div className="mt-3 space-y-2.5 sm:mt-4 sm:space-y-3">
          {opportunities.length ? opportunities.map((item) => (
            <article key={`${item.jobId}-${item.id}`} className={`rounded-xl border p-3.5 sm:rounded-2xl sm:p-4 ${item.status === 'dismissed' ? 'border-zinc-200 bg-zinc-50 opacity-70' : item.source === 'customer_requested' ? 'border-fuchsia-200 bg-fuchsia-50' : 'border-purple-200 bg-purple-50'}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${item.source === 'customer_requested' ? 'bg-fuchsia-100 text-fuchsia-800' : 'bg-purple-100 text-purple-800'}`}>{item.source === 'customer_requested' ? 'Customer asked' : 'Worker spotted'}</span>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-zinc-700 ring-1 ring-inset ring-zinc-200">{item.status === 'quote_created' ? `Quote #${item.quoteId}` : item.status === 'dismissed' ? 'Dismissed' : 'Open'}</span>
                  </div>
                  <h3 className="mt-2.5 truncate text-lg font-black text-zinc-950">{item.customerName}</h3>
                  <p className="mt-1 line-clamp-3 text-sm leading-5 text-zinc-800 sm:leading-6">{item.description}</p>
                  <div className="mt-2 text-[11px] font-semibold leading-5 text-zinc-500 sm:text-xs">Job #{item.jobId} · {formatDate(item.visitDate)} · {item.reportedBy}</div>
                  {item.address || item.postcode ? <div className="truncate text-[11px] text-zinc-500 sm:text-xs">{item.address || item.postcode}</div> : null}
                  {item.photoUrl ? <a href={item.photoUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-black text-blue-700">View photo</a> : null}
                </div>

                <div className="grid grid-cols-2 gap-2 sm:min-w-[150px] sm:grid-cols-1">
                  <Link href={`/jobs/${item.jobId}`} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-center text-[11px] font-black text-zinc-800 sm:rounded-xl sm:text-xs">Source job</Link>
                  {item.quoteId ? <Link href={`/admin/quotes/${item.quoteId}`} className="inline-flex min-h-10 items-center justify-center rounded-lg bg-zinc-900 px-3 text-center text-[11px] font-black text-yellow-300 sm:rounded-xl sm:text-xs">Quote #{item.quoteId}</Link> : null}
                </div>
              </div>

              <OpportunityActions jobId={item.jobId} opportunityId={item.id} quoteId={item.quoteId} status={item.status} />
            </article>
          )) : (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600 sm:rounded-2xl sm:p-5">No maintenance opportunities have been logged yet.</div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-blue-200 bg-blue-50 p-3.5 shadow-sm sm:p-5">
        <div className="text-[10px] font-black uppercase tracking-[0.15em] text-blue-700 sm:text-xs">Needs attention next visit</div>
        <h2 className="mt-1 text-lg font-black text-blue-950 sm:text-xl">Notes for the next maintenance visit</h2>
        <p className="mt-1 text-sm leading-5 text-blue-900 sm:leading-6">Anything the office may need to prepare, order or make sure the next worker knows.</p>

        <div className="mt-3 space-y-2 sm:mt-4">
          {nextVisitNotes.length ? nextVisitNotes.slice(0, 40).map((row) => (
            <div key={`${row.jobId}-${row.updatedAt}`} className="rounded-xl bg-white p-3 ring-1 ring-inset ring-blue-200 sm:rounded-2xl sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-black text-zinc-950">{row.customerName}</div>
                  <div className="mt-1.5 whitespace-pre-wrap text-sm leading-5 text-zinc-700 sm:leading-6">{row.text}</div>
                  <div className="mt-2 text-[11px] leading-5 text-zinc-500 sm:text-xs">Job #{row.jobId} · {formatDate(row.visitDate)}{row.address || row.postcode ? ` · ${row.address || row.postcode}` : ''}</div>
                </div>
                <Link href={`/jobs/${row.jobId}`} className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-2.5 text-[11px] font-black text-blue-900 sm:rounded-xl sm:px-3 sm:text-xs">Open</Link>
              </div>
            </div>
          )) : (
            <div className="rounded-xl border border-dashed border-blue-300 bg-white/60 p-4 text-sm text-blue-900 sm:rounded-2xl sm:p-5">No next-visit notes have been logged yet.</div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 shadow-sm sm:p-5">
        <div className="text-[10px] font-black uppercase tracking-[0.15em] text-emerald-700 sm:text-xs">Property notes</div>
        <h2 className="mt-1 text-lg font-black text-emerald-950 sm:text-xl">Useful permanent property knowledge</h2>
        <p className="mt-1 text-sm leading-5 text-emerald-900 sm:leading-6">Access details, preferences and recurring site issues kept visible to the office.</p>

        <div className="mt-3 grid gap-2.5 sm:mt-4 sm:gap-3 lg:grid-cols-2">
          {propertyNotes.length ? propertyNotes.slice(0, 40).map((row) => (
            <div key={row.customerId} className="rounded-xl bg-white p-3 ring-1 ring-inset ring-emerald-200 sm:rounded-2xl sm:p-4">
              <div className="truncate font-black text-zinc-950">{row.customerName}</div>
              <div className="mt-1.5 whitespace-pre-wrap text-sm leading-5 text-zinc-700 sm:leading-6">{row.text}</div>
              <div className="mt-2 text-[11px] leading-5 text-zinc-500 sm:text-xs">Latest job #{row.jobId}{row.address || row.postcode ? ` · ${row.address || row.postcode}` : ''}</div>
              <Link href={`/jobs/${row.jobId}`} className="mt-2.5 inline-flex min-h-10 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-[11px] font-black text-emerald-900 sm:rounded-xl sm:text-xs">Open latest job</Link>
            </div>
          )) : (
            <div className="rounded-xl border border-dashed border-emerald-300 bg-white/60 p-4 text-sm text-emerald-900 sm:rounded-2xl sm:p-5">No property notes have been saved yet.</div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5 shadow-sm sm:p-5">
        <div className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-700 sm:text-xs">Couldn’t-complete reporting</div>
        <h2 className="mt-1 text-lg font-black text-amber-950 sm:text-xl">Why visits are getting knocked off course</h2>

        <div className="mt-3 flex flex-wrap gap-1.5 sm:mt-4 sm:gap-2">
          {Object.entries(incompleteCounts).length ? Object.entries(incompleteCounts).map(([reason, count]) => (
            <div key={reason} className="rounded-full bg-white px-2.5 py-1.5 text-[10px] font-black text-amber-950 ring-1 ring-inset ring-amber-200 sm:px-3 sm:py-2 sm:text-xs">{REASON_LABELS[reason as MaintenanceCompletionReason] || 'Other'}: {count}</div>
          )) : <div className="text-sm text-amber-900">No incomplete visits recorded yet.</div>}
        </div>

        {incomplete.length ? (
          <div className="mt-3 space-y-2 sm:mt-4">
            {incomplete.slice(0, 30).map((row) => (
              <div key={`${row.jobId}-${row.completedAt}`} className="rounded-xl bg-white p-3 ring-1 ring-inset ring-amber-200 sm:rounded-2xl sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-black text-zinc-950">{row.customerName}</div>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black text-amber-900 sm:text-[11px]">{REASON_LABELS[row.reason] || 'Not categorised'}</span>
                </div>
                {row.note ? <div className="mt-1.5 text-sm leading-5 text-zinc-700 sm:leading-6">{row.note}</div> : null}
                <div className="mt-2 text-[11px] text-zinc-500 sm:text-xs">Job #{row.jobId} · {formatDate(row.visitDate)}</div>
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
    <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-4">
      <div className="text-[9px] font-black uppercase tracking-[0.12em] text-zinc-500 sm:text-[11px] sm:tracking-[0.14em]">{label}</div>
      <div className="mt-1.5 text-2xl font-black text-zinc-950 sm:mt-2 sm:text-3xl">{value}</div>
    </div>
  )
}
