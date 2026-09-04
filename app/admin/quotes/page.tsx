import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { safeQuoteReference } from '@/lib/quoteOptionReference'
import ClearArchiveButton from './ClearArchiveButton'
import DeleteQuoteButton from './DeleteQuoteButton'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams?: {
    status?: string
  }
}

type QuoteChoice = {
  label: string
  priceExVat: number
  totalIncVat: number
  combined?: boolean
}

const FILTERS = [
  { key: 'active', label: 'Active' },
  { key: 'needs_review', label: 'Needs review' },
  { key: 'ready_to_send', label: 'Ready to send' },
  { key: 'sent', label: 'Sent' },
  { key: 'no_reply', label: 'No reply' },
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
  if (status === 'no_reply') return 'bg-zinc-100 text-zinc-700 ring-zinc-300'
  if (status === 'ready_to_send') return 'bg-yellow-100 text-yellow-900 ring-yellow-200'
  if (status === 'declined') return 'bg-red-50 text-red-700 ring-red-200'
  if (status === 'archived') return 'bg-zinc-100 text-zinc-600 ring-zinc-200'
  return 'bg-orange-100 text-orange-800 ring-orange-200'
}

function quoteReference(quote: {
  quoteWorking: string | null
  priceExVat: number
  estimatedDays: number | null
  estimatedTeamSize: number | null
}) {
  return safeQuoteReference({
    quoteWorking: quote.quoteWorking,
    storedPriceExVat: quote.priceExVat,
    storedEstimatedDays: quote.estimatedDays,
    storedEstimatedTeamSize: quote.estimatedTeamSize,
  })
}

function priceFromLine(line: string) {
  const match = line.match(/£\s*([0-9,]+(?:\.\d{1,2})?)/)
  if (!match) return 0
  const price = Number(match[1].replace(/,/g, ''))
  return Number.isFinite(price) ? price : 0
}

function choiceFromLine(line: string, combined = false): QuoteChoice | null {
  const priceExVat = priceFromLine(line)
  if (priceExVat <= 0) return null

  const beforePrice = line.split('£')[0].trim().replace(/[:—-]+$/g, '').trim()
  const label = combined
    ? beforePrice || 'All together'
    : beforePrice || 'Option'

  return {
    label,
    priceExVat,
    totalIncVat: Number((priceExVat * 1.2).toFixed(2)),
    combined,
  }
}

function quoteChoices(working: string | null): QuoteChoice[] {
  if (!working) return []

  const marker = 'OPTIONS / PACKAGES'
  const start = working.indexOf(marker)
  if (start < 0) return []

  const after = working.slice(start + marker.length)
  const hardEnds = ['TREVOR / CHAS CONVERSATION', 'SURVEY PHOTOS JSON', 'PREVIOUS QUOTE WORKING']
    .map((item) => after.indexOf(item))
    .filter((index) => index >= 0)
  const section = hardEnds.length ? after.slice(0, Math.min(...hardEnds)) : after
  const lines = section.split('\n').map((line) => line.trim()).filter(Boolean)

  const optionChoices = lines
    .filter((line) => /^Option\s+/i.test(line) && /£\s*[0-9]/.test(line))
    .map((line) => choiceFromLine(line))
    .filter((choice): choice is QuoteChoice => choice !== null)

  if (optionChoices.length < 2) return []

  let combinedChoice: QuoteChoice | null = null
  const combinedMarker = lines.findIndex((line) => /^ALL-TOGETHER COMBINATIONS$/i.test(line))
  if (combinedMarker >= 0) {
    const line = lines.slice(combinedMarker + 1).find((item) => /£\s*[0-9]/.test(item))
    if (line) combinedChoice = choiceFromLine(line, true)
  }

  if (!combinedChoice) {
    const line = lines.find((item) =>
      /£\s*[0-9]/.test(item) &&
      /\b(all completed together|all work together|all works together|all together|combined package|combined offer|complete job)\b/i.test(item)
    )
    if (line) combinedChoice = choiceFromLine(line, true)
  }

  return combinedChoice ? [...optionChoices, combinedChoice] : optionChoices
}

