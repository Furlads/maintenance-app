import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import QuoteEditor from './QuoteEditor'
import QuoteDraftGuard from './QuoteDraftGuard'
import KellyQuoteOverview from './KellyQuoteOverview'
import AcceptedQuoteActions from './AcceptedQuoteActions'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: {
    id: string
  }
}

type SurveyPhoto = {
  url: string
  fileName: string
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

function surveyPhotosFromWorking(value: string | null): SurveyPhoto[] {
  if (!value) return []
  const marker = 'SURVEY PHOTOS JSON\n'
  const index = value.indexOf(marker)
  if (index < 0) return []

  const jsonText = value.slice(index + marker.length).trim()
  try {
    const parsed = JSON.parse(jsonText)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((row) => {
        if (!row || typeof row !== 'object') return null
        const item = row as Record<string, unknown>
        const url = typeof item.url === 'string' ? item.url.trim() : ''
        const fileName = typeof item.fileName === 'string' ? item.fileName.trim() : ''
        return url.startsWith('https://') ? { url, fileName: fileName || 'Survey photo' } : null
      })
      .filter((row): row is SurveyPhoto => row !== null)
      .slice(0, 12)
  } catch {
    return []
  }
}

function allTogetherPriceFromWorking(value: string | null) {
  if (!value) return null
  const marker = 'ALL-TOGETHER COMBINATIONS'
  const index = value.indexOf(marker)
  if (index < 0) return null

  const section = value.slice(index + marker.length)
  const match = section.match(/£\s*([0-9,]+(?:\.\d{1,2})?)\s*\+\s*VAT/i)
  if (!match) return null

  const price = Number(match[1].replace(/,/g, ''))
  return Number.isFinite(price) && price > 0 ? price : null
}

export default async function QuoteDetailPage({ params }: PageProps) {
  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) notFound()

  const quote = await prisma.quote.findUnique({ where: { id } })
  if (!quote) notFound()

  // An in-progress quote is still Trevor's live CHAS working session. Opening
  // it from the admin quote list should resume that conversation/editor rather
  // than dropping into Kelly's post-draft quote management screen.
  if (quote.status === 'in_progress') {
    redirect(`/quote-test?resume=${quote.id}`)
  }

  const storedSurveyPhotos = surveyPhotosFromWorking(quote.quoteWorking)
  const workerPhotoRows = quote.conversationId || quote.jobId
    ? await prisma.chasMessage.findMany({
        where: {
          imageDataUrl: { not: null },
          OR: [
            ...(quote.conversationId ? [{ conversationId: quote.conversationId }] : []),
            ...(quote.jobId ? [{ jobId: quote.jobId }] : []),
          ],
        },
        orderBy: { createdAt: 'asc' },
        take: 12,
        select: {
          imageDataUrl: true,
          worker: true,
          createdAt: true,
        },
      })
    : []

  const workerPhotos: SurveyPhoto[] = workerPhotoRows
    .map((row, index) => {
      const url = String(row.imageDataUrl || '').trim()
      if (!url.startsWith('data:image/')) return null
      return {
        url,
        fileName: `${row.worker || 'Worker'} site photo ${index + 1}`,
      }
    })
    .filter((row): row is SurveyPhoto => row !== null)

  const surveyPhotos = [...storedSurveyPhotos, ...workerPhotos]
    .filter((photo, index, all) => all.findIndex((item) => item.url === photo.url) === index)
    .slice(0, 12)

  const combinedPrice = allTogetherPriceFromWorking(quote.quoteWorking)
  const headlinePriceExVat = combinedPrice || quote.priceExVat
  const headlineVatRate = quote.vatRate || 20
  const headlineTotalIncVat = Number(
    (headlinePriceExVat * (1 + headlineVatRate / 100)).toFixed(2)
  )
  const showKellyOverview = ['needs_review', 'ready_to_send'].includes(quote.status)

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

      {quote.status === 'accepted' && quote.jobId ? (
        <AcceptedQuoteActions quoteId={quote.id} jobId={quote.jobId} />
      ) : null}

      {showKellyOverview ? (
        <KellyQuoteOverview
          quoteId={quote.id}
          priceExVat={headlinePriceExVat}
          vatRate={headlineVatRate}
          totalIncVat={headlineTotalIncVat}
          estimatedDays={quote.estimatedDays}
          estimatedTeamSize={quote.estimatedTeamSize}
          surveyPhotos={surveyPhotos}
        />
      ) : null}

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
            priceExVat: headlinePriceExVat,
            vatRate: headlineVatRate,
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
