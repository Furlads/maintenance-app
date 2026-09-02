import assert from 'node:assert/strict'
import test from 'node:test'
import { safeQuoteReference } from './quoteOptionReference'

test('Rick-style multi-option quote uses complete job instead of stale stored total', () => {
  const result = safeQuoteReference({
    quoteWorking: [
      'OPTIONS / PACKAGES',
      'Option 1 — Patio + Path: £1,656.00 + VAT (£1,987.20 total) — 2 days with 2',
      'Option 2 — Concrete breakout: £2,853.00 + VAT (£3,423.60 total) — 3 days with 2',
      'Option 3 — Complete job — patio + path + concrete run: £4,339.00 + VAT (£5,206.80 total) — 5 days with 2',
      '',
      'TREVOR / CHAS CONVERSATION',
      'Old working with other figures',
    ].join('\n'),
    storedPriceExVat: 8848,
    storedEstimatedDays: 10,
    storedEstimatedTeamSize: 2,
  })

  assert.equal(result.priceExVat, 4339)
  assert.equal(result.totalIncVat, 5206.8)
  assert.equal(result.estimatedDays, 5)
  assert.equal(result.estimatedTeamSize, 2)
})

test('explicit all-together combination always wins over individual package prices', () => {
  const result = safeQuoteReference({
    quoteWorking: [
      'OPTIONS / PACKAGES',
      'Option A — Front: £2,450.00 + VAT',
      'Option B — Wall: £780.00 + VAT',
      'Option D — Step: £725.00 + VAT',
      'ALL-TOGETHER COMBINATIONS',
      'If all completed together: £3,516.67 + VAT — 4 days with 2',
      'TREVOR / CHAS CONVERSATION',
      'Superseded calculations below',
    ].join('\n'),
    storedPriceExVat: 9000,
  })

  assert.equal(result.priceExVat, 3516.67)
  assert.equal(result.totalIncVat, 4220)
})

test('single-price quote falls back to stored commercial value', () => {
  const result = safeQuoteReference({
    quoteWorking: 'Single quote with no OPTIONS / PACKAGES section',
    storedPriceExVat: 1000,
    storedEstimatedDays: 2,
    storedEstimatedTeamSize: 2,
  })

  assert.equal(result.priceExVat, 1000)
  assert.equal(result.totalIncVat, 1200)
  assert.equal(result.source, 'stored')
})

test('conversation history after the package section cannot override the selected package', () => {
  const result = safeQuoteReference({
    quoteWorking: [
      'OPTIONS / PACKAGES',
      'Option 1 — Small job: £1,000.00 + VAT',
      'Option 2 — Complete works: £2,000.00 + VAT',
      'TREVOR / CHAS CONVERSATION',
      'CHAS: old complete job calculation £99,999.00 + VAT',
    ].join('\n'),
    storedPriceExVat: 50000,
  })

  assert.equal(result.priceExVat, 2000)
  assert.equal(result.totalIncVat, 2400)
})