function pipelineQuoteValue(quote: {
  quoteWorking: string | null
  priceExVat: number
  estimatedDays: number | null
  estimatedTeamSize: number | null
}) {
  const combined = quoteChoices(quote.quoteWorking).find((choice) => choice.combined)
  if (combined) return combined.totalIncVat
  return quoteReference(quote).totalIncVat
}

export default async function AdminQuotesPage({ searchParams }: PageProps) {
  const selected = String(searchParams?.status || 'active')

  const noReplyCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  await prisma.quote.updateMany({
    where: {
      status: 'sent',
      sentAt: { not: null, lte: noReplyCutoff },
      acceptedAt: null,
      declinedAt: null,
    },
    data: { status: 'no_reply' },
  })

  const where =
    selected === 'all'
      ? {}
      : selected === 'active'
        ? { status: { notIn: ['declined', 'archived', 'no_reply'] } }
        : { status: selected }

  const [quotes, counts, valueQuotes] = await Promise.all([
    prisma.quote.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: { customer: true, job: true },
    }),
    prisma.quote.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
    prisma.quote.findMany({
      where: { status: { notIn: ['declined', 'archived', 'no_reply'] } },
      select: {
        status: true,
        quoteWorking: true,
        priceExVat: true,
        estimatedDays: true,
        estimatedTeamSize: true,
      },
    }),
  ])

  const countMap = Object.fromEntries(
    counts.map((item) => [item.status, item._count._all])
  )

  const activeCount = counts
    .filter((item) => !['declined', 'archived', 'no_reply'].includes(item.status))
    .reduce((total, item) => total + item._count._all, 0)

  const pipelineValue = valueQuotes
    .filter((quote) => quote.status !== 'accepted')
    .reduce((total, quote) => total + pipelineQuoteValue(quote), 0)

  const bookedValue = valueQuotes
    .filter((quote) => quote.status === 'accepted')
    .reduce((total, quote) => total + quoteReference(quote).totalIncVat, 0)

  const archivedCount = countMap.archived || 0

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.15em] text-zinc-500">Furlads</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-zinc-950">Quotes</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
              Review, edit and manage quotes from CHAS through to customer acceptance and booking.
            </p>
          </div>
          <Link href="/quote-test" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-bold text-white">
            + New quote with CHAS
          </Link>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl bg-zinc-50 p-4 ring-1 ring-inset ring-zinc-200">
            <div className="text-xs font-bold uppercase tracking-wide text-zinc-500">Active quotes</div>
            <div className="mt-1 text-2xl font-black text-zinc-950">{activeCount}</div>
          </div>
          <div className="rounded-2xl bg-zinc-50 p-4 ring-1 ring-inset ring-zinc-200">
            <div className="text-xs font-bold uppercase tracking-wide text-zinc-500">Showing</div>
            <div className="mt-1 text-2xl font-black text-zinc-950">{quotes.length}</div>
          </div>
          <div className="rounded-2xl bg-yellow-50 p-4 ring-1 ring-inset ring-yellow-200">
            <div className="text-xs font-bold uppercase tracking-wide text-yellow-800">Pipeline</div>
            <div className="mt-1 text-2xl font-black text-zinc-950">{money(pipelineValue)}</div>
            <div className="mt-1 text-[11px] font-semibold text-yellow-800">All-together value for open package quotes</div>
          </div>
          <div className="rounded-2xl bg-green-50 p-4 ring-1 ring-inset ring-green-200">
            <div className="text-xs font-bold uppercase tracking-wide text-green-800">Booked in</div>
            <div className="mt-1 text-2xl font-black text-zinc-950">{money(bookedValue)}</div>
            <div className="mt-1 text-[11px] font-semibold text-green-800">Accepted / secured work</div>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((filter) => {
            const active = selected === filter.key
            const count = filter.key === 'active'
              ? activeCount
              : filter.key === 'all'
                ? counts.reduce((total, item) => total + item._count._all, 0)
                : countMap[filter.key] || 0

            return (
              <Link key={filter.key} href={`/admin/quotes?status=${filter.key}`} className={`flex-none rounded-full px-3 py-2 text-sm font-bold ring-1 ring-inset ${active ? 'bg-zinc-950 text-white ring-zinc-950' : 'bg-white text-zinc-700 ring-zinc-200'}`}>
                {filter.label} · {count}
              </Link>
            )
          })}
        </div>

        {selected === 'archived' ? (
          <div className="flex flex-none items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 shadow-sm">
            <div className="hidden text-xs font-bold text-red-800 sm:block">Remove all {archivedCount} archived quotes</div>
            <ClearArchiveButton count={archivedCount} />
          </div>
        ) : null}
      </div>

      <section className="space-y-3">
        {quotes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center">
            <div className="text-lg font-black text-zinc-900">No quotes here yet</div>
            <p className="mt-2 text-sm text-zinc-500">New CHAS quotes sent to Kelly will appear here automatically.</p>
          </div>
        ) : (
          quotes.map((quote) => {
            const customerName = quote.customerName || quote.customer?.name || 'Customer details needed'
            const reference = quoteReference(quote)
            const canDelete = quote.status !== 'accepted'
            const choices = quote.status === 'accepted' ? [] : quoteChoices(quote.quoteWorking)

            return (
              <div key={quote.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-400">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <Link href={`/admin/quotes/${quote.id}`} className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ring-inset ${statusClass(quote.status)}`}>{statusLabel(quote.status)}</span>
                      <span className="text-xs font-semibold text-zinc-400">Quote #{quote.id}</span>
                    </div>
                    <h2 className="mt-2 truncate text-lg font-black text-zinc-950">{customerName}</h2>
                    <p className="mt-1 line-clamp-2 text-sm leading-5 text-zinc-600">{quote.scope}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                      <span>Updated {formatDate(quote.updatedAt)}</span>
                      {reference.estimatedDays ? <span>{reference.estimatedDays} day estimate</span> : null}
                      {quote.job ? <span>Job #{quote.job.id} created</span> : null}
                    </div>
                  </Link>

                  <div className="flex flex-none items-center gap-3">
                    {choices.length >= 2 ? (
                      <Link href={`/admin/quotes/${quote.id}`} className="block">
                        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-500 lg:text-right">Customer choices · inc VAT</div>
                        <div className="flex max-w-[620px] flex-wrap gap-2 lg:justify-end">
                          {choices.map((choice, index) => (
                            <div
                              key={`${choice.label}-${index}`}
                              className={`min-w-[132px] rounded-xl px-3 py-2 text-left ring-1 ring-inset ${choice.combined ? 'bg-yellow-50 ring-yellow-300' : 'bg-zinc-50 ring-zinc-200'}`}
                            >
                              <div className={`max-w-[170px] truncate text-[10px] font-black uppercase tracking-wide ${choice.combined ? 'text-yellow-800' : 'text-zinc-500'}`}>
                                {choice.combined ? 'All together' : choice.label}
                              </div>
                              <div className="mt-0.5 text-lg font-black text-zinc-950">{money(choice.totalIncVat)}</div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 text-xs font-semibold text-zinc-400 lg:text-right">Open quote →</div>
                      </Link>
                    ) : (
                      <Link href={`/admin/quotes/${quote.id}`} className="block text-right">
                        <div className="text-xs font-bold uppercase tracking-wide text-zinc-500">{quote.status === 'accepted' ? 'Accepted total inc VAT' : 'Total inc VAT'}</div>
                        <div className="mt-1 text-2xl font-black text-zinc-950">{money(reference.totalIncVat)}</div>
                        <div className="mt-1 text-xs font-semibold text-zinc-400">Open quote →</div>
                      </Link>
                    )}
                    {canDelete ? <DeleteQuoteButton quoteId={quote.id} customerName={customerName} compact /> : null}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </section>
    </div>
  )
}
