import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type QuoteAction = 'price' | 'write'
type QuoteMode = 'single' | 'alternatives' | 'packages'

type QuotePhoto = {
  url?: string
  label?: string
}

type DurationInput = {
  workingDays?: number
  teamSize?: number
  description?: string
}

type QuoteOptionInput = {
  label?: string
  title?: string
  summary?: string
  keyDifferences?: string[]
  whyChoose?: string
  estimatedDuration?: DurationInput
  priceExVat?: number
}

type CombinedOfferInput = {
  available?: boolean
  label?: string
  summary?: string
  includedOptionLabels?: string[]
  savingReason?: string
  estimatedDuration?: DurationInput
  priceExVat?: number
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
  quoteMode?: QuoteMode
  options?: QuoteOptionInput[]
  combinedOffer?: CombinedOfferInput | null
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function cleanNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function roundUpToHalfDay(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.ceil(value * 2) / 2
}

function normaliseQuoteMode(value: unknown): QuoteMode {
  if (value === 'alternatives' || value === 'packages') return value
  return 'single'
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

function normaliseDuration(value: unknown, fallbackTeamSize = 2) {
  const duration =
    value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {}

  return {
    workingDays: roundUpToHalfDay(cleanNumber(duration.workingDays)),
    teamSize: Math.max(1, Math.round(cleanNumber(duration.teamSize, fallbackTeamSize))),
    description: cleanText(duration.description),
  }
}

function normaliseOptions(value: unknown, vatRate: number) {
  if (!Array.isArray(value)) return []

  return value
    .slice(0, 6)
    .map((rawOption, index) => {
      const option =
        rawOption && typeof rawOption === 'object'
          ? (rawOption as Record<string, unknown>)
          : {}

      const priceExVat = cleanNumber(option.priceExVat)
      const vatAmount = Number(((priceExVat * vatRate) / 100).toFixed(2))
      const totalIncVat = Number((priceExVat + vatAmount).toFixed(2))

      return {
        label: cleanText(option.label) || `Option ${String.fromCharCode(65 + index)}`,
        title: cleanText(option.title) || `Option ${index + 1}`,
        summary: cleanText(option.summary),
        keyDifferences: Array.isArray(option.keyDifferences)
          ? option.keyDifferences.map(cleanText).filter(Boolean).slice(0, 6)
          : [],
        whyChoose: cleanText(option.whyChoose),
        estimatedDuration: normaliseDuration(option.estimatedDuration),
        priceExVat,
        vatAmount,
        totalIncVat,
      }
    })
    .filter((option) => option.priceExVat > 0 && option.summary)
}

function normaliseCombinedOffer(
  value: unknown,
  vatRate: number,
  options: ReturnType<typeof normaliseOptions>,
  quoteMode: QuoteMode
) {
  if (quoteMode !== 'packages' || !value || typeof value !== 'object') {
    return null
  }

  const raw = value as Record<string, unknown>
  if (raw.available !== true || options.length < 2) return null

  const separateTotal = Number(
    options.reduce((sum, option) => sum + option.priceExVat, 0).toFixed(2)
  )

  let priceExVat = cleanNumber(raw.priceExVat)
  if (priceExVat <= 0) return null

  // Protect margin: buying everything together may create genuine shared
  // efficiencies, but CHAS must not invent a huge discount just to make the
  // combined figure look attractive.
  const lowestSensibleCombinedPrice = Number((separateTotal * 0.9).toFixed(2))
  priceExVat = Math.max(priceExVat, lowestSensibleCombinedPrice)
  priceExVat = Math.min(priceExVat, separateTotal)

  const vatAmount = Number(((priceExVat * vatRate) / 100).toFixed(2))
  const totalIncVat = Number((priceExVat + vatAmount).toFixed(2))
  const savingExVat = Number((separateTotal - priceExVat).toFixed(2))

  const rawDuration = normaliseDuration(raw.estimatedDuration)
  const totalPackageDays = options.reduce(
    (sum, option) => sum + Math.max(0, option.estimatedDuration.workingDays),
    0
  )
  const longestPackageDays = options.reduce(
    (longest, option) => Math.max(longest, option.estimatedDuration.workingDays),
    0
  )

  // Shared setup, deliveries and tidy-up can save some time, but they cannot
  // make most of the physical installation disappear. Allow no more than a
  // 20% reduction from the summed package crew-days.
  const minimumCombinedDays = roundUpToHalfDay(
    Math.max(longestPackageDays, totalPackageDays * 0.8)
  )

  const workingDays = Math.max(rawDuration.workingDays, minimumCombinedDays)

  return {
    available: true,
    label: cleanText(raw.label) || 'If all completed together',
    summary: cleanText(raw.summary),
    includedOptionLabels: Array.isArray(raw.includedOptionLabels)
      ? raw.includedOptionLabels.map(cleanText).filter(Boolean).slice(0, 8)
      : options.map((option) => option.label),
    savingReason: cleanText(raw.savingReason),
    priceExVat,
    vatAmount,
    totalIncVat,
    separateTotalExVat: separateTotal,
    savingExVat,
    estimatedDuration: {
      ...rawDuration,
      workingDays,
      description:
        rawDuration.description ||
        `${workingDays} working days allowing only for genuine shared setup and logistics efficiencies`,
    },
  }
}

function optionSummaryForPrompt(options: ReturnType<typeof normaliseOptions>) {
  return options
    .map((option) => {
      const duration = option.estimatedDuration
      return [
        `${option.label} — ${option.title}`,
        option.summary,
        `Price ex VAT: £${option.priceExVat.toFixed(2)}`,
        `VAT: £${option.vatAmount.toFixed(2)}`,
        `Total inc VAT: £${option.totalIncVat.toFixed(2)}`,
        duration.workingDays
          ? `Install: ${duration.workingDays} working days with ${duration.teamSize} ${duration.teamSize === 1 ? 'person' : 'people'}`
          : '',
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n\n')
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
You are CHAS, the internal landscaping estimator and practical garden ideas assistant for Furlads, a VAT-registered UK landscaping business.

Your job is to help Trevor turn a real site visit into a commercially sensible quotation. Customers often want choices before they decide, so do not force a multi-choice enquiry into one blended quote.

You may receive written survey notes and site photographs.

PHOTO REVIEW RULES:
- Inspect photographs carefully for visible factors affecting labour, materials, access, waste or machinery.
- Look for restricted access, steps, slopes, level changes, retaining requirements, drains, manholes, tree roots, existing concrete, fragile property, utility boxes, difficult cuts, large waste volumes and obstacles.
- Never claim certainty from a photograph alone.
- Do not infer exact measurements from photographs.
- Do not invent hidden ground conditions.
- If photographs contradict the written notes, flag the contradiction.
- Do not identify or make personal comments about people visible in photographs.

PRICING RULES:
- Work in pounds sterling.
- Recommended selling prices are excluding VAT. VAT is calculated separately by the app.
- Do not invent exact supplier prices.
- Clearly separate confirmed information from estimates.
- Follow any supplied Furlads all-in selling rates. If an all-in rate applies, do not add normal labour, materials, waste, machinery, delivery or margin a second time.
- Only add genuine exceptional extras not covered by the applicable standard rate.
- Protect Furlads against underpricing and arbitrary discounting.
- A combined "all done together" price may be lower than buying packages separately only where there are genuine shared efficiencies such as one setup, shared deliveries, shared plant, shared waste handling or one final tidy-up.
- Do not invent a discount. If there is little or no genuine saving, the combined price may equal the sum of the individual packages.
- Keep the response practical.

QUOTE MODE — CHOOSE THE RIGHT STRUCTURE:
1. single
   Use when the customer has one settled scope and wants one price.

2. alternatives
   Use when the customer is deciding between mutually exclusive ideas, materials, layouts or finishes. Give 2–3 genuinely different alternatives. Each alternative gets its own description, price and duration. The customer can choose one later. Do NOT add alternative prices together and normally do NOT provide an all-together price for mutually exclusive alternatives.

3. packages
   Use when the customer wants separate prices for work that can be bought independently, or when a larger enquiry naturally breaks into separate jobs. Examples: front fence, rear fence, artificial grass area, patio, drainage, retaining wall. Give each logical package its own description, price and duration. If the packages can sensibly be completed during one mobilisation, also give an "If all completed together" price and combined duration.

If the customer asks for "options", decide whether they mean alternatives, separate packages, or both. Do not make Trevor choose before the customer has seen the choices. A multi-option/package quotation is itself a valid quote that can be sent to Kelly for review.

REALISTIC INSTALL-TIME RULES — IMPORTANT:
- Duration is an operational production estimate, not sales wording. Never compress a large scope into an attractive but physically impossible number of days.
- Estimate actual working days for the stated team size.
- Break the work into physical operations: removal/excavation, loading/spoil, setting out, foundations/sub-base, compaction, posts, concrete, cutting, laying/fitting, edging, finishing and tidy-up.
- Distinct trades or work types do not magically happen at the same time just because they are sold together.
- Multiple separate areas reduce productivity because of repeated setting out, cuts, edges, transitions and moving materials.
- For standard fencing as a planning sanity check, a two-person team in ordinary access/ground should not normally be assumed to install dramatically more than roughly 5–7 standard bays per working day once holes, posts, concrete, panels/boards, levels and tidy-up are considered. Removal, awkward ground, corners, slopes or restricted access slow this further.
- For artificial grass with full ground preparation as a planning sanity check, a two-person team should normally be thought of in the region of roughly 20–30m² per working day in ordinary conditions once excavation, spoil, sub-base, compaction, laying, cutting, edging and tidy-up are included. Several separate areas usually push the output toward the slower end.
- These are sanity checks, not rigid production rates. Use the actual site information and explain material deviations.
- For package quotes, estimate each package separately first. The combined duration should normally be the sum of package crew-days minus only modest shared setup/logistics efficiencies. Never reduce combined duration by more than about 20% without a very specific physical reason.
- Round uncertain durations UP to the nearest half day rather than down.
- If a duration looks aggressive, choose the safer realistic figure and say what could change it.

IDEAS RULES:
- If the customer wants inspiration, give buildable ideas rather than vague design language.
- Explain briefly why each route may suit them: lower spend, lower maintenance, more usable space, softer feel, premium finish, easier phasing, etc.
- If information is missing, still provide useful provisional options using clearly stated assumptions.
- Do not treat an earlier idea as confirmed scope unless Trevor or the customer selects it.

Return only valid JSON using this exact structure:
{
  "quoteMode": "single",
  "optionMode": false,
  "recommendedOptionLabel": "",
  "options": [
    {
      "label": "Option A",
      "title": "Short option or package name",
      "summary": "Exactly what this price includes",
      "keyDifferences": ["What makes this different or what is included"],
      "whyChoose": "Why this may suit the customer",
      "estimatedDuration": {
        "workingDays": 1,
        "teamSize": 2,
        "description": "How the duration was arrived at"
      },
      "priceExVat": 0
    }
  ],
  "combinedOffer": {
    "available": false,
    "label": "If all completed together",
    "summary": "What is included when all packages are completed in one mobilisation",
    "includedOptionLabels": ["Package 1", "Package 2"],
    "savingReason": "Only the genuine shared efficiencies",
    "estimatedDuration": {
      "workingDays": 1,
      "teamSize": 2,
      "description": "Realistic combined duration"
    },
    "priceExVat": 0
  },
  "summary": "Short description of the current proposal",
  "confirmedInformation": ["Confirmed fact"],
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
      "pricingImpact": "Possible effect on price or duration"
    }
  ],
  "assumptions": ["Assumption used"],
  "missingInformation": ["Important check still needed"],
  "estimatedDuration": {
    "workingDays": 1,
    "teamSize": 2,
    "description": "Realistic duration for the headline scope"
  },
  "costBreakdown": [],
  "estimatedHardCosts": 0,
  "recommendedPriceExVat": 0,
  "vatRate": 20,
  "vatAmount": 0,
  "recommendedTotalIncVat": 0,
  "depositPercent": 25,
  "depositAmount": 0,
  "pricingNotes": ["Internal note"]
}

STRUCTURE RULES FOR THE JSON:
- single: optionMode false, options [], combinedOffer.available false.
- alternatives: optionMode true, quoteMode alternatives, normally 2–3 options, combinedOffer.available false.
- packages: optionMode true, quoteMode packages, 2–6 logical packages, and combinedOffer.available true when doing all packages together makes commercial/operational sense.
- For packages, recommendedPriceExVat should normally be the combined all-together price when a combinedOffer is available. Otherwise it may be the sum of the package prices.
- For alternatives, recommendedPriceExVat may be the internally preferred alternative, but each option price remains separate.
- All monetary values must be JSON numbers without pound signs or commas.
`.trim()

  const userPrompt = `
Customer:
${customerName || 'Not supplied'}

Written job details and conversation so far:
${jobDetails || 'No written notes supplied.'}

Additional Furlads pricing instructions:
${additionalInstructions || 'None supplied'}

Number of site photographs:
${photos.length}

Work out the correct quote structure first: single, alternatives or separately purchasable packages. Then price it and give a realistic install duration based on what a human crew can actually complete.
`.trim()

  const result = await runOpenAI({
    systemPrompt,
    userPrompt,
    photos,
  })

  const vatRate = cleanNumber(result.vatRate, 20)
  let quoteMode = normaliseQuoteMode(result.quoteMode)
  const options = normaliseOptions(result.options, vatRate)

  if (quoteMode !== 'single' && options.length < 2) {
    quoteMode = 'single'
  }

  const combinedOffer = normaliseCombinedOffer(
    result.combinedOffer,
    vatRate,
    options,
    quoteMode
  )

  let priceExVat = cleanNumber(result.recommendedPriceExVat)
  let estimatedDuration = normaliseDuration(result.estimatedDuration)

  if (quoteMode === 'packages' && options.length >= 2) {
    if (combinedOffer) {
      priceExVat = combinedOffer.priceExVat
      estimatedDuration = combinedOffer.estimatedDuration
    } else {
      const packageTotal = Number(
        options.reduce((sum, option) => sum + option.priceExVat, 0).toFixed(2)
      )
      if (packageTotal > 0) priceExVat = packageTotal

      const packageDays = roundUpToHalfDay(
        options.reduce(
          (sum, option) => sum + option.estimatedDuration.workingDays,
          0
        )
      )
      if (packageDays > estimatedDuration.workingDays) {
        estimatedDuration = {
          workingDays: packageDays,
          teamSize: Math.max(
            1,
            ...options.map((option) => option.estimatedDuration.teamSize)
          ),
          description: 'Sum of the separately estimated package working days.',
        }
      }
    }
  }

  if (quoteMode === 'alternatives' && options.length >= 2) {
    const recommendedLabel = cleanText(result.recommendedOptionLabel)
    const recommended =
      options.find((option) => option.label === recommendedLabel) || options[0]

    if (recommended) {
      priceExVat = recommended.priceExVat
      estimatedDuration = recommended.estimatedDuration
    }
  }

  const vatAmount = Number(((priceExVat * vatRate) / 100).toFixed(2))
  const totalIncVat = Number((priceExVat + vatAmount).toFixed(2))
  const depositPercent = cleanNumber(result.depositPercent, 25)
  const depositAmount = Number(
    ((totalIncVat * depositPercent) / 100).toFixed(2)
  )

  return NextResponse.json({
    ...result,
    quoteMode,
    optionMode: quoteMode !== 'single' && options.length >= 2,
    recommendedOptionLabel: cleanText(result.recommendedOptionLabel),
    options,
    combinedOffer,
    estimatedDuration,
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
  const quoteMode = normaliseQuoteMode(body.quoteMode)
  const vatRate = cleanNumber(body.vatRate, 20)
  const depositPercent = cleanNumber(body.depositPercent, 25)
  const options = normaliseOptions(body.options, vatRate)
  const combinedOffer = normaliseCombinedOffer(
    body.combinedOffer,
    vatRate,
    options,
    quoteMode
  )

  let priceExVat = cleanNumber(body.priceExVat)

  if (quoteMode === 'packages' && combinedOffer) {
    priceExVat = combinedOffer.priceExVat
  } else if (quoteMode === 'packages' && options.length >= 2 && priceExVat <= 0) {
    priceExVat = Number(
      options.reduce((sum, option) => sum + option.priceExVat, 0).toFixed(2)
    )
  } else if (quoteMode === 'alternatives' && options.length >= 2 && priceExVat <= 0) {
    priceExVat = options[0].priceExVat
  }

  if (!jobDetails && options.length === 0) {
    return NextResponse.json(
      {
        error: 'Enter the confirmed scope of work before writing the quotation.',
      },
      { status: 400 }
    )
  }

  if (priceExVat <= 0) {
    return NextResponse.json(
      {
        error: 'Enter or generate a valid quotation price.',
      },
      { status: 400 }
    )
  }

  const vatAmount = Number(((priceExVat * vatRate) / 100).toFixed(2))
  const totalIncVat = Number((priceExVat + vatAmount).toFixed(2))
  const depositAmount = Number(
    ((totalIncVat * depositPercent) / 100).toFixed(2)
  )

  const isMultiQuote = quoteMode !== 'single' && options.length >= 2

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
- Never change any supplied prices or durations.
- Do not include internal pricing concerns.
- Do not say the quote is attached.
- Do not say the customer has already accepted.
- Do not claim a diary space is reserved.

MULTI-OPTION QUOTES:
- A customer may receive several prices before making any decision. That is intentional.
- For alternatives, present each alternative separately and make it clear they can choose whichever route suits them.
- For packages, present each separately purchasable package with its own description and price.
- If an "If all completed together" offer is supplied, show it clearly after the individual packages, including the exact combined price and the genuine reason for any saving.
- Do not add mutually exclusive alternatives together.
- Do not force the customer to choose before seeing the prices.
- For a multi-option quote, do not present the internal headline/reference price as though it is the only quote price.
- If deposits vary depending on what is selected, say the deposit is calculated against the works they choose rather than cluttering every option with a deposit figure. If there is one combined offer, you may state its deposit only when helpful.

SINGLE QUOTES:
- Explain the finished result, list the scope, then show Price, VAT and Total clearly.

Return only valid JSON using this exact structure:
{
  "whatsappQuote": "Complete customer-ready WhatsApp message",
  "scopeItems": ["Scope item"],
  "customerSummary": "Short transformation-focused summary",
  "warnings": ["Anything Trevor should check before sending"]
}
`.trim()

  const combinedText = combinedOffer
    ? [
        `${combinedOffer.label}`,
        combinedOffer.summary,
        `Price ex VAT: £${combinedOffer.priceExVat.toFixed(2)}`,
        `VAT: £${combinedOffer.vatAmount.toFixed(2)}`,
        `Total inc VAT: £${combinedOffer.totalIncVat.toFixed(2)}`,
        `Saving vs separate packages ex VAT: £${combinedOffer.savingExVat.toFixed(2)}`,
        combinedOffer.savingReason
          ? `Reason for saving: ${combinedOffer.savingReason}`
          : '',
        combinedOffer.estimatedDuration.workingDays
          ? `Install: ${combinedOffer.estimatedDuration.workingDays} working days with ${combinedOffer.estimatedDuration.teamSize} ${combinedOffer.estimatedDuration.teamSize === 1 ? 'person' : 'people'}`
          : '',
      ]
        .filter(Boolean)
        .join('\n')
    : 'No combined offer supplied.'

  const userPrompt = `
Customer name:
${customerName || 'Customer'}

Quote mode:
${quoteMode}

Confirmed general scope / context:
${jobDetails || 'Use the priced options/packages below.'}

Priced options or packages:
${options.length ? optionSummaryForPrompt(options) : 'None — this is a single quote.'}

Combined all-together offer:
${combinedText}

Additional wording instructions:
${additionalInstructions || 'None supplied'}

Internal headline/reference pricing used by the app:
Price excluding VAT: £${priceExVat.toFixed(2)}
VAT rate: ${vatRate}%
VAT amount: £${vatAmount.toFixed(2)}
Total including VAT: £${totalIncVat.toFixed(2)}
Deposit percentage: ${depositPercent}%
Deposit amount on the headline/reference total: £${depositAmount.toFixed(2)}

${
  isMultiQuote
    ? 'Write a customer-ready options/package quotation showing every supplied price separately. The customer has NOT decided yet.'
    : 'Write the finished single Furlads WhatsApp quotation.'
}
`.trim()

  const result = await runOpenAI({
    systemPrompt,
    userPrompt,
  })

  return NextResponse.json({
    ...result,
    quoteMode,
    options,
    combinedOffer,
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
