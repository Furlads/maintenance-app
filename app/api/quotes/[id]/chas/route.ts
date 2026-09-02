import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = {
  params: {
    id: string
  }
}

type ChasDecision = {
  intent?: 'review' | 'correct_quote'
  answer?: string
  correctedScope?: string
}

function validId(value: string) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function cleanNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function sessionKey(quoteId: number) {
  return `quote-review-${quoteId}`
}

function extractJson(value: string): ChasDecision | null {
  const trimmed = value.trim()

  try {
    return JSON.parse(trimmed) as ChasDecision
  } catch {
    const firstBrace = trimmed.indexOf('{')
    const lastBrace = trimmed.lastIndexOf('}')
    if (firstBrace === -1 || lastBrace <= firstBrace) return null

    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as ChasDecision
    } catch {
      return null
    }
  }
}

function money(value: unknown) {
  return `£${cleanNumber(value).toFixed(2)}`
}

function formatPricingWorking(pricing: Record<string, any>) {
  const rows = Array.isArray(pricing.costBreakdown) ? pricing.costBreakdown : []
  const assumptions = Array.isArray(pricing.assumptions) ? pricing.assumptions : []
  const missing = Array.isArray(pricing.missingInformation) ? pricing.missingInformation : []
  const notes = Array.isArray(pricing.pricingNotes) ? pricing.pricingNotes : []
  const warnings = Array.isArray(pricing.warningFlags) ? pricing.warningFlags : []
  const options = Array.isArray(pricing.options) ? pricing.options : []
  const combinedOffers = Array.isArray(pricing.combinedOffers)
    ? pricing.combinedOffers
    : pricing.combinedOffer
      ? [pricing.combinedOffer]
      : []
  const labour = pricing.labourSummary && typeof pricing.labourSummary === 'object'
    ? pricing.labourSummary
    : null

  return [
    'CHAS REPRICE — OFFICE CORRECTION APPLIED',
    '',
    pricing.summary ? `Scope summary: ${pricing.summary}` : '',
    `Recommended price ex VAT: ${money(pricing.recommendedPriceExVat)}`,
    `Estimated direct cost: ${money(pricing.estimatedHardCosts)}`,
    pricing.achievedGrossMargin == null
      ? ''
      : `Estimated gross margin: ${cleanNumber(pricing.achievedGrossMargin).toFixed(1)}%`,
    pricing.estimatedDuration?.workingDays
      ? `Programme: ${pricing.estimatedDuration.workingDays} working day(s) with ${pricing.estimatedDuration.teamSize || 1} people`
      : '',
    labour
      ? `Labour: ${cleanNumber(labour.manDays).toFixed(1)} man-day(s), internal cost ${money(labour.estimatedCost)}${cleanText(labour.notes) ? ` — ${cleanText(labour.notes)}` : ''}`
      : '',
    '',
    options.length ? 'OPTIONS / PACKAGES' : '',
    ...options.map((option: any) => {
      const label = cleanText(option.label) || cleanText(option.title) || 'Option'
      return `${label}: ${money(option.priceExVat)} + VAT (${money(option.totalIncVat)} inc VAT)${cleanText(option.summary) ? `\n${cleanText(option.summary)}` : ''}`
    }),
    '',
    combinedOffers.length ? 'ALL-TOGETHER COMBINATIONS' : '',
    ...combinedOffers.map((offer: any) => {
      const label = cleanText(offer.label) || 'All work together'
      return `${label}: ${money(offer.priceExVat)} + VAT (${money(offer.totalIncVat)} inc VAT)${cleanText(offer.summary) ? `\n${cleanText(offer.summary)}` : ''}`
    }),
    '',
    rows.length ? 'COST BREAKDOWN' : '',
    ...rows.map((row: any) => `- ${cleanText(row.category)}: ${money(row.amount)}${cleanText(row.detail) ? ` — ${cleanText(row.detail)}` : ''}`),
    '',
    assumptions.length ? 'ASSUMPTIONS' : '',
    ...assumptions.map((item: unknown) => `- ${cleanText(item)}`),
    '',
    missing.length ? 'MISSING / CHECK' : '',
    ...missing.map((item: unknown) => `- ${cleanText(item)}`),
    '',
    notes.length ? 'PRICING NOTES' : '',
    ...notes.map((item: unknown) => `- ${cleanText(item)}`),
    '',
    warnings.length ? 'WARNINGS' : '',
    ...warnings.map((item: unknown) => `- ${cleanText(item)}`),
  ]
    .filter((line, index, all) => line || (index > 0 && all[index - 1]))
    .join('\n')
    .trim()
}

