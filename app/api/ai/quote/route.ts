import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type QuoteAction = 'price' | 'write'

type QuoteRequest = {
  action?: QuoteAction
  customerName?: string
  jobDetails?: string
  additionalInstructions?: string
  priceExVat?: number
  vatRate?: number
  depositPercent?: number
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function cleanNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function extractJson(value: string) {
  const trimmed = value.trim()

  try {
    return JSON.parse(trimmed)
  } catch {
    const firstBrace = trimmed.indexOf('{')
    const lastBrace = trimmed.lastIndexOf('}')

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error('The AI did not return valid JSON.')
    }

    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1))
  }
}

function createClient() {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY has not been added to the app environment variables.'
    )
  }

  return new OpenAI({ apiKey })
}

async function runOpenAI(systemPrompt: string, userPrompt: string) {
  const openai = createClient()

  const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    instructions: systemPrompt,
    input: userPrompt,
  })

  const output = response.output_text

  if (!output?.trim()) {
    throw new Error('The AI returned an empty response.')
  }

  return extractJson(output)
}

async function priceJob(body: QuoteRequest) {
  const customerName = cleanText(body.customerName)
  const jobDetails = cleanText(body.jobDetails)
  const additionalInstructions = cleanText(body.additionalInstructions)

  if (!jobDetails) {
    return NextResponse.json(
      { error: 'Enter the job details before pricing the job.' },
      { status: 400 }
    )
  }

  const systemPrompt = `
You are the internal landscaping estimator for Furlads, a VAT-registered UK landscaping business.

Your task is to help Trevor price landscaping jobs commercially and realistically.

Important rules:

- Work in pounds sterling.
- All recommended selling prices must be excluding VAT.
- VAT will be calculated separately by the app.
- Do not create fake measurements, quantities or supplier prices.
- Clearly separate confirmed information from estimates.
- Include labour, materials, waste, delivery, machinery, fuel, consumables and contingency where relevant.
- Allow for collection time, loading, unloading, site setup and final tidy-up.
- Consider access, ground conditions, excavation, waste removal and difficult cuts.
- Protect the business against underpricing.
- Do not simply add the visible costs together.
- Include a sensible commercial margin.
- Never call the customer-facing price a cost. Call it the recommended selling price.
- If important information is missing, still provide a provisional estimate but identify what must be checked.
- Keep the response practical for a working landscaping business.

Return only valid JSON using this exact structure:

{
  "summary": "Short description of the proposed works",
  "confirmedInformation": [
    "Confirmed item"
  ],
  "assumptions": [
    "Assumption used when pricing"
  ],
  "missingInformation": [
    "Important question or measurement still needed"
  ],
  "estimatedDuration": {
    "workingDays": 1,
    "teamSize": 2,
    "description": "One full day for two people"
  },
  "costBreakdown": [
    {
      "category": "Materials",
      "description": "Description",
      "estimatedCost": 0
    }
  ],
  "estimatedHardCosts": 0,
  "recommendedPriceExVat": 0,
  "vatRate": 20,
  "vatAmount": 0,
  "recommendedTotalIncVat": 0,
  "depositPercent": 25,
  "depositAmount": 0,
  "pricingNotes": [
    "Internal note"
  ]
}

All monetary values must be JSON numbers without pound signs or commas.
`.trim()

  const userPrompt = `
Customer:
${customerName || 'Not supplied'}

Job details:
${jobDetails}

Additional pricing instructions:
${additionalInstructions || 'None supplied'}

Price this job for Furlads.
`.trim()

  const result = await runOpenAI(systemPrompt, userPrompt)

  const priceExVat = cleanNumber(result.recommendedPriceExVat)
  const vatRate = cleanNumber(result.vatRate, 20)
  const vatAmount = Number(((priceExVat * vatRate) / 100).toFixed(2))
  const totalIncVat = Number((priceExVat + vatAmount).toFixed(2))

  const depositPercent = cleanNumber(result.depositPercent, 25)
  const depositAmount = Number(
    ((totalIncVat * depositPercent) / 100).toFixed(2)
  )

  return NextResponse.json({
    ...result,
    recommendedPriceExVat: priceExVat,
    vatRate,
    vatAmount,
    recommendedTotalIncVat: totalIncVat,
    depositPercent,
    depositAmount,
  })
}

