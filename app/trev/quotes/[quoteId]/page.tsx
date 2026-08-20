import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
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
  return 'bg-zinc-100 text-zinc-800 ring-zinc-200'
}

export default async function TrevQuoteDetailPage({ params }: { params: { quoteId: string } }) {
  const session = await getSession()
  if (!session?.workerId) redirect('/login')

  const quoteId = Number(params.quoteId)
  if (!Number.isInteger(quoteId) || quoteId <= 0) notFound()

  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { customer: true, job: true },
  })

  if (!quote) notFound()

  const customerName = quote.customerName || quote.customer?.name || `Quote #${quote.id}`
  const phone = quote.customerPhone || quote.customer?.phone || ''
  const email = quote.customerEmail || quote.customer?.email || ''
  const address = quote.customerAddress || quote.customer?.address || ''
  const postcode = quote.customerPostcode || quote.customer?.postcode || ''

  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-950">
      <div className="mx-auto max-w-3xl px-3 pb-28 pt-3 sm:px-6 sm:py-6">
        <section className="rounded-3xl bg-zinc-950 p-4 text-white shadow-lg sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.18em] text-yellow-300">Quote #{quote.id}</div>
              <h1 className="mt-1 break-words text-3xl font-black tracking-tight">{customerName}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-sm font-black ring-1 ring-inset ${statusClasses(quote.status)}`}>{statusLabel(quote.status)}</span>
                <span className="text-2xl font-black">{formatMoney(quote.totalIncVat)}</span>
              </div>
            </div>
            <Link href="/trev/quotes" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-4 text-sm font-black text-zinc-950">Back to quotes</Link>
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-xl font-black">Scope</h2>
          <p className="mt-2 whitespace-pre-wrap text-base leading-7 text-zinc-700">{quote.scope || 'No scope saved.'}</p>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl bg-zinc-50 p-3"><div className="text-[10px] font-black uppercase text-zinc-500">Ex VAT</div><div className="mt-1 font-black">{formatMoney(quote.priceExVat)}</div></div>
            <div className="rounded-2xl bg-zinc-50 p-3"><div className="text-[10px] font-black uppercase text-zinc-500">VAT</div><div className="mt-1 font-black">{formatMoney(quote.vatAmount)}</div></div>
            <div className="rounded-2xl bg-zinc-50 p-3"><div className="text-[10px] font-black uppercase text-zinc-500">Total</div><div className="mt-1 font-black">{formatMoney(quote.totalIncVat)}</div></div>
            <div className="rounded-2xl bg-zinc-50 p-3"><div className="text-[10px] font-black uppercase text-zinc-500">Deposit</div><div className="mt-1 font-black">{formatMoney(quote.depositAmount)}</div></div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div><div className="text-xs font-black uppercase text-zinc-500">Customer</div><div className="mt-1 font-semibold">{customerName}</div></div>
            <div><div className="text-xs font-black uppercase text-zinc-500">Phone</div><div className="mt-1 font-semibold">{phone || '—'}</div></div>
            <div><div className="text-xs font-black uppercase text-zinc-500">Email</div><div className="mt-1 break-words font-semibold">{email || '—'}</div></div>
            <div><div className="text-xs font-black uppercase text-zinc-500">Address</div><div className="mt-1 font-semibold">{[address, postcode].filter(Boolean).join(', ') || '—'}</div></div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div><div className="text-xs font-black uppercase text-zinc-500">Updated</div><div className="mt-1 font-semibold">{formatDate(quote.updatedAt)}</div></div>
            <div><div className="text-xs font-black uppercase text-zinc-500">Sent</div><div className="mt-1 font-semibold">{formatDate(quote.sentAt)}</div></div>
            <div><div className="text-xs font-black uppercase text-zinc-500">Accepted</div><div className="mt-1 font-semibold">{formatDate(quote.acceptedAt)}</div></div>
            <div><div className="text-xs font-black uppercase text-zinc-500">Job</div><div className="mt-1 font-semibold">{quote.job ? `#${quote.job.id}` : '—'}</div></div>
          </div>

          {quote.customerMessage ? <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-4"><div className="text-xs font-black uppercase text-zinc-500">Customer message</div><div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700">{quote.customerMessage}</div></div> : null}
        </section>
      </div>
    </main>
  )
}
