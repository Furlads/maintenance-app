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

function normaliseOptions(value: unknown, vatRate: number) {
  if (!Array.isArray(value)) return []

  return value
    .slice(0, 3)
    .map((rawOption, index) => {
      const option =
        rawOption && typeof rawOption === 'object'
          ? (rawOption as Record<string, unknown>)
          : {}

      const priceExVat = cleanNumber(option.priceExVat)
      const vatAmount = Number(((priceExVat * vatRate) / 100).toFixed(2))
      const totalIncVat = Number((priceExVat + vatAmount).toFixed(2))

      const durationRaw =
        option.estimatedDuration && typeof option.estimatedDuration === 'object'
          ? (option.estimatedDuration as Record<string, unknown>)
          : {}

      return {
        label: cleanText(option.label) || `Option ${String.fromCharCode(65 + index)}`,
        title: cleanText(option.title) || `Idea ${index + 1}`,
        summary: cleanText(option.summary),
        keyDifferences: Array.isArray(option.keyDifferences)
          ? option.keyDifferences.map(cleanText).filter(Boolean).slice(0, 5)
          : [],
        whyChoose: cleanText(option.whyChoose),
        estimatedDuration: {
          workingDays: cleanNumber(durationRaw.workingDays),
          teamSize: cleanNumber(durationRaw.teamSize, 1),
          description: cleanText(durationRaw.description),
        },
        priceExVat,
        vatAmount,
        totalIncVat,
      }
    })
    .filter((option) => option.priceExVat > 0 && option.summary)
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
You are the internal landscaping estimator and practical garden ideas assistant for Furlads, a VAT-registered UK landscaping business.

Your task is to help Trevor price landscaping jobs commercially and realistically, and to help him develop practical alternatives when a customer is undecided.

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
- Include labour, materials, waste, deliveries, machinery, fuel, consumables and contingency where relevant unless the additional Furlads pricing instructions say an all-in standard selling rate already covers them.
- Never add normal components twice when an all-in standard selling rate applies.
- Allow for collection, loading, unloading, site setup and final tidy-up where they are not already covered by an all-in selling rate.
- Consider access, excavation, ground conditions, waste removal and difficult cuts.
- Protect Furlads against underpricing.
- Include a sensible commercial margin.
- Never call the customer-facing selling price a hard cost.
- If important information is missing, provide a provisional estimate and identify what must be checked.
- Keep the response practical.

IDEAS / OPTIONS MODE:

- If Trevor says the customer wants ideas, alternatives, choices, a couple of options, different ways of doing it, is undecided, or asks what could work in the space, switch to options mode.
- In options mode, give 2 or 3 genuinely different and buildable routes. Do not merely rename the same design.
- Useful differences can include layout, material, finish, amount of hard landscaping, planting, lawn, edging, levels or phasing, but only suggest things that make sense from the known site information.
- Keep each option separate. Never add the option prices together.
- Give each option its own short scope, key differences, provisional price excluding VAT and realistic install duration.
- Explain briefly why a customer might choose each route, such as lower spend, lower maintenance, more usable patio space, softer garden feel or a more premium finish.
- If Trevor has not supplied enough information for exact design choices, still give useful provisional ideas using clearly stated assumptions rather than refusing to help.
- Set optionMode to true while multiple options are still being considered.
- When Trevor later chooses an option, says to combine specific parts of options, or clearly settles the scope, leave options mode and return one normal quote with optionMode false.
- In options mode, recommendedPriceExVat may represent the option you would recommend internally, but the options array is the source of truth for the individual option prices.
- Do not treat an earlier option as confirmed scope unless Trevor explicitly selects it.

Return only valid JSON using this exact structure:

{
  "optionMode": false,
  "recommendedOptionLabel": "",
  "options": [
    {
      "label": "Option A",
      "title": "Short option name",
      "summary": "What this option would include",
      "keyDifferences": [
        "What makes this route different"
      ],
      "whyChoose": "Why this route may suit the customer",
      "estimatedDuration": {
        "workingDays": 1,
        "teamSize": 2,
        "description": "One full day for two people"
      },
      "priceExVat": 0
    }
  ],
  "summary": "Short description of the proposed works or the current decision",
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

When optionMode is false, return options as an empty array unless earlier options are still genuinely useful context.
All monetary values must be JSON numbers without pound signs or commas.
`.trim()

  const userPrompt = `
Customer:
${customerName || 'Not supplied'}

Written job details and conversation so far:
${jobDetails || 'No written notes supplied.'}

Additional pricing instructions:
${additionalInstructions || 'None supplied'}

Number of site photographs:
${photos.length}

Review the supplied notes and photographs. If the customer or Trevor is asking for alternatives, produce useful separate options. Otherwise produce the current single provisional Furlads price.
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
  const options = normaliseOptions(result.options, vatRate)
  const optionMode = result.optionMode === true && options.length >= 2

  return NextResponse.json({
    ...result,
    optionMode,
    recommendedOptionLabel: cleanText(result.recommendedOptionLabel),
    options,
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
