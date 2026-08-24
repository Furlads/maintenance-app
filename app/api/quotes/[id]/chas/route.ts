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
      instructions: `You are CHAS reviewing one Furlads landscaping quote with Trev or Kelly in the office.

First decide whether the latest message is:
- review: a question, challenge, explanation request, or suggestion that does NOT clearly tell you the stored scope is wrong; or
- correct_quote: Trev/Kelly explicitly corrects, replaces, clarifies or changes what the customer actually wants and expects the quote to be updated/repriced. Phrases such as "no sorry", "that's wrong", "she actually wants", "change it to", "I meant", "correct that", or an equivalent clear correction normally mean correct_quote.

For correct_quote, write correctedScope as a clean, concise scope using the latest correction as authoritative. Preserve any parts of the existing scope that are clearly still valid, but do not preserve an earlier misunderstanding that the correction replaces.

For review, answer questions about price, scope, duration, team size, assumptions, omissions, risk and customer wording using the supplied quote as source of truth.

Important rules:
- Never invent work, materials or extras that are not in the current/corrected scope.
- If the user is clearly correcting a draft quote, do not merely explain what should change: classify it as correct_quote so the app can re-run the real pricing engine.
- Accepted quotes are protected. The app will refuse to alter them unless deliberately reopened elsewhere.
- Keep review answers practical and commercially useful.
- Return ONLY valid JSON with exactly this structure:
{
  "intent": "review" or "correct_quote",
  "answer": "short internal reply",
  "correctedScope": "only for correct_quote, otherwise empty"
}`,
      input: `CURRENT QUOTE\n${context}\n\n${recentConversation ? `RECENT REVIEW CHAT\n${recentConversation}\n\n` : ''}LATEST MESSAGE\n${question}`,
    })

    const decision = extractJson(decisionResponse.output_text || '')
    let answer = cleanText(decision?.answer) || 'CHAS could not produce a useful answer.'
    let quoteUpdated = false

    if (decision?.intent === 'correct_quote') {
      if (quote.status === 'accepted' || quote.jobId) {
        answer = 'I understand that as a correction to the quote, but this quote is already accepted/linked to a job. Reopen it for amendment first so we do not silently move the agreed commercial baseline.'
      } else {
        const correctedScope = cleanText(decision.correctedScope)
        if (!correctedScope) {
          answer = 'I understood that as a correction, but I could not turn it into a clear replacement scope. Nothing has been changed.'
        } else {
          const pricingResponse = await fetch(new URL('/api/ai/quote', request.url), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'price',
              customerName: quote.customerName,
              jobDetails: correctedScope,
              additionalInstructions: 'This is an office correction to an existing draft quote. Treat the corrected scope as authoritative, price only that work, and recalculate labour, materials, programme and margin from scratch. Do not carry forward assumptions from the earlier misunderstood scope unless they are still stated here.',
            }),
          })
          const pricing = await pricingResponse.json().catch(() => null)

          if (!pricingResponse.ok) {
            throw new Error(pricing?.error || 'CHAS could not reprice the corrected scope.')
          }

          if (pricing?.optionMode) {
            answer = 'I understood the correction, but it now looks like a multi-option/package quote. I have not overwritten the existing quote because that needs the full options workflow rather than a single headline price.'
          } else {
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
                quoteMode: 'single',
                jobDetails: correctedScope,
                additionalInstructions: 'Rewrite this corrected quote from Kelly in the normal warm Furlads style. Keep the corrected scope and commercial figures exact. Kelly is the main point of contact from here.',
                priceExVat,
                vatRate,
                depositPercent,
              }),
            })
            const messageData = await messageResponse.json().catch(() => null)
            const customerMessage = messageResponse.ok
              ? cleanText(messageData?.whatsappQuote)
              : quote.customerMessage

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
                status: 'needs_review',
              },
            })

            quoteUpdated = true
            answer = `Corrected and repriced. I have updated the actual quote to: ${correctedScope}\n\nNew price: ${money(priceExVat)} + VAT (${money(totalIncVat)} inc VAT).${estimatedDays > 0 ? ` Programme: ${estimatedDays} working day(s) with ${estimatedTeamSize} ${estimatedTeamSize === 1 ? 'person' : 'people'}.` : ''}\n\nThe quote is back in Needs Review so Kelly can sense-check it before sending.`
          }
        }
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
