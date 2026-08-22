import Link from 'next/link'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function formatMoney(value: number | null | undefined) {
  const amount = typeof value === 'number' && Number.isFinite(value) ? value : 0
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDate(value: Date | null | undefined) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(value)
}

function statusLabel(status: string | null | undefined) {
  const value = String(status || '').trim().toLowerCase()
  if (value === 'needs_review') return 'Needs review'
  if (value === 'sent') return 'Sent'
  if (value === 'accepted') return 'Accepted'
  if (value === 'declined') return 'Declined'
  if (value === 'archived') return 'Archived'
  return value ? value.replace(/_/g, ' ').replace(/^./, (char) => char.toUpperCase()) : 'Unknown'
}

function statusClasses(status: string | null | undefined) {
  const value = String(status || '').trim().toLowerCase()
  if (value === 'accepted') return 'bg-green-100 text-green-800 ring-green-200'
  if (value === 'sent') return 'bg-blue-100 text-blue-800 ring-blue-200'
  if (value === 'declined') return 'bg-red-100 text-red-800 ring-red-200'
  if (value === 'needs_review') return 'bg-amber-100 text-amber-900 ring-amber-200'
  if (value === 'archived') return 'bg-zinc-200 text-zinc-700 ring-zinc-300'
  return 'bg-zinc-100 text-zinc-800 ring-zinc-200'
}

export default async function TrevQuotesPage() {
  const session = await getSession()
  if (!session?.workerId) redirect('/login')

  const quotes = await prisma.quote.findMany({
    where: {
      archivedAt: null,
    },
    include: {
      customer: true,
      job: true,
    },
    orderBy: [{ updatedAt: 'desc' }],
    take: 100,
  })

  const counts = quotes.reduce(
    (acc, quote) => {
      const key = String(quote.status || '').toLowerCase()
      if (key === 'needs_review') acc.needsReview += 1
      if (key === 'sent') acc.sent += 1
      if (key === 'accepted') acc.accepted += 1
      if (key === 'declined') acc.declined += 1
      return acc
    },
    { needsReview: 0, sent: 0, accepted: 0, declined: 0 }
  )

  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-950">
      <div className="mx-auto max-w-5xl px-3 pb-28 pt-3 sm:px-6 sm:py-6">
        <section className="rounded-3xl bg-zinc-950 p-4 text-white shadow-lg sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.18em] text-yellow-300">Trev dashboard</div>
              <h1 className="mt-1 text-3xl font-black tracking-tight">Quotes</h1>
              <p className="mt-2 text-sm leading-6 text-zinc-300">See every active quote and where it currently sits.</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link href="/admin/quotes" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-yellow-400 px-4 text-sm font-black text-zinc-950 shadow-sm transition hover:bg-yellow-300">+ New quote</Link>
            <Link href="/trev" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-4 text-sm font-black text-zinc-950">Back to overview</Link>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            <div className="rounded-2xl bg-white/10 p-3">
              <div className="text-[10px] font-black uppercase tracking-wide text-zinc-300">Needs review</div>
              <div className="mt-1 text-2xl font-black">{counts.needsReview}</div>
            </div>
            <div className="rounded-2xl bg-white/10 p-3">
              <div className="text-[10px] font-black uppercase tracking-wide text-zinc-300">Sent</div>
              <div className="mt-1 text-2xl font-black">{counts.sent}</div>
            </div>
            <div className="rounded-2xl bg-white/10 p-3">
              <div className="text-[10px] font-black uppercase tracking-wide text-zinc-300">Accepted</div>
              <div className="mt-1 text-2xl font-black">{counts.accepted}</div>
            </div>
            <div className="rounded-2xl bg-white/10 p-3">
              <div className="text-[10px] font-black uppercase tracking-wide text-zinc-300">Declined</div>
              <div className="mt-1 text-2xl font-black">{counts.declined}</div>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-zinc-200 bg-white p-3 shadow-sm sm:p-5">
          {quotes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-sm text-zinc-600">No active quotes found.</div>
          ) : (
            <div className="space-y-3">
              {quotes.map((quote) => {
                const customerName = quote.customerName || quote.customer?.name || `Quote #${quote.id}`
                const status = statusLabel(quote.status)
                const href = `/trev/quotes/${quote.id}`

                return (
                  <Link key={quote.id} href={href} className="block">
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 transition hover:border-zinc-300 hover:bg-zinc-100">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="break-words text-base font-black text-zinc-950">{customerName}</h2>
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ring-inset ${statusClasses(quote.status)}`}>{status}</span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-sm leading-5 text-zinc-600">{quote.scope}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-lg font-black text-zinc-950">{formatMoney(quote.totalIncVat)}</div>
                          <div className="mt-1 text-[11px] font-semibold text-zinc-500">Quote #{quote.id}</div>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-wide text-zinc-500">Updated</div>
                          <div className="mt-1 font-semibold text-zinc-800">{formatDate(quote.updatedAt)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-wide text-zinc-500">Sent</div>
                          <div className="mt-1 font-semibold text-zinc-800">{formatDate(quote.sentAt)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-wide text-zinc-500">Accepted</div>
                          <div className="mt-1 font-semibold text-zinc-800">{formatDate(quote.acceptedAt)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-wide text-zinc-500">Job</div>
                          <div className="mt-1 font-semibold text-zinc-800">{quote.job ? `#${quote.job.id}` : '—'}</div>
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
