import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import {
  FURLADS_QUOTE_PRICING_RULES,
  grossMarginPercent,
  sellingPriceForMargin,
} from '@/lib/quotePricingRules'

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
  estimatedHardCosts?: number
}

type CombinedOfferInput = {
  available?: boolean
  label?: string
  summary?: string
  includedOptionLabels?: string[]
  savingReason?: string
  estimatedDuration?: DurationInput
  priceExVat?: number
  estimatedHardCosts?: number
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
  combinedOffers?: CombinedOfferInput[]
}

const BENCHMARK_RATES = {
  indianSandstonePerM2: 140,
  porcelainPerM2: 170,
  artificialGrassPerM2: 110,
  gravelSurfacingPerM2: 60.5,
  fencingPerM: 121,
} as const

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

function roundMoney(value: number) {
  return Number(value.toFixed(2))
}

function normaliseQuoteMode(value: unknown): QuoteMode {
  if (value === 'alternatives' || value === 'packages') return value
  return 'single'
}

function looksLikeMultiChoiceQuote(text: string) {
  const value = text.toLowerCase()

  return (
    /option\s*1/.test(value) ||
    /option\s*a/.test(value) ||
    /option\s*2/.test(value) ||
    /option\s*b/.test(value) ||
    value.includes('another quote') ||
    value.includes('separate quote') ||
    value.includes('separate price') ||
    value.includes('priced separately') ||
    value.includes('couple of options') ||
    value.includes('a few options') ||
    value.includes('different options') ||
    value.includes('give them options')
  )
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
    teamSize: Math.max(
      1,
      Math.round(cleanNumber(duration.teamSize, fallbackTeamSize))
    ),
    description: cleanText(duration.description),
  }
}

function protectPriceAgainstCost(priceExVat: number, hardCosts: number) {
  if (hardCosts <= 0) return roundMoney(priceExVat)
  const minimum = sellingPriceForMargin(hardCosts, 0.3)
  return roundMoney(Math.max(priceExVat, minimum))
}

function normaliseOptions(value: unknown, vatRate: number) {
  if (!Array.isArray(value)) return []

  return value
    .slice(0, 8)
    .map((rawOption, index) => {
      const option =
        rawOption && typeof rawOption === 'object'
          ? (rawOption as Record<string, unknown>)
          : {}

      const estimatedHardCosts = roundMoney(
        Math.max(0, cleanNumber(option.estimatedHardCosts))
      )
      const priceExVat = protectPriceAgainstCost(
        cleanNumber(option.priceExVat),
        estimatedHardCosts
      )
      const vatAmount = roundMoney((priceExVat * vatRate) / 100)
      const totalIncVat = roundMoney(priceExVat + vatAmount)

      return {
        label:
          cleanText(option.label) ||
          `Option ${String.fromCharCode(65 + index)}`,
        title: cleanText(option.title) || `Option ${index + 1}`,
        summary: cleanText(option.summary),
        keyDifferences: Array.isArray(option.keyDifferences)
          ? option.keyDifferences.map(cleanText).filter(Boolean).slice(0, 6)
          : [],
        whyChoose: cleanText(option.whyChoose),
        estimatedDuration: normaliseDuration(option.estimatedDuration),
        estimatedHardCosts,
        priceExVat,
        vatAmount,
        totalIncVat,
        grossMarginPercent:
          estimatedHardCosts > 0
            ? grossMarginPercent(priceExVat, estimatedHardCosts)
            : null,
      }
    })
    .filter((option) => option.priceExVat > 0 && option.summary)
}