async function writeQuote(body: QuoteRequest) {
  const customerName = cleanText(body.customerName)
  const jobDetails = cleanText(body.jobDetails)
  const additionalInstructions = cleanText(body.additionalInstructions)

  const priceExVat = cleanNumber(body.priceExVat)
  const vatRate = cleanNumber(body.vatRate, 20)
  const depositPercent = cleanNumber(body.depositPercent, 25)

  if (!jobDetails) {
    return NextResponse.json(
      { error: 'Enter the job details before writing the quote.' },
      { status: 400 }
    )
  }

  if (priceExVat <= 0) {
    return NextResponse.json(
      { error: 'Enter or generate a valid price excluding VAT.' },
      { status: 400 }
    )
  }

  const vatAmount = Number(((priceExVat * vatRate) / 100).toFixed(2))
  const totalIncVat = Number((priceExVat + vatAmount).toFixed(2))
  const depositAmount = Number(
    ((totalIncVat * depositPercent) / 100).toFixed(2)
  )

  const systemPrompt = `
You write customer quotations for Furlads, a friendly professional landscaping company.

The quotation will normally be sent directly through WhatsApp.

Write in Trevor and Furlads' natural style:

- Warm, friendly and confident.
- Excited about the finished transformation.
- Detailed enough that the customer understands exactly what is included.
- Easy to scan on WhatsApp.
- Use short paragraphs and clear bullet points.
- Use a small number of suitable emojis, such as 👋, ✅ or 🌿.
- Do not make the message childish or overloaded with emojis.
- Never sound like a generic corporate quotation.
- Do not use aggressive sales language.
- Do not call the total an investment unless it sounds natural.
- Never invent work, materials, guarantees, timescales or exclusions.
- Do not change the supplied price.
- Explain how the finished garden will look or feel.
- Include a clear, relaxed next step.
- Mention the deposit only when the deposit percentage is greater than zero.
- The deposit is calculated from the VAT-inclusive total.
- Do not say the quote is attached.
- Do not say the customer has already accepted.
- Do not claim that a diary space has been reserved.
- The finished text must be ready to copy directly into WhatsApp.

The preferred format is:

Hi [name] 👋

Friendly introduction.

A short paragraph describing the transformation and why the proposed design will work well.

Here's everything we've included:

✅ Scope item
✅ Scope item

Price:
£X + VAT
VAT: £X
Total: £X

Deposit wording where applicable.

Friendly closing inviting questions, changes or approval.

Thanks,
Trevor
Furlads 🌿

Return only valid JSON using this structure:

{
  "whatsappQuote": "Complete customer-ready WhatsApp message",
  "scopeItems": [
    "Scope item"
  ],
  "customerSummary": "Short transformation-focused summary",
  "warnings": [
    "Anything that Trevor should check before sending"
  ]
}
`.trim()

  const userPrompt = `
Customer name:
${customerName || 'Customer'}

Confirmed job details:
${jobDetails}

Additional wording instructions:
${additionalInstructions || 'None supplied'}

Confirmed pricing:
Price excluding VAT: £${priceExVat.toFixed(2)}
VAT rate: ${vatRate}%
VAT amount: £${vatAmount.toFixed(2)}
Total including VAT: £${totalIncVat.toFixed(2)}
Deposit percentage: ${depositPercent}%
Deposit amount: £${depositAmount.toFixed(2)}

Write the finished Furlads WhatsApp quotation.
`.trim()

  const result = await runOpenAI(systemPrompt, userPrompt)

  return NextResponse.json({
    ...result,
    priceExVat,
    vatRate,
    vatAmount,
    totalIncVat,
    depositPercent,
    depositAmount,
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as QuoteRequest
    const action = body.action

    if (action === 'price') {
      return await priceJob(body)
    }

    if (action === 'write') {
      return await writeQuote(body)
    }

    return NextResponse.json(
      { error: 'Choose either the price or write action.' },
      { status: 400 }
    )
  } catch (error) {
    console.error('AI quote error:', error)

    const message =
      error instanceof Error
        ? error.message
        : 'Something went wrong while generating the quote.'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}