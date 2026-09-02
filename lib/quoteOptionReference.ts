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

function optionLines(working: string) {
  const marker = 'OPTIONS / PACKAGES'
  const start = working.indexOf(marker)
  if (start < 0) return [] as string[]

  const after = working.slice(start + marker.length)
  const endMarkers = ['ALL-TOGETHER COMBINATIONS', 'TREVOR / CHAS CONVERSATION', 'SURVEY PHOTOS JSON']
  const ends = endMarkers
    .map((item) => after.indexOf(item))
    .filter((index) => index >= 0)
  const section = ends.length ? after.slice(0, Math.min(...ends)) : after

  return section
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^Option\s+/i.test(line) && /£\s*[0-9]/.test(line))
}

function combinedLine(working: string) {
  const marker = 'ALL-TOGETHER COMBINATIONS'
  const start = working.indexOf(marker)
  if (start < 0) return ''

  return working
    .slice(start + marker.length)
    .split('\n')
    .map((line) => line.trim())
    .find((line) => /£\s*[0-9]/.test(line)) || ''
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
  const storedPriceExVat = Number.isFinite(params.storedPriceExVat)
    ? params.storedPriceExVat
    : 0

  // The database commercial figures are the source of truth whenever they exist.
  // CHAS working is conversational history and can contain superseded option prices.
  // Parsing that history was causing old figures to overwrite the current quote card.
  if (storedPriceExVat > 0) {
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

  // Legacy fallback only: recover a usable figure from CHAS working when an old
  // record genuinely has no stored price.
  const working = String(params.quoteWorking || '')
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