function findIncludedOptions(
  requestedLabels: string[],
  options: ReturnType<typeof normaliseOptions>
) {
  if (!requestedLabels.length) return options

  const wanted = requestedLabels.map((label) => label.trim().toLowerCase())

  return options.filter((option) => {
    const label = option.label.trim().toLowerCase()
    const title = option.title.trim().toLowerCase()

    return wanted.some(
      (item) =>
        item === label ||
        item === title ||
        label.includes(item) ||
        item.includes(label)
    )
  })
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

  const requestedLabels = Array.isArray(raw.includedOptionLabels)
    ? raw.includedOptionLabels.map(cleanText).filter(Boolean).slice(0, 8)
    : []

  const includedOptions = findIncludedOptions(requestedLabels, options)
  if (includedOptions.length < 2) return null

  const separateTotal = roundMoney(
    includedOptions.reduce((sum, option) => sum + option.priceExVat, 0)
  )

  const optionHardCosts = roundMoney(
    includedOptions.reduce(
      (sum, option) => sum + Math.max(0, option.estimatedHardCosts),
      0
    )
  )
  const suppliedHardCosts = roundMoney(
    Math.max(0, cleanNumber(raw.estimatedHardCosts))
  )
  const estimatedHardCosts = suppliedHardCosts || optionHardCosts

  let priceExVat = cleanNumber(raw.priceExVat)
  if (priceExVat <= 0) return null

  priceExVat = protectPriceAgainstCost(priceExVat, estimatedHardCosts)
  priceExVat = Math.min(priceExVat, separateTotal)

  const vatAmount = roundMoney((priceExVat * vatRate) / 100)
  const totalIncVat = roundMoney(priceExVat + vatAmount)
  const savingExVat = roundMoney(separateTotal - priceExVat)

  const rawDuration = normaliseDuration(raw.estimatedDuration)
  const totalPackageDays = includedOptions.reduce(
    (sum, option) => sum + Math.max(0, option.estimatedDuration.workingDays),
    0
  )
  const longestPackageDays = includedOptions.reduce(
    (longest, option) =>
      Math.max(longest, option.estimatedDuration.workingDays),
    0
  )

  const minimumCombinedDays = roundUpToHalfDay(
    Math.max(longestPackageDays, totalPackageDays * 0.8)
  )

  const workingDays = Math.max(rawDuration.workingDays, minimumCombinedDays)

  return {
    available: true,
    label: cleanText(raw.label) || 'If all completed together',
    summary: cleanText(raw.summary),
    includedOptionLabels:
      requestedLabels.length > 0
        ? requestedLabels
        : includedOptions.map((option) => option.label),
    savingReason: cleanText(raw.savingReason),
    estimatedHardCosts,
    priceExVat,
    vatAmount,
    totalIncVat,
    separateTotalExVat: separateTotal,
    savingExVat,
    grossMarginPercent:
      estimatedHardCosts > 0
        ? grossMarginPercent(priceExVat, estimatedHardCosts)
        : null,
    estimatedDuration: {
      ...rawDuration,
      workingDays,
      description:
        rawDuration.description ||
        `${workingDays} working days allowing only for genuine shared setup and logistics efficiencies`,
    },
  }
}

function normaliseCombinedOffers(
  value: unknown,
  fallbackValue: unknown,
  vatRate: number,
  options: ReturnType<typeof normaliseOptions>,
  quoteMode: QuoteMode
) {
  const source = Array.isArray(value)
    ? value.slice(0, 4)
    : fallbackValue
      ? [fallbackValue]
      : []

  return source
    .map((offer) =>
      normaliseCombinedOffer(offer, vatRate, options, quoteMode)
    )
    .filter((offer): offer is NonNullable<typeof offer> => offer !== null)
}

