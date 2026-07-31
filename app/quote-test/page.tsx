'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

type CostItem = {
  category: string
  description: string
  estimatedCost: number
}

type PricingResult = {
  summary: string
  confirmedInformation: string[]
  assumptions: string[]
  missingInformation: string[]
  estimatedDuration: {
    workingDays: number
    teamSize: number
    description: string
  }
  costBreakdown: CostItem[]
  estimatedHardCosts: number
  recommendedPriceExVat: number
  vatRate: number
  vatAmount: number
  recommendedTotalIncVat: number
  depositPercent: number
  depositAmount: number
  pricingNotes: string[]
}

type QuoteResult = {
  whatsappQuote: string
  scopeItems: string[]
  customerSummary: string
  warnings: string[]
  priceExVat: number
  vatRate: number
  vatAmount: number
  totalIncVat: number
  depositPercent: number
  depositAmount: number
}

const sampleJob = `Full clearance of the existing overgrown grass, weeds and garden debris.

Remove and responsibly dispose of all green waste generated during the works.

Prepare and level the existing garden area.

Supply and install approximately 36m² of artificial grass.

Supply and install a 15-metre stepping stone pathway using Khaki Grey Indian Stone slabs measuring 600x900mm.

Remove the existing grey gravel and replace it with decorative Cotswold stone.

Leave all working areas clean and tidy on completion.`

function money(value: number | string | undefined) {
  const amount = Number(value || 0)

  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(Number.isFinite(amount) ? amount : 0)
}

