import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type QuoteAction = 'price' | 'write'

type QuotePhoto = {
  url?: string
  label?: string
}

type QuoteRequest = {
  action?: QuoteAction
  customerName?: string
  jobDetails?: string
  additionalInstructions?: string
  priceExVat?: number
  vatRate?: number
  depositPercent?: number
  photos?: QuotePhoto[]
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function cleanNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function cleanPhotos(value: unknown): Array<{ url: string; label: string }> {
  if (!Array.isArray(value)) return []

  return value
    .map((photo) => {
      if (!photo || typeof photo !== 'object') return null

      const url = cleanText((photo as QuotePhoto).url)
      const label = cleanText((photo as QuotePhoto).label)

      if (!url || !url.startsWith('https://')) return null

      return {
        url,
        label: label || 'Site photo',
      }
    })
    .filter(
      (
        photo
      ): photo is {
        url: string
        label: string
      } => photo !== null
    )
    .slice(0, 12)
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

async function runOpenAI({
  systemPrompt,
  userPrompt,
  photos,
}: {
  systemPrompt: string
  userPrompt: string
  photos?: Array<{ url: string; label: string }>
}) {
  const openai = createClient()

  const content: Array<
    | {
        type: 'input_text'
        text: string
      }
    | {
        type: 'input_image'
        image_url: string
        detail: 'auto'
      }
  > = [
    {
      type: 'input_text',
      text: userPrompt,
    },
  ]

  for (const photo of photos || []) {
    content.push({
      type: 'input_text',
      text: `Photo label: ${photo.label}`,
    })

    content.push({
      type: 'input_image',
      image_url: photo.url,
      detail: 'auto',
    })
  }

  const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    instructions: systemPrompt,
    input: [
      {
        role: 'user',
        content,
      },
    ],
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
  const photos = cleanPhotos(body.photos)

  if (!jobDetails && photos.length === 0) {
    return NextResponse.json(
      {
        error:
          'Enter job details or upload site photos before pricing the job.',
      },
      { status: 400 }
    )
  }

  const systemPrompt = `
You are the internal landscaping estimator for Furlads, a VAT-registered UK landscaping business.

Your task is to help Trevor price landscaping jobs commercially and realistically.

You may receive written survey notes and site photographs.

PHOTO REVIEW RULES:

- Inspect the photographs carefully.
- Identify visible features that could affect labour, materials, access, waste or machinery.
- Look for restricted access, steps, slopes, level changes, retaining requirements, drains, manholes, tree roots, existing concrete, fragile property, utility boxes, difficult cuts, large waste volumes and obstacles.
- Never claim certainty from a photograph alone.
- Describe concerns as potential issues that Trevor should check.
- Do not infer exact measurements from photographs.
- Do not invent hidden ground conditions.
- If photographs contradict the written notes, clearly flag the contradiction.
- Do not identify or make personal comments about people visible in photographs.

PRICING RULES:

- Work in pounds sterling.
- All recommended selling prices must be excluding VAT.
- VAT will be calculated separately by the app.
- Do not invent exact supplier prices.
- Clearly separate confirmed information from estimates.
- Include labour, materials, waste, deliveries, machinery, fuel, consumables and contingency where relevant.
- Allow for collection, loading, unloading, site setup and final tidy-up.
- Consider access, excavation, ground conditions, waste removal and difficult cuts.
- Protect Furlads against underpricing.
- Include a sensible commercial margin.
- Never call the customer-facing selling price a hard cost.
- If important information is missing, provide a provisional estimate and identify what must be checked.
- Keep the response practical.

Return only valid JSON using this exact structure:

{
  "summary": "Short description of the proposed works",
  "confirmedInformation": [
    "Confirmed information from the notes or photographs"
  ],
  "photoObservations": [
    {
      "observation": "What appears visible",
      "potentialImpact": "How it could affect the job",
      "checkRequired": "What Trevor should confirm"
    }
  ],
  "potentialIssues": [
    {
      "title": "Potential issue",
      "details": "What may need checking",
      "pricingImpact": "Possible impact on price or duration"
    }
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

Written job details:
${jobDetails || 'No written notes supplied.'}

Additional pricing instructions:
${additionalInstructions || 'None supplied'}

Number of site photographs:
${photos.length}

Review the supplied notes and photographs, identify any potential issues and produce a provisional Furlads price.
`.trim()

  const result = await runOpenAI({
    systemPrompt,
    userPrompt,
    photos,
  })

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
      {
        error:
          'Enter the confirmed scope of work before writing the quotation.',
      },
      { status: 400 }
    )
  }

  if (priceExVat <= 0) {
    return NextResponse.json(
      {
        error: 'Enter or generate a valid price excluding VAT.',
      },
      { status: 400 }
    )
  }

  const vatAmount = Number(((priceExVat * vatRate) / 100).toFixed(2))
  const totalIncVat = Number((priceExVat + vatAmount).toFixed(2))
  const depositAmount = Number(
    ((totalIncVat * depositPercent) / 100).toFixed(2)
  )

  const systemPrompt = `
You write customer quotations for Furlads, a friendly and professional landscaping company.

The quotation will normally be sent directly through WhatsApp.

Write in Trevor and Furlads' natural style:

- Warm, friendly and confident.
- Make the customer feel excited about the finished transformation.
- Clearly explain exactly what is included.
- Make the message easy to scan on WhatsApp.
- Use short paragraphs and clear tick-point bullets.
- Use only a small number of suitable emojis.
- Do not sound like a generic corporate quotation.
- Do not use aggressive sales language.
- Never invent work, guarantees, materials or timescales.
- Do not change the supplied price.
- Do not include internal pricing concerns.
- Do not mention issues identified from photographs unless Trevor included them within the confirmed scope.
- Explain how the finished garden should look or feel.
- Include a clear and relaxed next step.
- Mention the deposit only when the percentage is greater than zero.
- Calculate the deposit from the VAT-inclusive total.
- Do not say the quote is attached.
- Do not say the customer has already accepted.
- Do not claim that a diary space is already reserved.
- The result must be ready to copy directly into WhatsApp.

Preferred format:

Hi [name] 👋

Friendly opening.

Brief and exciting description of the finished result.

Here's everything we've included:

✅ Scope item
✅ Scope item

Price: £X + VAT
VAT: £X
Total: £X

Deposit wording where applicable.

Friendly closing inviting questions, changes or approval.

Thanks,
Trevor
Furlads 🌿

Return only valid JSON using this exact structure:

{
  "whatsappQuote": "Complete customer-ready WhatsApp message",
  "scopeItems": [
    "Scope item"
  ],
  "customerSummary": "Short transformation-focused summary",
  "warnings": [
    "Anything Trevor should check before sending"
  ]
}
`.trim()

  const userPrompt = `
Customer name:
${customerName || 'Customer'}

Confirmed scope of works:
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

  const result = await runOpenAI({
    systemPrompt,
    userPrompt,
  })

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

    if (body.action === 'price') {
      return await priceJob(body)
    }

    if (body.action === 'write') {
      return await writeQuote(body)
    }

    return NextResponse.json(
      {
        error: 'Choose either the price or write action.',
      },
      { status: 400 }
    )
  } catch (error) {
    console.error('AI quote error:', error)

    const message =
      error instanceof Error
        ? error.message
        : 'Something went wrong while generating the quote.'

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 }
    )
  }
}