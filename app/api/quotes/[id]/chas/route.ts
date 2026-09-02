import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VAT_RATE = 20

type RouteContext = {
  params: {
    id: string
  }
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

function roundMoney(value: number) {
  return Number(value.toFixed(2))
}

function money(value: unknown) {
  return `£${cleanNumber(value).toFixed(2)}`
}

function sessionKey(quoteId: number) {
  return `quote-review-${quoteId}`
}

function isExplicitCorrection(question: string) {
  const text = question.toLowerCase()
  return [
    'remove ',
    'delete ',
    'take out',
    'change ',
    'update ',
    'correct ',
    'replace ',
    'make the agreed price',
    'make the price',
    'agreed price',
    'accepted price',
    'she actually wants',
    'they actually want',
    'customer wants',
    'i meant',
    "that's wrong",
    'that is wrong',
  ].some((phrase) => text.includes(phrase))
}

function extractAllInOverride(question: string) {
  const text = question.replace(/,/g, '')
  const allIn = /(?:£\s*)?(\d+(?:\.\d{1,2})?)\s*(?:all\s*in|inc(?:luding)?\s*vat|including\s*vat)/i.exec(text)
  if (allIn) return cleanNumber(allIn[1])

  const accepted = /(?:agreed|accepted)\s*price[^£\d]*(?:£\s*)?(\d+(?:\.\d{1,2})?)/i.exec(text)
  if (accepted && /(?:all\s*in|inc(?:luding)?\s*vat|including\s*vat)/i.test(text)) {
    return cleanNumber(accepted[1])
  }

  return 0
}

function buildCorrectedScope(pricing: Record<string, any>, fallback: string) {
  const summary = cleanText(pricing.summary)
  const confirmed = Array.isArray(pricing.confirmedInformation)
    ? pricing.confirmedInformation.map((item: unknown) => cleanText(item)).filter(Boolean)
    : []
  const options = Array.isArray(pricing.options) ? pricing.options : []

  const optionText = options
    .map((option: any) => {
      const label = cleanText(option.label) || cleanText(option.title)
      const detail = cleanText(option.summary)
      return [label, detail].filter(Boolean).join(' — ')
    })
    .filter(Boolean)

  return [summary, ...confirmed, ...optionText].filter(Boolean).join('\n') || fallback
}

function buildCustomerMessage(args: {
  customerName: string | null
  scope: string
  priceExVat: number
  vatAmount: number
  totalIncVat: number
  depositPercent: number
  depositAmount: number
}) {
  const firstName = cleanText(args.customerName).split(/\s+/)[0]
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,'

  return [
    greeting,
    '',
    'Following the changes discussed, I have updated your quotation so it now reflects the agreed scope:',
    '',
    args.scope,
    '',
    `Price: ${money(args.priceExVat)} + VAT`,
    `VAT: ${money(args.vatAmount)}`,
    `Total: ${money(args.totalIncVat)} including VAT`,
    `${args.depositPercent}% deposit: ${money(args.depositAmount)}`,
    '',
    'This updated quotation replaces the previous version.',
    '',
    'If you are happy with everything, just let me know and I can take care of the next steps for you.',
    '',
    'Kelly',
    'Furlads',
  ].join('\n')
}

function formatPricingWorking(pricing: Record<string, any>) {
  const rows = Array.isArray(pricing.costBreakdown) ? pricing.costBreakdown : []
  const warnings = Array.isArray(pricing.warningFlags) ? pricing.warningFlags : []
  const notes = Array.isArray(pricing.pricingNotes) ? pricing.pricingNotes : []
  const labour = pricing.labourSummary && typeof pricing.labourSummary === 'object'
    ? pricing.labourSummary
    : null

  return [
    'CHAS REPRICE — OFFICE CORRECTION APPLIED',
    pricing.officePriceOverrideIncVat
      ? `OFFICE-APPROVED CUSTOMER TOTAL: ${money(pricing.officePriceOverrideIncVat)} inc VAT`
      : '',
    pricing.officePriceOverrideIncVat
      ? 'Selling price manually approved by the office; direct job costs were not changed by the price override.'
      : '',
    cleanText(pricing.summary) ? `Scope summary: ${cleanText(pricing.summary)}` : '',
    `Selling price ex VAT: ${money(pricing.recommendedPriceExVat)}`,
    `Estimated direct cost: ${money(pricing.estimatedHardCosts)}`,
    pricing.achievedGrossMargin == null
      ? ''
      : `Estimated gross margin: ${cleanNumber(pricing.achievedGrossMargin).toFixed(1)}%`,
    pricing.estimatedDuration?.workingDays
      ? `Programme: ${pricing.estimatedDuration.workingDays} working day(s) with ${pricing.estimatedDuration.teamSize || 1} people`
      : '',
    labour
      ? `Labour: ${cleanNumber(labour.manDays).toFixed(1)} man-day(s), internal cost ${money(labour.estimatedCost)}`
      : '',
    rows.length ? 'COST BREAKDOWN' : '',
    ...rows.map((row: any) => `- ${cleanText(row.category)}: ${money(row.amount)}${cleanText(row.detail) ? ` — ${cleanText(row.detail)}` : ''}`),
    notes.length ? 'PRICING NOTES' : '',
    ...notes.map((item: unknown) => `- ${cleanText(item)}`),
    warnings.length ? 'WARNINGS' : '',
    ...warnings.map((item: unknown) => `- ${cleanText(item)}`),
  ].filter(Boolean).join('\n')
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

async function saveChasMessage(args: {
  quoteId: number
  jobId: number | null
  session: any
  question: string
  answer: string
  quoteUpdated: boolean
}) {
  const worker = cleanText(args.session?.workerName) || 'Office'
  const workerId = args.session?.workerId && Number.isInteger(Number(args.session.workerId))
    ? Number(args.session.workerId)
    : null

  return prisma.chasMessage.create({
    data: {
      company: 'furlads',
      worker,
      workerId,
      jobId: args.jobId,
      question: args.question,
      answer: args.answer,
      sessionId: sessionKey(args.quoteId),
      conversationId: sessionKey(args.quoteId),
      intent: args.quoteUpdated ? 'quote_correction_applied' : 'quote_review',
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
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const id = validId(params.id)
    if (!id) return NextResponse.json({ ok: false, error: 'Invalid quote id.' }, { status: 400 })

    const quote = await loadQuote(id)
    if (!quote) return NextResponse.json({ ok: false, error: 'Quote not found.' }, { status: 404 })

    const messages = await prisma.chasMessage.findMany({
      where: { company: 'furlads', sessionId: sessionKey(id) },
      orderBy: { createdAt: 'asc' },
      take: 30,
      select: { id: true, question: true, answer: true, createdAt: true },
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

    if (isExplicitCorrection(question)) {
      const pricingResponse = await fetch(new URL('/api/ai/quote', request.url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'price',
          customerName: quote.customerName,
          jobDetails: [
            'CURRENT QUOTE SCOPE',
            quote.scope,
            '',
            'OFFICE CHANGE TO APPLY',
            question,
          ].join('\n'),
          additionalInstructions:
            'Apply the office change to the current quote and reprice the COMPLETE corrected job from scratch. The office instruction is authoritative. Remove anything explicitly removed and preserve everything else that remains valid. Do not carry forward removed options. Recalculate materials, labour, plant, waste, logistics, programme and direct costs. Your summary and confirmed information must describe the complete corrected scope, not just the difference.',
        }),
      })

      const pricing = await pricingResponse.json().catch(() => null)
      if (!pricingResponse.ok) {
        throw new Error(pricing?.error || 'CHAS could not reprice the corrected scope.')
      }

      const correctedScope = buildCorrectedScope(pricing || {}, quote.scope)
      const depositPercent = cleanNumber(pricing?.depositPercent, quote.depositPercent || 25)
      const customerTotalOverride = extractAllInOverride(question)
      const hasCustomerTotalOverride = customerTotalOverride > 0

      let priceExVat = cleanNumber(pricing?.recommendedPriceExVat)
      let vatAmount = cleanNumber(pricing?.vatAmount)
      let totalIncVat = cleanNumber(pricing?.recommendedTotalIncVat)
      let depositAmount = cleanNumber(pricing?.depositAmount)

      if (hasCustomerTotalOverride) {
        totalIncVat = roundMoney(customerTotalOverride)
        priceExVat = roundMoney(totalIncVat / 1.2)
        vatAmount = roundMoney(totalIncVat - priceExVat)
        depositAmount = roundMoney((totalIncVat * depositPercent) / 100)

        const directCost = cleanNumber(pricing?.estimatedHardCosts)
        const grossProfit = roundMoney(priceExVat - directCost)
        const grossMargin = priceExVat > 0 ? roundMoney((grossProfit / priceExVat) * 100) : 0

        pricing.recommendedPriceExVat = priceExVat
        pricing.vatRate = VAT_RATE
        pricing.vatAmount = vatAmount
        pricing.recommendedTotalIncVat = totalIncVat
        pricing.depositPercent = depositPercent
        pricing.depositAmount = depositAmount
        pricing.achievedGrossMargin = grossMargin
        pricing.officePriceOverrideIncVat = totalIncVat
        pricing.pricingNotes = [
          ...(Array.isArray(pricing.pricingNotes) ? pricing.pricingNotes : []),
          `Office-approved customer total set to £${totalIncVat.toFixed(2)} inc VAT. Direct job costs were not changed by this selling-price override.`,
        ]
        if (grossMargin < 30) {
          pricing.warningFlags = Array.from(new Set([
            ...(Array.isArray(pricing.warningFlags) ? pricing.warningFlags : []),
            'Office-approved selling price is below the 30% gross-margin target.',
          ]))
        }
      }

      if (priceExVat <= 0 || totalIncVat <= 0) {
        throw new Error('CHAS returned the corrected scope without a usable selling price.')
      }

      if (!vatAmount) vatAmount = roundMoney((priceExVat * VAT_RATE) / 100)
      if (!totalIncVat) totalIncVat = roundMoney(priceExVat + vatAmount)
      if (!depositAmount) depositAmount = roundMoney((totalIncVat * depositPercent) / 100)

      const estimatedDays = cleanNumber(pricing?.estimatedDuration?.workingDays)
      const estimatedTeamSize = Math.max(1, Math.round(cleanNumber(pricing?.estimatedDuration?.teamSize, 1)))
      const customerMessage = buildCustomerMessage({
        customerName: quote.customerName,
        scope: correctedScope,
        priceExVat,
        vatAmount,
        totalIncVat,
        depositPercent,
        depositAmount,
      })

      const internalNotes = [quote.internalNotes, `CHAS AMENDMENT: ${question}`]
        .filter(Boolean)
        .join('\n\n')

      await prisma.quote.update({
        where: { id },
        data: {
          scope: correctedScope,
          quoteWorking: formatPricingWorking(pricing || {}),
          priceExVat,
          vatRate: VAT_RATE,
          vatAmount,
          totalIncVat,
          depositPercent,
          depositAmount,
          estimatedDays: estimatedDays > 0 ? estimatedDays : null,
          estimatedTeamSize,
          customerMessage,
          internalNotes,
          status: quote.status === 'accepted' || quote.jobId ? quote.status : 'needs_review',
        },
      })

      const directCost = cleanNumber(pricing?.estimatedHardCosts)
      const grossProfit = directCost > 0 ? roundMoney(priceExVat - directCost) : null
      const grossMargin = grossProfit == null || priceExVat <= 0
        ? null
        : roundMoney((grossProfit / priceExVat) * 100)

      let answer = `Done — quote updated. New price: ${money(priceExVat)} + VAT (${money(totalIncVat)} inc VAT). VAT: ${money(vatAmount)}. Deposit: ${money(depositAmount)}.`
      if (grossMargin != null) {
        answer += ` Direct job cost: ${money(directCost)}. Gross profit: ${money(grossProfit)} (${grossMargin.toFixed(1)}% GP).${grossMargin < 30 ? ' ⚠️ Below the 30% target.' : ''}`
      }
      if (estimatedDays > 0) {
        answer += ` Programme: ${estimatedDays} working day(s) with ${estimatedTeamSize} ${estimatedTeamSize === 1 ? 'person' : 'people'}.`
      }
      if (quote.jobId) {
        answer += ` Linked job #${quote.jobId} will use the updated quote details; refresh its worker plan before site work if needed.`
      }

      const saved = await saveChasMessage({
        quoteId: id,
        jobId: quote.jobId || null,
        session,
        question,
        answer,
        quoteUpdated: true,
      })

      return NextResponse.json({ ok: true, message: saved, quoteUpdated: true, jobId: quote.jobId || null })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured.')

    const openai = new OpenAI({ apiKey })
    const reviewResponse = await openai.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      instructions: `You are CHAS helping Trev or Kelly review one Furlads landscaping quote. Answer the latest office question directly and concisely. Do not change the quote. Use the supplied figures and pricing working. If an exact cost is unavailable, say it is an estimate. Do not give process lectures.`,
      input: [
        `Quote #${quote.id}`,
        `Status: ${quote.status}`,
        `Customer: ${quote.customerName || 'Not entered'}`,
        `Scope: ${quote.scope}`,
        `Price ex VAT: ${money(quote.priceExVat)}`,
        `Total inc VAT: ${money(quote.totalIncVat)}`,
        `Deposit: ${quote.depositPercent}% / ${money(quote.depositAmount)}`,
        `Programme: ${quote.estimatedDays ?? 'Not set'} day(s), ${quote.estimatedTeamSize ?? 'Not set'} people`,
        `Pricing working: ${quote.quoteWorking || 'No stored pricing working'}`,
        `Question: ${question}`,
      ].join('\n'),
    })

    const answer = cleanText(reviewResponse.output_text) || 'I could not produce a useful answer.'
    const saved = await saveChasMessage({
      quoteId: id,
      jobId: quote.jobId || null,
      session,
      question,
      answer,
      quoteUpdated: false,
    })

    return NextResponse.json({ ok: true, message: saved, quoteUpdated: false })
  } catch (error) {
    console.error('QUOTE CHAS ERROR', error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error
          ? error.message
          : 'Nothing was changed. CHAS could not complete that request — please try again.',
      },
      { status: 500 }
    )
  }
}