function optionSummaryForPrompt(
  options: ReturnType<typeof normaliseOptions>
) {
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

function combinedOffersForPrompt(
  combinedOffers: ReturnType<typeof normaliseCombinedOffers>
) {
  if (!combinedOffers.length) {
    return 'No combined all-together offer supplied.'
  }

  return combinedOffers
    .map((offer) =>
      [
        offer.label,
        offer.summary,
        `Includes: ${offer.includedOptionLabels.join(', ')}`,
        `Price ex VAT: £${offer.priceExVat.toFixed(2)}`,
        `VAT: £${offer.vatAmount.toFixed(2)}`,
        `Total inc VAT: £${offer.totalIncVat.toFixed(2)}`,
        `Saving vs those items separately ex VAT: £${offer.savingExVat.toFixed(2)}`,
        offer.savingReason
          ? `Reason for saving: ${offer.savingReason}`
          : '',
        offer.estimatedDuration.workingDays
          ? `Install: ${offer.estimatedDuration.workingDays} working days with ${offer.estimatedDuration.teamSize} ${offer.estimatedDuration.teamSize === 1 ? 'person' : 'people'}`
          : '',
      ]
        .filter(Boolean)
        .join('\n')
    )
    .join('\n\n')
}

function normaliseCostBreakdown(value: unknown) {
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
    .filter(
      (
        row
      ): row is {
        category: string
        amount: number
        detail: string
      } => row !== null
    )
    .slice(0, 20)
}

function ensureCostAndMarginOutputs(result: Record<string, any>) {
  const costBreakdown = normaliseCostBreakdown(result.costBreakdown)
  const breakdownTotal = roundMoney(
    costBreakdown.reduce((sum, row) => sum + row.amount, 0)
  )
  const estimatedHardCosts = roundMoney(
    Math.max(cleanNumber(result.estimatedHardCosts), breakdownTotal, 0)
  )

  const sellingPriceAt30Gp = sellingPriceForMargin(estimatedHardCosts, 0.3)
  const sellingPriceAt35Gp = sellingPriceForMargin(estimatedHardCosts, 0.35)
  const sellingPriceAt40Gp = sellingPriceForMargin(estimatedHardCosts, 0.4)

  return {
    costBreakdown,
    estimatedHardCosts,
    sellingPriceAt30Gp,
    sellingPriceAt35Gp,
    sellingPriceAt40Gp,
  }
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

${FURLADS_QUOTE_PRICING_RULES}

FURLADS BENCHMARK SELLING RATES — USE AS SANITY CHECKS, NOT AS THE QUOTE FORMULA:
- Indian sandstone / Raj Green patio: about £${BENCHMARK_RATES.indianSandstonePerM2}/m² ex VAT for a straightforward standard installation.
- Porcelain patio: about £${BENCHMARK_RATES.porcelainPerM2}/m² ex VAT for a straightforward standard installation.
- Artificial grass: about £${BENCHMARK_RATES.artificialGrassPerM2}/m² ex VAT for a straightforward standard installation.
- Standard fencing: about £${BENCHMARK_RATES.fencingPerM}/m ex VAT as a broad benchmark where specification and ground are ordinary.
- Gravel surfacing: about £${BENCHMARK_RATES.gravelSurfacingPerM2}/m² ex VAT as a broad benchmark for straightforward work.

These figures do NOT override the whole-job cost calculation. If the cost-and-margin calculation produces a different price, use the cost-and-margin calculation and explain internally why.

SITE-INPUT BEHAVIOUR:
- Use Trevor's written notes, dimensions and photos first.
- Do not ask for information merely because it would be nice to know.
- Put genuinely price-sensitive unknowns into missingInformation or pricingQuestions.
- Prefer a clearly labelled provisional assumption where sensible.
- Only identify a blockingQuestionRequired when the missing answer could materially change price, programme, buildability or safe specification and a provisional allowance would be misleading.

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
- Build estimatedHardCosts from the expected materials, labour, plant, waste, deliveries/logistics, specialists and contingency actually needed.
- costBreakdown must be internal job COST, not customer selling prices and not marked-up line items.
- estimatedHardCosts must equal or sensibly reconcile to the costBreakdown total.
- Calculate labour in man-days and include the man-day calculation in labourSummary.
- recommendedPriceExVat must not be below the selling price required for 30% gross margin on estimatedHardCosts.
- 35% and 40% GP prices are useful references, not automatic targets. Recommend the commercially sensible figure for the real risk and complexity.
- Standard benchmark rates are only a comparison/sanity check after the whole-job calculation.
- Never automatically add normal labour/materials/waste/plant twice.
- Protect Furlads against underpricing and arbitrary discounting.
- A combined "all done together" price may be lower than buying packages separately only where you can name the genuine duplicated costs saved.
- Never apply an arbitrary percentage discount.
- Keep the response practical.

QUOTE MODE — CHOOSE THE RIGHT STRUCTURE:
1. single
   Use only when the customer has one settled scope and wants one price.

2. alternatives
   Use when the customer is deciding only between mutually exclusive ideas, materials, layouts or finishes. Give 2–3 genuinely different alternatives. Each alternative gets its own description, price, estimated hard costs and duration. Do NOT add alternative prices together.

3. packages
   Use when the customer wants separate prices for work that can be bought independently, or when a larger enquiry naturally breaks into separate jobs. Give each logical package its own description, price, estimated hard costs and duration.

MIXED ALTERNATIVES + PACKAGES:
- A single enquiry can contain BOTH alternatives and separate purchasable jobs.
- For this mixed case use quoteMode "packages", NOT single.
- Put each customer-visible priced line into options.
- Mutually exclusive alternatives must never appear in the same combined total.
- Use combinedOffers to provide each valid all-together combination where appropriate.
- Every combined offer must list exactly which option labels it includes.
- Do not ask the customer to choose before showing the prices.

REALISTIC INSTALL-TIME RULES:
- Duration is an operational production estimate, not sales wording.
- Estimate actual working days for the stated team size and calculate total man-days.
- Break the work into physical operations: removal/excavation, loading/spoil, setting out, foundations/sub-base, compaction, posts, concrete, cutting, laying/fitting, edging, finishing and tidy-up.
- Distinct trades do not magically happen at once because they are sold together.
- Multiple separate areas reduce productivity.
- Natural-stone patio with full preparation: roughly 10m² per two-person working day is a useful sanity check plus setup/finishing.
- Porcelain with full preparation is normally slower than sandstone.
- Standard fencing: roughly 5–7 normal bays per two-person working day is a useful sanity check before access/ground/removal adjustments.
- Artificial grass with full preparation: roughly 20–30m² per two-person working day in ordinary conditions is a useful sanity check.
- These are sanity checks, not rigid rates.
- Combined duration should normally be the sum of included package crew-days minus only modest genuine shared efficiencies; do not reduce by more than about 20% without a specific physical reason.
- Round uncertain durations UP to the nearest half day rather than down.

Return only valid JSON using this exact structure:
{
  "quoteMode": "single",
  "optionMode": false,
  "recommendedOptionLabel": "",
  "options": [
    {
      "label": "Option A",
      "title": "Customer-visible option title",
      "summary": "Exactly what this price includes",
      "keyDifferences": ["What makes this different"],
      "whyChoose": "Why this may suit the customer",
      "estimatedDuration": {
        "workingDays": 1,
        "teamSize": 2,
        "description": "How the duration was arrived at"
      },
      "estimatedHardCosts": 0,
      "priceExVat": 0
    }
  ],
  "combinedOffers": [
    {
      "available": true,
      "label": "If all completed together",
      "summary": "Compatible packages completed in one mobilisation",
      "includedOptionLabels": ["Option A", "Option B"],
      "savingReason": "The actual duplicated mobilisation/delivery/waste/setup costs saved",
      "estimatedDuration": {
        "workingDays": 1,
        "teamSize": 2,
        "description": "Realistic combined duration"
      },
      "estimatedHardCosts": 0,
      "priceExVat": 0
    }
  ],
  "combinedOffer": {
    "available": false,
    "label": "Legacy single combined offer",
    "summary": "",
    "includedOptionLabels": [],
    "savingReason": "",
    "estimatedDuration": {
      "workingDays": 0,
      "teamSize": 2,
      "description": ""
    },
    "estimatedHardCosts": 0,
    "priceExVat": 0
  },
  "summary": "Short description of the proposal",
  "measurements": ["Relevant area, linear metres and excavation volume where known"],
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
  "assumptions": ["Provisional assumption used"],
  "missingInformation": ["Important check still needed"],
  "pricingQuestions": ["Only questions whose answer could materially change the quote"],
  "blockingQuestionRequired": false,
  "blockingQuestion": "",
  "accessRating": "standard | moderate | difficult | very_difficult",
  "complexityRating": "low | medium | high | very_high",
  "warningFlags": ["Automatic/internal warnings"],
  "estimatedDuration": {
    "workingDays": 1,
    "teamSize": 2,
    "description": "Realistic duration"
  },
  "labourSummary": {
    "workers": 2,
    "workingDays": 1,
    "manDays": 2,
    "estimatedCost": 0,
    "notes": "Worker cost assumptions and productivity adjustments"
  },
  "costBreakdown": [
    {
      "category": "Materials",
      "amount": 0,
      "detail": "What is included in this internal cost"
    }
  ],
  "estimatedHardCosts": 0,
  "recommendedPriceExVat": 0,
  "vatRate": 20,
  "vatAmount": 0,
  "recommendedTotalIncVat": 0,
  "depositPercent": 25,
  "depositAmount": 0,
  "pricingNotes": ["Internal explanation of calculations and benchmark sanity checks"]
}

STRUCTURE RULES:
- single: optionMode false, options [], combinedOffers [], combinedOffer.available false.
- alternatives: optionMode true, quoteMode alternatives, normally 2–3 options, combinedOffers [].
- packages: optionMode true, quoteMode packages, 2–8 customer-visible priced items.
- In a straightforward packages quote, combinedOffers may contain one all-together price.
- In a mixed packages + alternatives quote, combinedOffers should contain each valid all-together combination without combining mutually exclusive alternatives.
- For packages, recommendedPriceExVat is an internal/reference headline price. The customer-facing source of truth is the individual options plus combinedOffers.
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

First work out what the job will physically require and what could make it take longer or cost more than the measurements suggest. Calculate realistic internal job costs and man-days. Then calculate the 30%, 35% and 40% GP references and recommend the sensible customer price. Use benchmark rates only as a sanity comparison afterwards.

If an important detail is missing, do not automatically stop. Use a sensible provisional assumption where appropriate and put the issue in pricingQuestions. Set blockingQuestionRequired true only if pricing now would be materially misleading or unsafe without the answer.
`.trim()

  let result = await runOpenAI({
    systemPrompt,
    userPrompt,
    photos,
  })

  let preliminaryVatRate = cleanNumber(result.vatRate, 20)
  let preliminaryMode = normaliseQuoteMode(result.quoteMode)
  let preliminaryOptions = normaliseOptions(
    result.options,
    preliminaryVatRate
  )

  if (
    looksLikeMultiChoiceQuote(jobDetails) &&
    (preliminaryMode === 'single' || preliminaryOptions.length < 2)
  ) {
    result = await runOpenAI({
      systemPrompt:
        systemPrompt +
        '\n\nCORRECTION PASS: The user explicitly described multiple options and/or separate quotes. Do not return quoteMode single. Return every customer-visible price separately using alternatives or packages, preserving whole-job cost and margin calculations for each option.',
      userPrompt:
        userPrompt +
        '\n\nRe-structure the enquiry so the customer can see the separate prices before deciding.',
      photos,
    })

    preliminaryVatRate = cleanNumber(result.vatRate, 20)
    preliminaryMode = normaliseQuoteMode(result.quoteMode)
    preliminaryOptions = normaliseOptions(
      result.options,
      preliminaryVatRate
    )
  }

  const vatRate = preliminaryVatRate
  let quoteMode = preliminaryMode
  const options = preliminaryOptions

  if (quoteMode !== 'single' && options.length < 2) {
    quoteMode = 'single'
  }

  const combinedOffers = normaliseCombinedOffers(
    result.combinedOffers,
    result.combinedOffer,
    vatRate,
    options,
    quoteMode
  )
  const combinedOffer = combinedOffers[0] || null

  const costOutputs = ensureCostAndMarginOutputs(result)
  let priceExVat = protectPriceAgainstCost(
    cleanNumber(result.recommendedPriceExVat),
    costOutputs.estimatedHardCosts
  )
  let estimatedDuration = normaliseDuration(result.estimatedDuration)
  const pricingNotes = Array.isArray(result.pricingNotes)
    ? result.pricingNotes.map(cleanText).filter(Boolean)
    : []
  const warningFlags = Array.isArray(result.warningFlags)
    ? result.warningFlags.map(cleanText).filter(Boolean)
    : []

  if (quoteMode === 'packages' && options.length >= 2) {
    if (combinedOffer) {
      priceExVat = combinedOffer.priceExVat
      estimatedDuration = combinedOffer.estimatedDuration
    } else {
      const packageTotal = roundMoney(
        options.reduce((sum, option) => sum + option.priceExVat, 0)
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
          description:
            'Reference duration from the separately estimated priced items.',
        }
      }
    }
  }

  if (quoteMode === 'alternatives' && options.length >= 2) {
    const recommendedLabel = cleanText(result.recommendedOptionLabel)
    const recommended =
      options.find((option) => option.label === recommendedLabel) ||
      options[0]

    if (recommended) {
      priceExVat = recommended.priceExVat
      estimatedDuration = recommended.estimatedDuration
    }
  }

  const vatAmount = roundMoney((priceExVat * vatRate) / 100)
  const totalIncVat = roundMoney(priceExVat + vatAmount)
  const depositPercent = cleanNumber(result.depositPercent, 25)
  const depositAmount = roundMoney((totalIncVat * depositPercent) / 100)
  const achievedGrossMargin =
    costOutputs.estimatedHardCosts > 0
      ? grossMarginPercent(priceExVat, costOutputs.estimatedHardCosts)
      : null

  const belowMinimumWarning =
    achievedGrossMargin !== null && achievedGrossMargin < 30
      ? ['Selling price is below the 30% minimum gross-margin target.']
      : []

  return NextResponse.json({
    ...result,
    quoteMode,
    optionMode: quoteMode !== 'single' && options.length >= 2,
    recommendedOptionLabel: cleanText(result.recommendedOptionLabel),
    options,
    combinedOffers,
    combinedOffer,
    costBreakdown: costOutputs.costBreakdown,
    estimatedHardCosts: costOutputs.estimatedHardCosts,
    sellingPriceAt30Gp: costOutputs.sellingPriceAt30Gp,
    sellingPriceAt35Gp: costOutputs.sellingPriceAt35Gp,
    sellingPriceAt40Gp: costOutputs.sellingPriceAt40Gp,
    achievedGrossMargin,
    warningFlags: Array.from(new Set([...warningFlags, ...belowMinimumWarning])),
    pricingNotes,
    estimatedDuration,
    recommendedPriceExVat: roundMoney(priceExVat),
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
  const combinedOffers = normaliseCombinedOffers(
    body.combinedOffers,
    body.combinedOffer,
    vatRate,
    options,
    quoteMode
  )
  const combinedOffer = combinedOffers[0] || null

  let priceExVat = cleanNumber(body.priceExVat)

  if (quoteMode === 'packages' && combinedOffer) {
    priceExVat = combinedOffer.priceExVat
  } else if (
    quoteMode === 'packages' &&
    options.length >= 2 &&
    priceExVat <= 0
  ) {
    priceExVat = roundMoney(
      options.reduce((sum, option) => sum + option.priceExVat, 0)
    )
  } else if (
    quoteMode === 'alternatives' &&
    options.length >= 2 &&
    priceExVat <= 0
  ) {
    priceExVat = options[0].priceExVat
  }

  if (!jobDetails && options.length === 0) {
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
        error: 'Enter or generate a valid quotation price.',
      },
      { status: 400 }
    )
  }

  const vatAmount = roundMoney((priceExVat * vatRate) / 100)
  const totalIncVat = roundMoney(priceExVat + vatAmount)
  const depositAmount = roundMoney((totalIncVat * depositPercent) / 100)

  const isMultiQuote = quoteMode !== 'single' && options.length >= 2

  const systemPrompt = `
You write the customer-facing quotation message for Furlads, a friendly, professional landscaping company. The message is sent by Kelly, who is the customer's main point of contact from this point onwards.

This message is one of the customer's first proper experiences of working with Furlads. They may be considering spending a substantial amount of money, so the message must make the project feel exciting, well organised and reassuring — not like a dry invoice or an internal estimating sheet.

VOICE AND FEEL:
- Write as Kelly in the first person where natural.
- Be warm, upbeat, confident and genuinely enthusiastic about the finished garden.
- Lead with the transformation and what the customer will get to enjoy, not with calculations.
- Make the customer feel that Furlads has understood what they want and has a clear plan to deliver it.
- Sound human and conversational, like a great local business on WhatsApp — never corporate, robotic or over-salesy.
- Use 2–4 well-placed emojis.
- Keep paragraphs short and easy to scan on a phone.
- Do not overpromise or expose internal estimating logic.

KELLY / CUSTOMER RELATIONSHIP:
- The quote MUST come from Kelly, not Trevor.
- Near the end, tell the customer clearly that Kelly will be their main point of contact from here and they can reply directly with questions, tweaks or to go ahead.
- Finish with a warm sign-off from Kelly and Furlads.

PRESENTING THE WORK:
- Start with a short paragraph that helps the customer picture the finished result.
- Explain what is included with clear tick-point bullets.
- Focus on the result and scope, not internal construction jargon unless it matters.
- If there is a provisional assumption, explain it calmly in a short quick-note section.
- Never expose hard costs, margins, GP calculations, estimator notes or benchmark-rate calculations.
- Only show a detailed line-by-line commercial breakdown where there are genuinely separate customer-visible items, extras, packages or options.
- Never change any supplied prices, VAT, deposit figures or durations.

PROJECT PRICE / DEPOSIT:
- For a single quote show Price + VAT, VAT and Total.
- If a deposit applies, explain it simply as the step that secures the project/material commitment.
- Do not invent payment details.

MULTI-OPTION QUOTES:
- Show every supplied priced option/package separately.
- Do not ask the customer to choose before showing the prices.
- For alternatives, make clear they choose one.
- For separate packages, make clear they can choose one, several or all.
- Show every supplied all-together offer after the individual prices.
- Make any saving sound like a practical benefit of shared mobilisation/logistics, not a fake discount.
- Never combine mutually exclusive alternatives.
- State that the deposit is calculated against whichever works/package the customer chooses unless supplied otherwise.

DO NOT:
- Do not sound like an invoice, tender document or AI script.
- Do not lead with cost breakdown.
- Do not expose internal hard costs, margins or pricing formulas.
- Do not say the quote is attached.
- Do not say the customer has already accepted.
- Do not claim a diary space is reserved unless explicitly supplied.
- Do not invent work, guarantees, materials, timescales or promises.

Return only valid JSON using this exact structure:
{
  "whatsappQuote": "Complete customer-ready WhatsApp message written from Kelly",
  "scopeItems": ["Scope item"],
  "customerSummary": "Short transformation-focused summary",
  "warnings": ["Anything Kelly or Trevor should check before sending"]
}
`.trim()

  const userPrompt = `
Customer name:
${customerName || 'Customer'}

Quote mode:
${quoteMode}

Confirmed general scope / context:
${jobDetails || 'Use the priced options/packages below.'}

Priced options or packages:
${
  options.length
    ? optionSummaryForPrompt(options)
    : 'None — this is a single quote.'
}

Combined all-together offers:
${combinedOffersForPrompt(combinedOffers)}

Additional wording instructions:
${additionalInstructions || 'None supplied'}

Approved customer-facing figures:
Price excluding VAT: £${priceExVat.toFixed(2)}
VAT rate: ${vatRate}%
VAT amount: £${vatAmount.toFixed(2)}
Total including VAT: £${totalIncVat.toFixed(2)}
Deposit percentage: ${depositPercent}%
Deposit amount on the headline/reference total: £${depositAmount.toFixed(2)}

${
  isMultiQuote
    ? 'Write a customer-ready options/package quotation from Kelly showing every supplied price and every valid all-together offer separately. The customer has NOT decided yet.'
    : 'Write the finished customer-ready Furlads WhatsApp quotation from Kelly. Lead with the transformation and make the customer feel excited and reassured about the project.'
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
    combinedOffers,
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
