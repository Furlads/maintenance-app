import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateLandscapingPlan } from '@/lib/landscaping-plan'
import { applyAndSaveMaterialPolicy } from '@/lib/landscaping-material-policy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STANDARD_VAT_RATE = 20

type RouteContext = {
  params: {
    id: string
  }
}

type CostRow = {
  category: string
  amount: number
  detail: string
}

type AmendmentResult = {
  summary?: string
  updatedScope?: string
  updatedQuoteWorking?: string
  updatedCustomerMessage?: string
  estimatedDays?: number | null
  estimatedTeamSize?: number | null
  costBreakdown?: CostRow[]
  estimatedHardCosts?: number
  notes?: string[]
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

function validId(value: string) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

function extractJson(value: string) {
  const trimmed = value.trim()

  try {
    return JSON.parse(trimmed)
  } catch {
    const firstBrace = trimmed.indexOf('{')
    const lastBrace = trimmed.lastIndexOf('}')
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error('CHAS did not return a usable amendment preview.')
    }
    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1))
  }
}

function normaliseCostBreakdown(value: unknown): CostRow[] {
  if (!Array.isArray(value)) return []

  return value
    .map((row) => {
      if (!row || typeof row !== 'object') return null
      const record = row as Record<string, unknown>
      const category = cleanText(record.category)
      const amount = roundMoney(Math.max(0, cleanNumber(record.amount)))
      const detail = cleanText(record.detail)
      if (!category || amount <= 0) return null
      return { category, amount, detail }
    })
    .filter((row): row is CostRow => row !== null)
    .slice(0, 20)
}

function calculateFigures(priceExVat: number, depositPercent: number) {
  const vatAmount = roundMoney((priceExVat * STANDARD_VAT_RATE) / 100)
  const totalIncVat = roundMoney(priceExVat + vatAmount)
  const depositAmount = roundMoney((totalIncVat * depositPercent) / 100)

  return {
    priceExVat: roundMoney(priceExVat),
    vatRate: STANDARD_VAT_RATE,
    vatAmount,
    totalIncVat,
    depositPercent,
    depositAmount,
  }
}

function gpPercent(sellingPriceExVat: number, hardCosts: number) {
  if (sellingPriceExVat <= 0 || hardCosts < 0) return null
  return roundMoney(((sellingPriceExVat - hardCosts) / sellingPriceExVat) * 100)
}

function updateJobNotes(
  currentNotes: string | null,
  quoteId: number,
  oldTotal: number,
  newTotal: number,
  estimatedDays: number | null,
  estimatedTeamSize: number | null
) {
  const lines = (currentNotes || '').split('\n').filter(Boolean)
  const filtered = lines.filter(
    (line) =>
      !line.startsWith(`Quoted total:`) &&
      !line.startsWith(`Estimated install:`) &&
      !line.startsWith(`Latest quote amendment:`)
  )

  return [
    ...filtered,
    `Quoted total: £${newTotal.toFixed(2)} inc VAT`,
    estimatedDays
      ? `Estimated install: ${estimatedDays} day(s) with ${estimatedTeamSize || 1} person/people`
      : null,
    `Latest quote amendment: Quote #${quoteId} changed from £${oldTotal.toFixed(2)} to £${newTotal.toFixed(2)} inc VAT`,
  ]
    .filter(Boolean)
    .join('\n')
}

