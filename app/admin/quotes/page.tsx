import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import ClearArchiveButton from './ClearArchiveButton'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams?: {
    status?: string
  }
}

const FILTERS = [
  { key: 'active', label: 'Active' },
  { key: 'needs_review', label: 'Needs review' },
  { key: 'ready_to_send', label: 'Ready to send' },
  { key: 'sent', label: 'Sent' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'declined', label: 'Declined' },
  { key: 'archived', label: 'Archived' },
  { key: 'all', label: 'All' },
]

function money(value: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(value || 0)
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(value)
}

function statusLabel(status: string) {
  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function statusClass(status: string) {
  if (status === 'accepted') return 'bg-green-100 text-green-800 ring-green-200'
  if (status === 'sent') return 'bg-blue-100 text-blue-800 ring-blue-200'
  if (status === 'ready_to_send') return 'bg-yellow-100 text-yellow-900 ring-yellow-200'
  if (status === 'declined') return 'bg-red-50 text-red-700 ring-red-200'
  if (status === 'archived') return 'bg-zinc-100 text-zinc-600 ring-zinc-200'
  return 'bg-orange-100 text-orange-800 ring-orange-200'
}

export default async function AdminQuotesPage({ searchParams }: PageProps) {
  const selected = String(searchParams?.status || 'active')

  const where =
    selected === 'all'
      ? {}
      : selected === 'active'
        ? { status: { notIn: ['declined', 'archived'] } }
        : { status: selected }

  const [quotes, counts] = await Promise.all([
    prisma.quote.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: { customer: true, job: true },
    }),
    prisma.quote.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
  ])

  const countMap = Object.fromEntries(
    counts.map((item) => [item.status, item._count._all])
  )

  const activeCount = counts
    .filter((item) => !['declined', 'archived'].includes(item.status))
    .reduce((total, item) => total + item._count._all, 0)

  const totalPipeline = quotes
    .filter((quote) => !['declined', 'archived'].includes(quote.status))
    .reduce((total, quote) => total + quote.totalIncVat, 0)

  const archivedCount = countMap.archived || 0

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.15em] text-zinc-500">
              Furlads
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-zinc-950">
              Quotes
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
              Review, edit and manage quotes from CHAS through to customer acceptance and booking.
            </p>
          </div>

          <Link
            href="/quote-test"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-bold text-white"
          >
            + New quote with CHAS
          </Link>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-zinc-50 p-4 ring-1 ring-inset ring-zinc-200">
            <div className="text-xs font-bold uppercase tracking-wide text-zinc-500">Active quotes</div>
            <div className="mt-1 text-2xl font-black text-zinc-950">{activeCount}</div>
          </div>
          <div className="rounded-2xl bg-zinc-50 p-4 ring-1 ring-inset ring-zinc-200">
            <div className="text-xs font-bold uppercase tracking-wide text-zinc-500">Showing</div>
            <div className="mt-1 text-2xl font-black text-zinc-950">{quotes.length}</div>
          </div>
          <div className="rounded-2xl bg-yellow-50 p-4 ring-1 ring-inset ring-yellow-200">
            <div className="text-xs font-bold uppercase tracking-wide text-yellow-800">Visible pipeline</div>
            <div className="mt-1 text-2xl font-black text-zinc-950">{money(totalPipeline)}</div>
          </div>
        </div>
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((filter) => {
          const active = selected === filter.key
          const count =
            filter.key === 'active'
              ? activeCount
              : filter.key === 'all'
                ? counts.reduce((total, item) => total + item._count._all, 0)
                : countMap[filter.key] || 0

          return (
            <Link
              key={filter.key}
              href={`/admin/quotes?status=${filter.key}`}
              className={`flex-none rounded-full px-3 py-2 text-sm font-bold ring-1 ring-inset ${
                active
                  ? 'bg-zinc-950 text-white ring-zinc-950'
                  : 'bg-white text-zinc-700 ring-zinc-200'
              }`}
            >
              {filter.label} · {count}
            </Link>
          )
        })}
      </div>

      {selected === 'archived' ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div>
            <div className="text-sm font-black text-zinc-950">Archived quotes</div>
            <div className="mt-1 text-xs font-medium text-zinc-500">
              Clear the archive when you no longer need these old quote records.
            </div>
          </div>
          <ClearArchiveButton count={archivedCount} />
        </div>
      ) : null}

      <section className="space-y-3">
        {quotes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center">
            <div className="text-lg font-black text-zinc-900">No quotes here yet</div>
            <p className="mt-2 text-sm text-zinc-500">
              New CHAS quotes sent to Kelly will appear here automatically.
            </p>
          </div>
        ) : (
          quotes.map((quote) => {
            const customerName =
              quote.customerName || quote.customer?.name || 'Customer details needed'

            return (
              <Link
                key={quote.id}
                href={`/admin/quotes/${quote.id}`}
                className="block rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-400"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ring-inset ${statusClass(quote.status)}`}>
                        {statusLabel(quote.status)}
                      </span>
                      <span className="text-xs font-semibold text-zinc-400">Quote #{quote.id}</span>
                    </div>
                    <h2 className="mt-2 truncate text-lg font-black text-zinc-950">
                      {customerName}
                    </h2>
                    <p className="mt-1 line-clamp-2 text-sm leading-5 text-zinc-600">
                      {quote.scope}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                      <span>Updated {formatDate(quote.updatedAt)}</span>
                      {quote.estimatedDays ? <span>{quote.estimatedDays} day estimate</span> : null}
                      {quote.job ? <span>Job #{quote.job.id} created</span> : null}
                    </div>
                  </div>

                  <div className="flex-none sm:text-right">
                    <div className="text-xs font-bold uppercase tracking-wide text-zinc-500">Total inc VAT</div>
                    <div className="mt-1 text-2xl font-black text-zinc-950">
                      {money(quote.totalIncVat)}
                    </div>
                    <div className="mt-1 text-xs font-semibold text-zinc-400">Open quote →</div>
                  </div>
                </div>
              </Link>
            )
          })
        )}
      </section>
    </div>
  )
}