function asNumber(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export default function QuoteTestPage() {
  const [customerName, setCustomerName] = useState('Sarah')
  const [jobDetails, setJobDetails] = useState(sampleJob)

  const [additionalInstructions, setAdditionalInstructions] = useState(
    'Keep the quote warm and exciting, while clearly explaining everything included.'
  )

  const [priceExVat, setPriceExVat] = useState('4750')
  const [vatRate, setVatRate] = useState('20')
  const [depositPercent, setDepositPercent] = useState('25')

  const [pricingResult, setPricingResult] = useState<PricingResult | null>(null)
  const [quoteResult, setQuoteResult] = useState<QuoteResult | null>(null)

  const [pricing, setPricing] = useState(false)
  const [writing, setWriting] = useState(false)
  const [copying, setCopying] = useState(false)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const calculatedFigures = useMemo(() => {
    const exVat = asNumber(priceExVat)
    const vat = asNumber(vatRate)
    const deposit = asNumber(depositPercent)

    const vatAmount = (exVat * vat) / 100
    const total = exVat + vatAmount
    const depositAmount = (total * deposit) / 100

    return {
      vatAmount,
      total,
      depositAmount,
    }
  }, [priceExVat, vatRate, depositPercent])

  async function requestQuote(
    action: 'price' | 'write'
  ): Promise<PricingResult | QuoteResult> {
    const response = await fetch('/api/ai/quote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action,
        customerName,
        jobDetails,
        additionalInstructions,
        priceExVat: asNumber(priceExVat),
        vatRate: asNumber(vatRate),
        depositPercent: asNumber(depositPercent),
      }),
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      throw new Error(data?.error || 'The quote could not be generated.')
    }

    return data
  }

  async function handlePriceJob() {
    try {
      setPricing(true)
      setError('')
      setSuccess('')
      setQuoteResult(null)

      const result = (await requestQuote('price')) as PricingResult

      setPricingResult(result)
      setPriceExVat(String(result.recommendedPriceExVat || 0))
      setVatRate(String(result.vatRate ?? 20))
      setDepositPercent(String(result.depositPercent ?? 25))

      setSuccess(
        'Pricing generated. Check the assumptions and adjust the figures before writing the customer quote.'
      )
    } catch (err) {
      console.error(err)

      setError(
        err instanceof Error ? err.message : 'Unable to price the job.'
      )
    } finally {
      setPricing(false)
    }
  }

  async function handleWriteQuote() {
    try {
      setWriting(true)
      setError('')
      setSuccess('')

      const result = (await requestQuote('write')) as QuoteResult

      setQuoteResult(result)
      setSuccess('WhatsApp quotation written and ready to copy.')
    } catch (err) {
      console.error(err)

      setError(
        err instanceof Error ? err.message : 'Unable to write the quote.'
      )
    } finally {
      setWriting(false)
    }
  }

  async function handleCopy() {
    if (!quoteResult?.whatsappQuote) return

    try {
      setCopying(true)

      await navigator.clipboard.writeText(quoteResult.whatsappQuote)

      setSuccess('Quote copied. You can now paste it straight into WhatsApp.')
    } catch {
      setError(
        'The browser could not copy automatically. Select the quote and copy it manually.'
      )
    } finally {
      setCopying(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-green-700">
              Furlads AI
            </p>

            <h1 className="text-3xl font-bold text-slate-900">
              Quote workflow test
            </h1>

            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Enter the site details, generate an internal price and then turn
              the approved figures into a customer-ready WhatsApp quotation.
            </p>
          </div>

          <Link
            href="/jobs"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Back to jobs
          </Link>
        </div>

        {error ? (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {success}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="space-y-6">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-xl font-bold text-slate-900">
                1. Job information
              </h2>

              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-slate-700">
                    Customer name
                  </span>

                  <input
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                    placeholder="Customer name"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-slate-700">
                    Measurements, photos and site notes
                  </span>

                  <textarea
                    value={jobDetails}
                    onChange={(event) => setJobDetails(event.target.value)}
                    rows={16}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm leading-6 text-slate-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                    placeholder="Enter everything known about the job..."
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-slate-700">
                    Extra instructions
                  </span>

                  <textarea
                    value={additionalInstructions}
                    onChange={(event) =>
                      setAdditionalInstructions(event.target.value)
                    }
                    rows={3}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                    placeholder="For example: customer wants two options..."
                  />
                </label>

                <button
                  type="button"
                  onClick={handlePriceJob}
                  disabled={pricing || writing || !jobDetails.trim()}
                  className="w-full rounded-xl bg-slate-900 px-4 py-3 font-bold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pricing ? 'Pricing job…' : '✨ Price Job'}
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-xl font-bold text-slate-900">
                2. Approved figures
              </h2>

              <p className="mt-1 text-sm text-slate-600">
                You stay in control. Change any figure before writing the
                customer message.
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-slate-700">
                    Price excluding VAT
                  </span>

                  <div className="flex rounded-xl border border-slate-300 bg-white focus-within:border-green-600 focus-within:ring-2 focus-within:ring-green-100">
                    <span className="px-3 py-2.5 text-slate-500">£</span>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={priceExVat}
                      onChange={(event) => setPriceExVat(event.target.value)}
                      className="min-w-0 flex-1 rounded-r-xl py-2.5 pr-3 outline-none"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-slate-700">
                    VAT rate
                  </span>

                  <div className="flex rounded-xl border border-slate-300 bg-white focus-within:border-green-600 focus-within:ring-2 focus-within:ring-green-100">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={vatRate}
                      onChange={(event) => setVatRate(event.target.value)}
                      className="min-w-0 flex-1 rounded-l-xl px-3 py-2.5 outline-none"
                    />

                    <span className="px-3 py-2.5 text-slate-500">%</span>
                  </div>
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-slate-700">
                    Deposit
                  </span>

                  <div className="flex rounded-xl border border-slate-300 bg-white focus-within:border-green-600 focus-within:ring-2 focus-within:ring-green-100">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={depositPercent}
                      onChange={(event) =>
                        setDepositPercent(event.target.value)
                      }
                      className="min-w-0 flex-1 rounded-l-xl px-3 py-2.5 outline-none"
                    />

                    <span className="px-3 py-2.5 text-slate-500">%</span>
                  </div>
                </label>
              </div>

              <dl className="mt-5 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-3">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    VAT
                  </dt>

                  <dd className="mt-1 font-bold text-slate-900">
                    {money(calculatedFigures.vatAmount)}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Total
                  </dt>

                  <dd className="mt-1 text-lg font-bold text-green-700">
                    {money(calculatedFigures.total)}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Deposit
                  </dt>

                  <dd className="mt-1 font-bold text-slate-900">
                    {money(calculatedFigures.depositAmount)}
                  </dd>
                </div>
              </dl>

              <button
                type="button"
                onClick={handleWriteQuote}
                disabled={
                  pricing ||
                  writing ||
                  !jobDetails.trim() ||
                  asNumber(priceExVat) <= 0
                }
                className="mt-5 w-full rounded-xl bg-green-700 px-4 py-3 font-bold text-white shadow-sm hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {writing ? 'Writing quote…' : '🌿 Write Up Quote'}
              </button>
            </div>
          </section>

          <section className="space-y-6">
            {pricingResult ? (
              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-green-700">
                      Internal use
                    </p>

                    <h2 className="text-xl font-bold text-slate-900">
                      Pricing recommendation
                    </h2>
                  </div>

                  <div className="rounded-xl bg-green-50 px-4 py-2 text-right">
                    <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                      Suggested price
                    </p>

                    <p className="text-xl font-bold text-green-800">
                      {money(pricingResult.recommendedPriceExVat)} + VAT
                    </p>
                  </div>
                </div>

                <p className="mt-4 text-sm leading-6 text-slate-700">
                  {pricingResult.summary}
                </p>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Estimated duration
                    </p>

                    <p className="mt-1 font-bold text-slate-900">
                      {pricingResult.estimatedDuration?.description ||
                        'Not supplied'}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Estimated hard costs
                    </p>

                    <p className="mt-1 font-bold text-slate-900">
                      {money(pricingResult.estimatedHardCosts)}
                    </p>
                  </div>
                </div>

                {pricingResult.costBreakdown?.length ? (
                  <div className="mt-5">
                    <h3 className="font-bold text-slate-900">
                      Cost breakdown
                    </h3>

                    <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
                      {pricingResult.costBreakdown.map((item, index) => (
                        <div
                          key={`${item.category}-${index}`}
                          className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3 last:border-b-0"
                        >
                          <div>
                            <p className="font-semibold text-slate-900">
                              {item.category}
                            </p>

                            <p className="text-sm text-slate-600">
                              {item.description}
                            </p>
                          </div>

                          <p className="whitespace-nowrap font-bold text-slate-900">
                            {money(item.estimatedCost)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {pricingResult.assumptions?.length ? (
                  <ListSection
                    title="Assumptions used"
                    items={pricingResult.assumptions}
                  />
                ) : null}

                {pricingResult.missingInformation?.length ? (
                  <ListSection
                    title="Check before confirming"
                    items={pricingResult.missingInformation}
                    warning
                  />
                ) : null}

                {pricingResult.pricingNotes?.length ? (
                  <ListSection
                    title="Internal pricing notes"
                    items={pricingResult.pricingNotes}
                  />
                ) : null}
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-8 text-center">
                <p className="text-4xl">🧮</p>

                <h2 className="mt-3 text-lg font-bold text-slate-900">
                  Pricing will appear here
                </h2>

                <p className="mt-1 text-sm text-slate-600">
                  Press Price Job to generate labour, materials, hard costs and
                  a recommended selling price.
                </p>
              </div>
            )}

            {quoteResult ? (
              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-green-700">
                      Customer ready
                    </p>

                    <h2 className="text-xl font-bold text-slate-900">
                      WhatsApp quotation
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopy}
                    disabled={copying}
                    className="rounded-xl bg-green-700 px-4 py-2 text-sm font-bold text-white hover:bg-green-800 disabled:opacity-50"
                  >
                    {copying ? 'Copying…' : 'Copy quote'}
                  </button>
                </div>

                <textarea
                  value={quoteResult.whatsappQuote}
                  onChange={(event) =>
                    setQuoteResult((current) =>
                      current
                        ? {
                            ...current,
                            whatsappQuote: event.target.value,
                          }
                        : current
                    )
                  }
                  rows={24}
                  className="mt-4 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                />

                {quoteResult.warnings?.length ? (
                  <ListSection
                    title="Check before sending"
                    items={quoteResult.warnings}
                    warning
                  />
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  )
}

function ListSection({
  title,
  items,
  warning = false,
}: {
  title: string
  items: string[]
  warning?: boolean
}) {
  if (!items?.length) return null

  return (
    <div
      className={`mt-5 rounded-xl p-4 ${
        warning
          ? 'border border-amber-200 bg-amber-50'
          : 'border border-slate-200 bg-slate-50'
      }`}
    >
      <h3
        className={`font-bold ${
          warning ? 'text-amber-900' : 'text-slate-900'
        }`}
      >
        {title}
      </h3>

      <ul
        className={`mt-2 space-y-2 text-sm ${
          warning ? 'text-amber-900' : 'text-slate-700'
        }`}
      >
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="flex gap-2">
            <span aria-hidden="true">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}