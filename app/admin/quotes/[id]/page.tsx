import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { safeQuoteReference } from '@/lib/quoteOptionReference'
import QuoteEditor from './QuoteEditor'
import QuoteDraftGuard from './QuoteDraftGuard'
import QuoteChasAutoRefresh from './QuoteChasAutoRefresh'
import KellyQuoteOverview from './KellyQuoteOverview'
import AcceptedQuoteActions from './AcceptedQuoteActions'
import QuoteStatusControls from './QuoteStatusControls'
import DeleteQuoteButton from '../DeleteQuoteButton'

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
  if (status === 'no_reply') return 'bg-zinc-100 text-zinc-700 ring-zinc-300'
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

export default async function QuoteDetailPage({ params }: PageProps) {
  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) notFound()

  let quote = await prisma.quote.findUnique({ where: { id } })
  if (!quote) notFound()

  if (
    quote.status === 'sent' &&
    quote.sentAt &&
    quote.sentAt.getTime() <= Date.now() - 30 * 24 * 60 * 60 * 1000 &&
    !quote.acceptedAt &&
    !quote.declinedAt
  ) {
    quote = await prisma.quote.update({
      where: { id: quote.id },
      data: { status: 'no_reply' },
    })
  }

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

  const draftReference = safeQuoteReference({
    quoteWorking: quote.quoteWorking,
    storedPriceExVat: quote.priceExVat,
    storedEstimatedDays: quote.estimatedDays,
    storedEstimatedTeamSize: quote.estimatedTeamSize,
  })
  const useStoredCommercials = ['sent', 'no_reply', 'accepted', 'declined', 'archived'].includes(quote.status)
  const reference = useStoredCommercials
    ? {
        priceExVat: quote.priceExVat,
        vatRate: quote.vatRate,
        vatAmount: quote.vatAmount,
        totalIncVat: quote.totalIncVat,
        estimatedDays: quote.estimatedDays,
        estimatedTeamSize: quote.estimatedTeamSize,
      }
    : draftReference

  const showKellyOverview = ['needs_review', 'ready_to_send'].includes(quote.status)
  const canDelete = quote.status !== 'accepted'

  return (
    <div className="space-y-3 sm:space-y-4">
      <QuoteChasAutoRefresh quoteId={quote.id} />

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ring-1 ring-inset sm:text-[11px] ${statusClass(quote.status)}`}>
                {statusLabel(quote.status)}
              </span>
              <span className="text-[11px] font-semibold text-zinc-400 sm:text-xs">Quote #{quote.id}</span>
            </div>
            <h1 className="mt-2 truncate text-xl font-black tracking-tight text-zinc-950 sm:text-2xl">
              {quote.customerName || 'Customer details needed'}
            </h1>
            <p className="mt-1 line-clamp-3 max-w-3xl text-sm leading-5 text-zinc-600 sm:leading-6">
              {quote.scope}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
            {canDelete ? <DeleteQuoteButton quoteId={quote.id} customerName={quote.customerName} /> : <div />}
            <Link href="/admin/quotes" className="inline-flex min-h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-xs font-bold text-zinc-800 sm:min-h-11 sm:rounded-xl sm:px-4 sm:text-sm">
              Back to quotes
            </Link>
          </div>
        </div>
      </section>

      <QuoteStatusControls
        quoteId={quote.id}
        currentStatus={quote.status}
        jobId={quote.jobId}
        sentAt={quote.sentAt?.toISOString() || null}
        acceptedAt={quote.acceptedAt?.toISOString() || null}
        declinedAt={quote.declinedAt?.toISOString() || null}
      />

      {quote.status === 'accepted' && quote.jobId ? (
        <AcceptedQuoteActions quoteId={quote.id} jobId={quote.jobId} />
      ) : null}

      {showKellyOverview ? (
        <KellyQuoteOverview
          quoteId={quote.id}
          priceExVat={reference.priceExVat}
          vatRate={reference.vatRate}
          totalIncVat={reference.totalIncVat}
          estimatedDays={reference.estimatedDays}
          estimatedTeamSize={reference.estimatedTeamSize}
          surveyPhotos={surveyPhotos}
        />
      ) : null}

      <div id="quote-editor-autosave" className="min-w-0">
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
            priceExVat: reference.priceExVat,
            vatRate: reference.vatRate,
            depositPercent: quote.depositPercent,
            estimatedDays: reference.estimatedDays,
            estimatedTeamSize: reference.estimatedTeamSize,
            status: quote.status,
            jobId: quote.status === 'accepted' ? quote.jobId : null,
          }}
        />
      </div>
    </div>
  )
}
