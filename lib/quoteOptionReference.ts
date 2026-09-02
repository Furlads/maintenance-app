export type QuoteReference = {
  priceExVat: number
  vatRate: number
  vatAmount: number
  totalIncVat: number
  estimatedDays: number | null
  estimatedTeamSize: number | null
  source: 'combined_offer' | 'complete_option' | 'largest_option' | 'stored'
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

function resultFromLine(line: string, source: QuoteReference['source']): QuoteReference | null {
  const priceExVat = moneyFromText(line)
  if (priceExVat <= 0) return null

  const vatAmount = Number(((priceExVat * VAT_RATE) / 100).toFixed(2))
  const totalIncVat = Number((priceExVat + vatAmount).toFixed(2))
  const duration = durationFromText(line)

  return {
    priceExVat,
    vatRate: VAT_RATE,
    vatAmount,
    totalIncVat,
    estimatedDays: duration.estimatedDays,
    estimatedTeamSize: duration.estimatedTeamSize,
    source,
  }
}

export function safeQuoteReference(params: {
  quoteWorking?: string | null
  storedPriceExVat: number
  storedEstimatedDays?: number | null
  storedEstimatedTeamSize?: number | null
}): QuoteReference {
  const working = String(params.quoteWorking || '')

  // Multi-option quotes must always show the customer's best complete/all-together
  // package first. Do not let stale stored figures or older CHAS calculations
  // replace the headline package price.
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

  const storedPriceExVat = Number.isFinite(params.storedPriceExVat)
    ? params.storedPriceExVat
    : 0
  const vatAmount = Number(((storedPriceExVat * VAT_RATE) / 100).toFixed(2))

  return {
    priceExVat: storedPriceExVat,
    vatRate: VAT_RATE,
    vatAmount,
    totalIncVat: Number((storedPriceExVat + vatAmount).toFixed(2)),
    estimatedDays: params.storedEstimatedDays ?? null,
    estimatedTeamSize: params.storedEstimatedTeamSize ?? null,
    source: 'stored',
  }
}
