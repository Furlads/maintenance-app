import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import QuoteEditor from './QuoteEditor'
import QuoteDraftGuard from './QuoteDraftGuard'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: {
    id: string
  }
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

export default async function QuoteDetailPage({ params }: PageProps) {
  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) notFound()

  const quote = await prisma.quote.findUnique({ where: { id } })
  if (!quote) notFound()

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ring-inset ${statusClass(quote.status)}`}>
                {statusLabel(quote.status)}
              </span>
              <span className="text-xs font-semibold text-zinc-400">Quote #{quote.id}</span>
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-zinc-950">
              {quote.customerName || 'Customer details needed'}
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-600">
              {quote.scope}
            </p>
          </div>

          <Link href="/admin/quotes" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 text-sm font-bold text-zinc-800">
            Back to quotes
          </Link>
        </div>
      </section>

      <div id="quote-editor-autosave">
        <QuoteDraftGuard quoteId={quote.id} />
        <QuoteEditor
          quote={{
            id: quote.id,
            customerName: quote.customerName,
            customerPhone: quote.customerPhone,
            customerEmail: quote.customerEmail,
            customerAddress: quote.customerAddress,
            customerPostcode: quote.customerPostcode,
            scope: quote.scope,
            customerMessage: quote.customerMessage,
            internalNotes: quote.internalNotes,
            quoteWorking: quote.quoteWorking,
            priceExVat: quote.priceExVat,
            vatRate: 20,
            depositPercent: quote.depositPercent,
            estimatedDays: quote.estimatedDays,
            estimatedTeamSize: quote.estimatedTeamSize,
            status: quote.status,
            jobId: quote.jobId,
          }}
        />
      </div>
    </div>
  )
}