async function loadQuote(id: number) {
  return prisma.quote.findUnique({
    where: { id },
    select: {
      id: true,
      jobId: true,
      customerName: true,
      customerPostcode: true,
      scope: true,
      internalNotes: true,
      quoteWorking: true,
      customerMessage: true,
      priceExVat: true,
      vatAmount: true,
      totalIncVat: true,
      depositPercent: true,
      depositAmount: true,
      estimatedDays: true,
      estimatedTeamSize: true,
      status: true,
    },
  })
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const id = validId(params.id)
    if (!id) return NextResponse.json({ ok: false, error: 'Invalid quote id.' }, { status: 400 })

    const quote = await loadQuote(id)
    if (!quote) return NextResponse.json({ ok: false, error: 'Quote not found.' }, { status: 404 })

    const messages = await prisma.chasMessage.findMany({
      where: {
        company: 'furlads',
        sessionId: sessionKey(id),
      },
      orderBy: { createdAt: 'asc' },
      take: 30,
      select: {
        id: true,
        question: true,
        answer: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ ok: true, messages })
  } catch (error) {
    console.error('GET QUOTE CHAS ERROR', error)
    return NextResponse.json({ ok: false, error: 'Could not load quote review chat.' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const id = validId(params.id)
    if (!id) return NextResponse.json({ ok: false, error: 'Invalid quote id.' }, { status: 400 })

    const body = await request.json().catch(() => ({}))
    const question = cleanText(body.question)
    if (!question) return NextResponse.json({ ok: false, error: 'Ask CHAS a question first.' }, { status: 400 })

    const [quote, session] = await Promise.all([loadQuote(id), getSession()])
    if (!quote) return NextResponse.json({ ok: false, error: 'Quote not found.' }, { status: 404 })

    const history = await prisma.chasMessage.findMany({
      where: {
        company: 'furlads',
        sessionId: sessionKey(id),
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { question: true, answer: true },
    })

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured.')

    const openai = new OpenAI({ apiKey })
    const recentConversation = history
      .reverse()
      .map((row) => `User: ${row.question}\nCHAS: ${row.answer}`)
      .join('\n\n')

    const context = [
      `Quote #${quote.id}`,
      `Status: ${quote.status}`,
      `Customer: ${quote.customerName || 'Not entered'}`,
      `Postcode: ${quote.customerPostcode || 'Not entered'}`,
      `Scope: ${quote.scope}`,
      `Price ex VAT: £${quote.priceExVat.toFixed(2)}`,
      `VAT: £${quote.vatAmount.toFixed(2)}`,
      `Total inc VAT: £${quote.totalIncVat.toFixed(2)}`,
      `Deposit: ${quote.depositPercent}% / £${quote.depositAmount.toFixed(2)}`,
      `Estimated duration: ${quote.estimatedDays ?? 'Not set'} working days`,
      `Estimated team: ${quote.estimatedTeamSize ?? 'Not set'} people`,
      `Internal notes: ${quote.internalNotes || 'None'}`,
      `How the quote was priced / CHAS working: ${quote.quoteWorking || 'No stored pricing working'}`,
      `Current customer message: ${quote.customerMessage || 'Not drafted'}`,
      `Linked accepted job: ${quote.jobId || 'None yet'}`,
    ].join('\n')

    const decisionResponse = await openai.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      instructions: `You are CHAS helping Trev or Kelly operate one Furlads landscaping quote in the office.

Be straightforward. Answer the question first. Do not give process lectures, legalistic caveats, or tell them to perform system steps that the app can do itself.

First decide whether the latest message is:
- review: a question, challenge, explanation request, calculation request, or suggestion that does NOT clearly ask you to change the stored quote; or
- correct_quote: Trev/Kelly explicitly corrects, removes, replaces, clarifies or changes part of the quote and expects the quote itself to be updated. Phrases such as "remove option C", "change it to", "update the quote", "that's wrong", "she actually wants", "I meant", "correct that", or equivalent clear instructions mean correct_quote.

For correct_quote, correctedScope must be the complete replacement scope after applying the requested change. Preserve everything that remains valid. Remove anything the user explicitly removes. If the quote contains Options A/B/C/D and they say remove C, return the full remaining A/B/D scope with C absent.

For review:
- Give the useful number or conclusion first.
- Use the stored pricing working when available.
- If exact material/labour costs are not stored, give the best sensible estimate and label it briefly as an estimate; do not ramble about ledgers, procurement systems or timesheets unless the user asks.
- Keep answers concise, practical and commercial.

Important rules:
- Never invent work, materials or extras that are not in the current/corrected scope.
- A clear correction instruction is authority to update the quote, even if the quote was previously sent, accepted or linked to a job. Do NOT tell the user to reopen it first.
- If an accepted/linked quote is changed, the app will preserve the link and refresh or flag the job plan after the quote update.
- If the corrected quote still contains several valid packages/options, that is fine. Do not refuse the correction just because it is multi-option.
- Return ONLY valid JSON with exactly this structure:
{
  "intent": "review" or "correct_quote",
  "answer": "short direct internal reply",
  "correctedScope": "only for correct_quote, otherwise empty"
}`,
      input: `CURRENT QUOTE\n${context}\n\n${recentConversation ? `RECENT REVIEW CHAT\n${recentConversation}\n\n` : ''}LATEST MESSAGE\n${question}`,
    })

    const decision = extractJson(decisionResponse.output_text || '')
    let answer = cleanText(decision?.answer) || 'I could not produce a useful answer.'
    let quoteUpdated = false

    if (decision?.intent === 'correct_quote') {
      const correctedScope = cleanText(decision.correctedScope)
      if (!correctedScope) {
        answer = 'I understand the change, but I could not turn it into a clear replacement scope. I have not changed anything yet.'
      } else {
        const pricingResponse = await fetch(new URL('/api/ai/quote', request.url), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'price',
            customerName: quote.customerName,
            jobDetails: correctedScope,
            additionalInstructions: 'This is an explicit office correction to an existing quote. Treat the corrected scope as authoritative. Price only the work that remains. If it contains multiple packages/options, preserve them and calculate only valid combinations. Recalculate labour, materials, programme and margin from scratch. Do not carry forward removed options or superseded scope.',
          }),
        })
        const pricing = await pricingResponse.json().catch(() => null)

        if (!pricingResponse.ok) {
          throw new Error(pricing?.error || 'CHAS could not reprice the corrected scope.')
        }

        const quoteMode = cleanText(pricing?.quoteMode) || (pricing?.optionMode ? 'packages' : 'single')
        const options = Array.isArray(pricing?.options) ? pricing.options : []
        const combinedOffers = Array.isArray(pricing?.combinedOffers)
          ? pricing.combinedOffers
          : pricing?.combinedOffer
            ? [pricing.combinedOffer]
            : []

        const priceExVat = cleanNumber(pricing?.recommendedPriceExVat)
        const vatRate = cleanNumber(pricing?.vatRate, 20)
        const vatAmount = cleanNumber(pricing?.vatAmount)
        const totalIncVat = cleanNumber(pricing?.recommendedTotalIncVat)
        const depositPercent = cleanNumber(pricing?.depositPercent, quote.depositPercent || 25)
        const depositAmount = cleanNumber(pricing?.depositAmount)
        const estimatedDays = cleanNumber(pricing?.estimatedDuration?.workingDays)
        const estimatedTeamSize = Math.max(1, Math.round(cleanNumber(pricing?.estimatedDuration?.teamSize, 1)))

        if (priceExVat <= 0) {
          throw new Error('CHAS returned the corrected scope without a usable selling price.')
        }

        const messageResponse = await fetch(new URL('/api/ai/quote', request.url), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'write',
            customerName: quote.customerName,
            quoteMode,
            options,
            combinedOffers,
            combinedOffer: combinedOffers[0] || null,
            jobDetails: correctedScope,
            additionalInstructions: pricing?.optionMode
              ? 'Rewrite this corrected multi-option quote from Kelly in the normal warm Furlads style. Show only the remaining options and valid combinations. Do not mention any removed option. Keep all commercial figures exact.'
              : 'Rewrite this corrected quote from Kelly in the normal warm Furlads style. Keep the corrected scope and commercial figures exact. Kelly is the main point of contact from here.',
            priceExVat,
            vatRate,
            depositPercent,
          }),
        })
        const messageData = await messageResponse.json().catch(() => null)
        const customerMessage = messageResponse.ok
          ? cleanText(messageData?.whatsappQuote)
          : quote.customerMessage

        const wasAcceptedOrLinked = quote.status === 'accepted' || Boolean(quote.jobId)
        const amendmentNote = `CHAS AMENDMENT: ${question}`
        const internalNotes = [quote.internalNotes, amendmentNote]
          .filter(Boolean)
          .join('\n\n')

        await prisma.quote.update({
          where: { id },
          data: {
            scope: correctedScope,
            quoteWorking: formatPricingWorking(pricing),
            priceExVat,
            vatRate,
            vatAmount,
            totalIncVat,
            depositPercent,
            depositAmount,
            estimatedDays: estimatedDays > 0 ? estimatedDays : null,
            estimatedTeamSize,
            customerMessage: customerMessage || null,
            internalNotes,
            status: wasAcceptedOrLinked ? quote.status : 'needs_review',
          },
        })

        quoteUpdated = true

        let jobMessage = ''
        if (quote.jobId) {
          try {
            const planResponse = await fetch(new URL(`/api/landscaping/jobs/${quote.jobId}/plan`, request.url), {
              method: 'POST',
            })
            jobMessage = planResponse.ok
              ? ` Linked job #${quote.jobId} has been refreshed too.`
              : ` Linked job #${quote.jobId} still needs its worker plan refreshing.`
          } catch {
            jobMessage = ` Linked job #${quote.jobId} still needs its worker plan refreshing.`
          }
        }

        const optionNote = pricing?.optionMode
          ? ` The remaining options/packages have been rebuilt without the removed work.`
          : ''

        answer = `Done — I've updated the quote and repriced it.${optionNote}\n\nNew reference price: ${money(priceExVat)} + VAT (${money(totalIncVat)} inc VAT). Deposit: ${money(depositAmount)}.${estimatedDays > 0 ? ` Programme: ${estimatedDays} working day(s) with ${estimatedTeamSize} ${estimatedTeamSize === 1 ? 'person' : 'people'}.` : ''}${jobMessage}`
      }
    }

    const worker = cleanText(session?.workerName) || 'Office'
    const workerId = session?.workerId && Number.isInteger(Number(session.workerId))
      ? Number(session.workerId)
      : null

    const saved = await prisma.chasMessage.create({
      data: {
        company: 'furlads',
        worker,
        workerId,
        jobId: quote.jobId || null,
        question,
        answer,
        sessionId: sessionKey(id),
        conversationId: sessionKey(id),
        intent: quoteUpdated ? 'quote_correction_applied' : 'quote_review',
        confidence: 0.9,
        safetyFlag: false,
      },
      select: {
        id: true,
        question: true,
        answer: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ ok: true, message: saved, quoteUpdated })
  } catch (error) {
    console.error('QUOTE CHAS ERROR', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Could not ask CHAS about this quote.' },
      { status: 500 }
    )
  }
}