async function buildPreview({
  quote,
  instruction,
  requestedTotalIncVat,
}: {
  quote: {
    id: number
    status: string
    jobId: number | null
    customerName: string | null
    scope: string
    customerMessage: string | null
    internalNotes: string | null
    quoteWorking: string | null
    priceExVat: number
    vatAmount: number
    totalIncVat: number
    depositPercent: number
    depositAmount: number
    estimatedDays: number | null
    estimatedTeamSize: number | null
  }
  instruction: string
  requestedTotalIncVat: number | null
}) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured.')

  const openai = new OpenAI({ apiKey })
  const fixedPriceInstruction =
    requestedTotalIncVat && requestedTotalIncVat > 0
      ? `The office has explicitly set the revised customer TOTAL INCLUDING VAT to £${requestedTotalIncVat.toFixed(2)}. Do not alter that figure and do not change underlying job costs merely because the selling price changed.`
      : 'No manual customer-total override has been entered. Preserve the current selling price unless the amendment instruction explicitly changes it.'

  const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    instructions: `You are CHAS applying a deliberate amendment to an existing Furlads landscaping quote.

This is an INTERNAL commercial amendment tool. Return only valid JSON.

Rules:
- Apply the office instruction exactly and only as far as requested.
- If asked to remove an option/package (for example "remove Option C completely"), remove that option everywhere it appears: scope, stored quote working, combinations/totals and customer message. Preserve every other option unless the instruction says otherwise.
- Keep customer wording coherent after structural changes. Do not leave references to deleted options.
- Extract the REAL internal job-cost breakdown from the stored pricing working when it supports one. Categories should distinguish Materials, Labour, Plant, Waste, Deliveries/Logistics, Specialists, Contingency or other genuine costs. Do not call margin/overhead/lost selling value "labour".
- costBreakdown is internal COST, never customer selling values.
- estimatedHardCosts must equal the costBreakdown total where a supported breakdown exists.
- If the stored working does not support an exact cost, do not invent it. Return the supported rows only and explain the gap in notes.
- A manual selling-price override changes revenue and GP only. It must NOT change materials, labour or other job costs.
- Preserve realistic duration/team unless the scope amendment genuinely changes them.
- Do not add new work or materials.
- Keep quoteWorking useful as an internal audit/pricing explanation.

Return exactly this shape:
{
  "summary": "Short description of what will change",
  "updatedScope": "Complete revised scope",
  "updatedQuoteWorking": "Complete revised internal pricing working",
  "updatedCustomerMessage": "Complete revised customer-facing message",
  "estimatedDays": 0,
  "estimatedTeamSize": 0,
  "costBreakdown": [{"category":"Materials","amount":0,"detail":"Supported internal cost detail"}],
  "estimatedHardCosts": 0,
  "notes": ["Any limitation or important consequence"]
}`,
    input: `CURRENT QUOTE
Quote #${quote.id}
Status: ${quote.status}
Linked job: ${quote.jobId || 'none'}
Customer: ${quote.customerName || 'Customer'}
Current price ex VAT: £${quote.priceExVat.toFixed(2)}
Current VAT: £${quote.vatAmount.toFixed(2)}
Current total inc VAT: £${quote.totalIncVat.toFixed(2)}
Deposit: ${quote.depositPercent}% / £${quote.depositAmount.toFixed(2)}
Duration: ${quote.estimatedDays ?? 'not set'} working days
Team: ${quote.estimatedTeamSize ?? 'not set'}

CURRENT SCOPE
${quote.scope}

CURRENT INTERNAL PRICING WORKING
${quote.quoteWorking || 'No stored pricing working.'}

CURRENT INTERNAL NOTES
${quote.internalNotes || 'None'}

CURRENT CUSTOMER MESSAGE
${quote.customerMessage || 'None'}

OFFICE AMENDMENT INSTRUCTION
${instruction || 'No structural wording change requested; preview the manual price override only.'}

PRICE RULE
${fixedPriceInstruction}`,
  })

  const raw = extractJson(response.output_text || '') as AmendmentResult
  const costBreakdown = normaliseCostBreakdown(raw.costBreakdown)
  const breakdownTotal = roundMoney(costBreakdown.reduce((sum, row) => sum + row.amount, 0))
  const suppliedHardCosts = roundMoney(Math.max(0, cleanNumber(raw.estimatedHardCosts)))
  const estimatedHardCosts = breakdownTotal > 0 ? breakdownTotal : suppliedHardCosts

  const revisedPriceExVat =
    requestedTotalIncVat && requestedTotalIncVat > 0
      ? roundMoney(requestedTotalIncVat / 1.2)
      : quote.priceExVat
  const figures = calculateFigures(revisedPriceExVat, quote.depositPercent)

  const revisedScope = cleanText(raw.updatedScope) || quote.scope
  const revisedQuoteWorking = cleanText(raw.updatedQuoteWorking) || quote.quoteWorking || ''
  const revisedCustomerMessage = cleanText(raw.updatedCustomerMessage) || quote.customerMessage || ''
  const estimatedDays =
    raw.estimatedDays == null
      ? quote.estimatedDays
      : Math.max(0.5, cleanNumber(raw.estimatedDays, quote.estimatedDays || 0.5))
  const estimatedTeamSize =
    raw.estimatedTeamSize == null
      ? quote.estimatedTeamSize
      : Math.max(1, Math.round(cleanNumber(raw.estimatedTeamSize, quote.estimatedTeamSize || 1)))

  return {
    summary: cleanText(raw.summary) || 'Commercial quote amendment',
    before: {
      priceExVat: quote.priceExVat,
      vatAmount: quote.vatAmount,
      totalIncVat: quote.totalIncVat,
      depositAmount: quote.depositAmount,
      estimatedDays: quote.estimatedDays,
      estimatedTeamSize: quote.estimatedTeamSize,
    },
    after: {
      ...figures,
      scope: revisedScope,
      quoteWorking: revisedQuoteWorking,
      customerMessage: revisedCustomerMessage,
      estimatedDays,
      estimatedTeamSize,
      estimatedHardCosts,
      grossProfit: estimatedHardCosts > 0 ? roundMoney(figures.priceExVat - estimatedHardCosts) : null,
      grossMarginPercent: estimatedHardCosts > 0 ? gpPercent(figures.priceExVat, estimatedHardCosts) : null,
      costBreakdown,
    },
    notes: Array.isArray(raw.notes) ? raw.notes.map(cleanText).filter(Boolean) : [],
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const id = validId(params.id)
    if (!id) return NextResponse.json({ ok: false, error: 'Invalid quote id.' }, { status: 400 })

    const body = await request.json().catch(() => ({}))
    const mode = cleanText(body.mode) === 'apply' ? 'apply' : 'preview'
    const instruction = cleanText(body.instruction)
    const requestedTotal = cleanNumber(body.totalIncVatOverride)
    const requestedTotalIncVat = requestedTotal > 0 ? roundMoney(requestedTotal) : null

    if (!instruction && !requestedTotalIncVat) {
      return NextResponse.json(
        { ok: false, error: 'Enter a change or a revised all-in customer price first.' },
        { status: 400 }
      )
    }

    const quote = await prisma.quote.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        jobId: true,
        customerName: true,
        scope: true,
        customerMessage: true,
        internalNotes: true,
        quoteWorking: true,
        priceExVat: true,
        vatAmount: true,
        totalIncVat: true,
        depositPercent: true,
        depositAmount: true,
        estimatedDays: true,
        estimatedTeamSize: true,
        job: { select: { id: true, title: true, notes: true, durationMinutes: true } },
      },
    })

    if (!quote) return NextResponse.json({ ok: false, error: 'Quote not found.' }, { status: 404 })

    const preview = await buildPreview({ quote, instruction, requestedTotalIncVat })

    if (mode === 'preview') {
      return NextResponse.json({ ok: true, mode, preview })
    }

    const after = preview.after
    const oldSnapshot = {
      scope: quote.scope,
      priceExVat: quote.priceExVat,
      vatAmount: quote.vatAmount,
      totalIncVat: quote.totalIncVat,
      depositAmount: quote.depositAmount,
      estimatedDays: quote.estimatedDays,
      estimatedTeamSize: quote.estimatedTeamSize,
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedQuote = await tx.quote.update({
        where: { id: quote.id },
        data: {
          scope: after.scope,
          customerMessage: after.customerMessage || null,
          quoteWorking: after.quoteWorking || null,
          priceExVat: after.priceExVat,
          vatRate: STANDARD_VAT_RATE,
          vatAmount: after.vatAmount,
          totalIncVat: after.totalIncVat,
          depositPercent: after.depositPercent,
          depositAmount: after.depositAmount,
          estimatedDays: after.estimatedDays,
          estimatedTeamSize: after.estimatedTeamSize,
          status: quote.status === 'sent' ? 'ready_to_send' : quote.status,
        },
      })

      let updatedJob = quote.job
      if (quote.job) {
        updatedJob = await tx.job.update({
          where: { id: quote.job.id },
          data: {
            title: after.scope.slice(0, 180),
            durationMinutes: after.estimatedDays
              ? Math.max(60, Math.round(after.estimatedDays * 450))
              : null,
            notes: updateJobNotes(
              quote.job.notes,
              quote.id,
              quote.totalIncVat,
              after.totalIncVat,
              after.estimatedDays,
              after.estimatedTeamSize
            ),
          },
        })

        await tx.jobAuditLog.create({
          data: {
            jobId: quote.job.id,
            action: 'quote_commercial_amendment',
            beforeJson: JSON.stringify(oldSnapshot),
            afterJson: JSON.stringify({
              scope: after.scope,
              priceExVat: after.priceExVat,
              vatAmount: after.vatAmount,
              totalIncVat: after.totalIncVat,
              depositAmount: after.depositAmount,
              estimatedDays: after.estimatedDays,
              estimatedTeamSize: after.estimatedTeamSize,
              estimatedHardCosts: after.estimatedHardCosts,
              grossMarginPercent: after.grossMarginPercent,
            }),
          },
        })
      }

      await tx.chasMessage.create({
        data: {
          company: 'furlads',
          worker: 'Office',
          jobId: quote.jobId || null,
          question: instruction || `Change customer total to £${after.totalIncVat.toFixed(2)} inc VAT`,
          answer: `${preview.summary}. Total changed from £${quote.totalIncVat.toFixed(2)} to £${after.totalIncVat.toFixed(2)} inc VAT.${after.grossMarginPercent == null ? ' Exact GP could not be established from the stored costing.' : ` Revised GP: ${after.grossMarginPercent.toFixed(2)}%.`}`,
          sessionId: `quote-amendments-${quote.id}`,
          conversationId: `quote-amendments-${quote.id}`,
          intent: 'quote_amendment',
          confidence: 0.95,
          safetyFlag: false,
        },
      })

      return { quote: updatedQuote, job: updatedJob }
    })

    let planningWarning: string | null = null
    if (quote.jobId) {
      try {
        const generatedPlan = await generateLandscapingPlan(quote.jobId)
        await applyAndSaveMaterialPolicy(generatedPlan)
      } catch (error) {
        console.error('QUOTE AMENDMENT PLAN REGENERATION ERROR', error)
        planningWarning = 'The quote and job were updated, but the landscaping plan still needs regenerating.'
      }
    }

    return NextResponse.json({
      ok: true,
      mode,
      preview,
      quote: result.quote,
      job: result.job,
      planningWarning,
    })
  } catch (error) {
    console.error('QUOTE AMENDMENT ERROR', error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Could not amend quote.',
      },
      { status: 500 }
    )
  }
}
