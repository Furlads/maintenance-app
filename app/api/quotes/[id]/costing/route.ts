import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { FURLADS_QUOTE_PRICING_RULES } from '@/lib/quotePricingRules'
import { compareCrewCosts } from '@/lib/crewCosting'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: { id: string } }

function cleanNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

function extractJson(value: string) {
  const text = value.trim()
  try {
    return JSON.parse(text)
  } catch {
    const first = text.indexOf('{')
    const last = text.lastIndexOf('}')
    if (first < 0 || last <= first) throw new Error('CHAS costing was not valid JSON.')
    return JSON.parse(text.slice(first, last + 1))
  }
}

function durationFromWorking(working: string | null) {
  const text = String(working || '')
  if (!text) return null

  // For packaged quotes, the all-together programme is the relevant office
  // planning duration. This also repairs older quotes where estimatedDays was
  // not persisted even though CHAS wrote the combined programme into working.
  const combined = text.match(/(?:Combined install|Likely combined install)\s*:\s*([0-9]+(?:\.5)?)\s*(?:working\s*)?days?\s+with\s+([0-9]+)/i)
  if (combined) {
    return {
      days: Number(combined[1]),
      teamSize: Number(combined[2]),
    }
  }

  const standard = text.match(/(?:Likely install|Install)\s*:\s*([0-9]+(?:\.5)?)\s*(?:working\s*)?days?\s+with\s+([0-9]+)/i)
  if (standard) {
    return {
      days: Number(standard[1]),
      teamSize: Number(standard[2]),
    }
  }

  return null
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const id = Number(params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, error: 'Invalid quote id.' }, { status: 400 })
    }

    const quote = await prisma.quote.findUnique({
      where: { id },
      select: {
        id: true,
        scope: true,
        quoteWorking: true,
        internalNotes: true,
        priceExVat: true,
        estimatedDays: true,
        estimatedTeamSize: true,
      },
    })

    if (!quote) {
      return NextResponse.json({ ok: false, error: 'Quote not found.' }, { status: 404 })
    }

    const workingDuration = durationFromWorking(quote.quoteWorking)
    const estimatedDays = quote.estimatedDays && quote.estimatedDays > 0
      ? quote.estimatedDays
      : workingDuration?.days ?? null
    const estimatedTeamSize = quote.estimatedTeamSize && quote.estimatedTeamSize > 0
      ? quote.estimatedTeamSize
      : workingDuration?.teamSize ?? null

    const crews = await prisma.crew.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        dayRate: true,
        durationMultiplier: true,
        skillLevel: true,
        suitableJobTypes: true,
        technicalSpecialist: true,
        summary: true,
        members: {
          select: {
            worker: {
              select: {
                firstName: true,
                lastName: true,
                transportRequired: true,
              },
            },
          },
        },
      },
    })

    const crewComparison = compareCrewCosts({
      scope: quote.scope,
      internalNotes: quote.internalNotes,
      estimatedDays,
      crews,
    })

    const sellingPriceExVat = quote.priceExVat
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured.')

    const openai = new OpenAI({ apiKey })
    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      instructions: `You are CHAS producing an INTERNAL office costing summary for Kelly before a Furlads quote is sent.

${FURLADS_QUOTE_PRICING_RULES}

Return only JSON. Reconstruct the most realistic DIRECT JOB COSTS from the stored quote scope and CHAS working. This is not a customer-facing breakdown.

Rules:
- labour is internal labour cost, not selling value;
- materials are purchase materials and consumables;
- plantWasteLogistics is plant hire, waste, deliveries and direct logistics;
- other is subcontractors or contingency only where genuinely needed;
- do not force the costs to equal the selling price;
- do not include profit or VAT in costs;
- if the stored working supports a figure, prefer it;
- if information is incomplete, give a sensible estimate and explain the uncertainty briefly;
- make totalDirectCost equal the four cost categories exactly;
- calculate grossProfitEstimate = selling price ex VAT - totalDirectCost;
- calculate grossMarginPercent from selling price ex VAT.

Use exactly this shape:
{
  "materials": 0,
  "labour": 0,
  "plantWasteLogistics": 0,
  "other": 0,
  "totalDirectCost": 0,
  "grossProfitEstimate": 0,
  "grossMarginPercent": 0,
  "labourManDays": 0,
  "notes": ["short internal note"]
}`,
      input: [
        `Quote #${quote.id}`,
        `Selling price ex VAT: £${sellingPriceExVat.toFixed(2)}`,
        `Estimated duration: ${estimatedDays ?? 'not set'} days`,
        `Estimated team size: ${estimatedTeamSize ?? 'not set'}`,
        `Scope: ${quote.scope}`,
        `Internal notes: ${quote.internalNotes || 'None'}`,
        `Stored CHAS working: ${quote.quoteWorking || 'None'}`,
      ].join('\n\n'),
    })

    const result = extractJson(response.output_text || '')
    const materials = cleanNumber(result.materials)
    const aiLabour = cleanNumber(result.labour)
    const recommendedCrew = crewComparison.options.find((option) => option.recommended)

    const labour = aiLabour > 0
      ? aiLabour
      : recommendedCrew?.totalLabourCost ?? 0

    const plantWasteLogistics = cleanNumber(result.plantWasteLogistics)
    const other = cleanNumber(result.other)
    const totalDirectCost = Number((materials + labour + plantWasteLogistics + other).toFixed(2))
    const grossProfitEstimate = Number((sellingPriceExVat - totalDirectCost).toFixed(2))
    const grossMarginPercent = sellingPriceExVat > 0
      ? Number(((grossProfitEstimate / sellingPriceExVat) * 100).toFixed(1))
      : 0

    return NextResponse.json({
      ok: true,
      costing: {
        materials,
        labour,
        plantWasteLogistics,
        other,
        totalDirectCost,
        grossProfitEstimate,
        grossMarginPercent,
        labourManDays: cleanNumber(result.labourManDays),
        notes: Array.isArray(result.notes)
          ? result.notes.map((item: unknown) => String(item || '').trim()).filter(Boolean).slice(0, 4)
          : [],
        crewComparison,
      },
    })
  } catch (error) {
    console.error('QUOTE COSTING SUMMARY ERROR', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Could not estimate quote costs.' },
      { status: 500 }
    )
  }
}
