export type QuoteReference = {
  priceExVat: number
  vatRate: number
  vatAmount: number
  totalIncVat: number
  estimatedDays: number | null
  estimatedTeamSize: number | null
  source: 'recommended_option' | 'combined_offer' | 'complete_option' | 'largest_option' | 'stored'
}

const VAT_RATE = 20

function moneyFromText(value: string) {
  const match = value.match(/£\s*([0-9,]+(?:\.\d{1,2})?)/)
  if (!match) return 0
  const amount = Number(match[1].replace(/,/g, ''))
  return Number.isFinite(amount) ? amount : 0
}

function durationFromText(value: string) {
  const daysMatch = value.match(/(?:—|-)\s*([0-9]+(?:\.5)?)\s+days?\s+with\s+([0-9]+)\b/i)
  if (!daysMatch) return { estimatedDays: null, estimatedTeamSize: null }
  return {
    estimatedDays: Number(daysMatch[1]),
    estimatedTeamSize: Number(daysMatch[2]),
  }
}

function quoteSection(working: string) {
  const startMarker = 'OPTIONS / PACKAGES'
  const start = working.indexOf(startMarker)
  if (start < 0) return working

  const after = working.slice(start + startMarker.length)
  const endMarkers = ['TREVOR / CHAS CONVERSATION', 'SURVEY PHOTOS JSON']
  const ends = endMarkers
    .map((item) => after.indexOf(item))
    .filter((index) => index >= 0)

  return ends.length ? after.slice(0, Math.min(...ends)) : after
}

function optionLines(working: string) {
  return quoteSection(working)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^Option\s+/i.test(line) && /£\s*[0-9]/.test(line))
}

function recommendedPriceFromWorking(working: string) {
  const section = quoteSection(working)
  const match = section.match(/"recommendedPriceExVat"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i)
  if (!match) return 0
  const amount = Number(match[1])
  return Number.isFinite(amount) ? amount : 0
}

function combinedLine(working: string) {
  const section = quoteSection(working)
  const lines = section.split('\n').map((line) => line.trim())

  const explicitMarkerIndex = lines.findIndex((line) => /^ALL-TOGETHER COMBINATIONS$/i.test(line))
  if (explicitMarkerIndex >= 0) {
    return lines.slice(explicitMarkerIndex + 1).find((line) => /£\s*[0-9]/.test(line)) || ''
  }

  return lines.find((line) =>
    /£\s*[0-9]/.test(line) &&
    /\b(if all completed together|all completed together|all work together|all works together|all together|combined package|combined offer|complete job)\b/i.test(line)
  ) || ''
}

function resultFromPrice(
  priceExVat: number,
  source: QuoteReference['source'],
  estimatedDays: number | null = null,
  estimatedTeamSize: number | null = null
): QuoteReference | null {
  if (!Number.isFinite(priceExVat) || priceExVat <= 0) return null

  const vatAmount = Number(((priceExVat * VAT_RATE) / 100).toFixed(2))
  return {
    priceExVat,
    vatRate: VAT_RATE,
    vatAmount,
    totalIncVat: Number((priceExVat + vatAmount).toFixed(2)),
    estimatedDays,
    estimatedTeamSize,
    source,
  }
}

function resultFromLine(line: string, source: QuoteReference['source']): QuoteReference | null {
  const priceExVat = moneyFromText(line)
  if (priceExVat <= 0) return null

  const duration = durationFromText(line)
  return resultFromPrice(
    priceExVat,
    source,
    duration.estimatedDays,
    duration.estimatedTeamSize
  )
}

export function safeQuoteReference(params: {
  quoteWorking?: string | null
  storedPriceExVat: number
  storedEstimatedDays?: number | null
  storedEstimatedTeamSize?: number | null
}): QuoteReference {
  const storedPriceExVat = Number.isFinite(params.storedPriceExVat)
    ? params.storedPriceExVat
    : 0
  const working = String(params.quoteWorking || '')

  // Older multi-option quotes were sometimes saved with every standalone option
  // added together as the headline commercial price. That makes the quotes list
  // and pipeline look far higher than the option CHAS actually recommends.
  // Only correct the stored figure when it exactly matches that accidental sum;
  // genuine office-negotiated / accepted prices remain the source of truth.
  if (storedPriceExVat > 0 && working) {
    const options = optionLines(working)
    const optionTotal = Number(
      options.reduce((sum, line) => sum + moneyFromText(line), 0).toFixed(2)
    )
    const recommendedPrice = recommendedPriceFromWorking(working)

    if (
      options.length >= 2 &&
      recommendedPrice > 0 &&
      Math.abs(storedPriceExVat - optionTotal) < 0.02 &&
      Math.abs(storedPriceExVat - recommendedPrice) >= 0.02
    ) {
      const recommended = resultFromPrice(
        recommendedPrice,
        'recommended_option',
        params.storedEstimatedDays ?? null,
        params.storedEstimatedTeamSize ?? null
      )
      if (recommended) return recommended
    }
  }

  // The stored quote is normally the commercial source of truth. Historical CHAS
  // working can contain superseded package figures and must not overwrite a genuine
  // office/customer price once one has been saved.
  if (storedPriceExVat > 0) {
    const stored = resultFromPrice(
      storedPriceExVat,
      'stored',
      params.storedEstimatedDays ?? null,
      params.storedEstimatedTeamSize ?? null
    )
    if (stored) return stored
  }

  // Legacy fallback only: recover a figure from CHAS working when the record has
  // no stored commercial price at all.
  const recommendedPrice = recommendedPriceFromWorking(working)
  const recommendedResult = resultFromPrice(
    recommendedPrice,
    'recommended_option',
    params.storedEstimatedDays ?? null,
    params.storedEstimatedTeamSize ?? null
  )
  if (recommendedResult) return recommendedResult

  const combined = combinedLine(working)
  const combinedResult = combined ? resultFromLine(combined, 'combined_offer') : null
  if (combinedResult) return combinedResult

  const options = optionLines(working)
  if (options.length >= 2) {
    const complete = options.find((line) =>
      /\b(complete job|complete works|all work|all works|whole job|whole area|combined)\b/i.test(line)
    )
    const completeResult = complete ? resultFromLine(complete, 'complete_option') : null
    if (completeResult) return completeResult

    const priced = options
      .map((line) => ({ line, price: moneyFromText(line) }))
      .filter((item) => item.price > 0)
      .sort((a, b) => b.price - a.price)

    if (priced[0]) {
      const largestResult = resultFromLine(priced[0].line, 'largest_option')
      if (largestResult) return largestResult
    }
  }

  return {
    priceExVat: 0,
    vatRate: VAT_RATE,
    vatAmount: 0,
    totalIncVat: 0,
    estimatedDays: params.storedEstimatedDays ?? null,
    estimatedTeamSize: params.storedEstimatedTeamSize ?? null,
    source: 'stored',
  }
}
