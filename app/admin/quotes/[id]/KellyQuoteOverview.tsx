'use client'

import { useEffect, useState } from 'react'

type SurveyPhoto = {
  url: string
  fileName: string
}

type Costing = {
  materials: number
  labour: number
  plantWasteLogistics: number
  other: number
  totalDirectCost: number
  grossProfitEstimate: number
  grossMarginPercent: number
  labourManDays: number
  notes: string[]
  crewComparison: {
    jobProfile: string
    basedOnDefaultDuration?: boolean
    options: CrewOption[]
  }
}

type CrewOption = {
  crewId: number
  name: string
  dayRate: number
  expectedDays: number
  totalLabourCost: number
  skillLevel: string
  suitability: string
  transportWarning: string | null
  summary: string
  recommended: boolean
  reason: string
}

type Props = {
  quoteId: number
  priceExVat: number
  vatRate: number
  totalIncVat: number
  estimatedDays: number | null
  estimatedTeamSize: number | null
  surveyPhotos: SurveyPhoto[]
}

function money(value: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0)
}

export default function KellyQuoteOverview({
  quoteId,
  priceExVat,
  vatRate,
  totalIncVat,
  estimatedDays,
  estimatedTeamSize,
  surveyPhotos,
}: Props) {
  const [costing, setCosting] = useState<Costing | null>(null)
  const [costingError, setCostingError] = useState('')
  const [viewer, setViewer] = useState<SurveyPhoto | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadCosting() {
      try {
        setCostingError('')
        const response = await fetch(`/api/quotes/${quoteId}/costing`, {
          cache: 'no-store',
        })
        const data = await response.json().catch(() => null)
        if (!response.ok || !data?.ok) {
          throw new Error(data?.error || 'Could not estimate job costs.')
        }
        if (!cancelled) setCosting(data.costing)
      } catch (error) {
        if (!cancelled) {
          setCostingError(
            error instanceof Error ? error.message : 'Could not estimate job costs.'
          )
        }
      }
    }

    void loadCosting()
    return () => {
      cancelled = true
    }
  }, [quoteId])

  return (
    <>
      <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
        <div className="bg-zinc-950 p-5 text-white sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.18em] text-yellow-300">
                Most likely customer choice
              </div>
              <h2 className="mt-1 text-xl font-black">All work completed together</h2>
              <p className="mt-1 text-sm text-zinc-300">
                Use this as the headline figure when reviewing the quote with the customer.
              </p>
            </div>
            <div className="sm:text-right">
              <div className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                Total inc VAT
              </div>
              <div className="mt-1 text-4xl font-black text-yellow-300">
                {money(totalIncVat)}
              </div>
              <div className="mt-1 text-sm font-semibold text-zinc-300">
                {money(priceExVat)} + {vatRate}% VAT
              </div>
            </div>
          </div>

          {estimatedDays ? (
            <div className="mt-4 inline-flex rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-zinc-200">
              Est. {estimatedDays} {estimatedDays === 1 ? 'day' : 'days'} · {estimatedTeamSize || 1} {estimatedTeamSize === 1 ? 'person' : 'people'}
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
                  Internal estimated costs
                </div>
                <div className="mt-1 text-sm text-zinc-600">
                  Office sense-check only — not customer-facing.
                </div>
              </div>
              {costing ? (
                <div className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${costing.grossMarginPercent >= 30 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {costing.grossMarginPercent.toFixed(1)}% GP
                </div>
              ) : null}
            </div>

            {!costing && !costingError ? (
              <div className="mt-4 rounded-xl bg-white p-4 text-sm font-semibold text-zinc-500 ring-1 ring-inset ring-zinc-200">
                CHAS is estimating materials and labour…
              </div>
            ) : null}

            {costingError ? (
              <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
                {costingError}
              </div>
            ) : null}

            {costing ? (
              <div className="mt-4 space-y-2">
                <CostRow label="Materials" value={costing.materials} />
                <CostRow
                  label={costing.labourManDays ? `Labour · ${costing.labourManDays} man-days` : 'Labour'}
                  value={costing.labour}
                />
                <CostRow label="Plant / waste / logistics" value={costing.plantWasteLogistics} />
                {costing.other > 0 ? <CostRow label="Other / contingency" value={costing.other} /> : null}
                <div className="mt-3 flex items-center justify-between gap-4 border-t border-zinc-300 pt-3">
                  <span className="text-sm font-black text-zinc-900">Estimated direct cost</span>
                  <span className="whitespace-nowrap text-lg font-black text-zinc-950">{money(costing.totalDirectCost)}</span>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-xl bg-green-50 px-3 py-2.5 text-green-900">
                  <span className="text-sm font-black">Estimated gross profit</span>
                  <span className="whitespace-nowrap text-lg font-black">{money(costing.grossProfitEstimate)}</span>
                </div>
                {costing.notes.length ? (
                  <details className="group pt-1">
                    <summary className="cursor-pointer text-xs font-bold text-zinc-600">Cost assumptions</summary>
                    <div className="mt-2 text-xs leading-5 text-zinc-500">
                      {costing.notes.join(' · ')}
                    </div>
                  </details>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
                  Survey photos
                </div>
                <div className="mt-1 text-sm text-zinc-600">
                  What Trev saw when the job was quoted.
                </div>
              </div>
              <div className="rounded-full bg-white px-3 py-1 text-xs font-black text-zinc-700 ring-1 ring-inset ring-zinc-200">
                {surveyPhotos.length}
              </div>
            </div>

            {surveyPhotos.length ? (
              <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-5">
                {surveyPhotos.map((photo, index) => (
                  <button
                    key={`${photo.url}-${index}`}
                    type="button"
                    onClick={() => setViewer(photo)}
                    className="group relative aspect-square overflow-hidden rounded-xl bg-zinc-200 ring-1 ring-inset ring-zinc-300"
                    title={photo.fileName || `Survey photo ${index + 1}`}
                  >
                    <img
                      src={photo.url}
                      alt={photo.fileName || `Survey photo ${index + 1}`}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-500">
                No survey photos are attached to this quote.
              </div>
            )}
          </div>

          {costing?.crewComparison?.options?.length ? (
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 lg:col-span-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
                    Crew cost comparison
                  </div>
                  <div className="mt-1 text-sm text-zinc-600">
                    Compared by expected duration and total labour cost — not day rate alone.
                  </div>
                </div>
                <div className="text-xs font-bold text-zinc-500">
                  {costing.crewComparison.jobProfile === 'technical'
                    ? 'Technical / finish-critical scope detected'
                    : 'Standard work profile'}
                </div>
              </div>

              {costing.crewComparison.basedOnDefaultDuration ? (
                <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
                  The quote has no duration yet, so these figures use a one-day planning baseline. Add the expected days for a final comparison.
                </div>
              ) : null}

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {costing.crewComparison.options.map((option) => (
                  <div
                    key={option.crewId}
                    className={`rounded-2xl p-4 ring-1 ring-inset ${option.recommended ? 'bg-green-50 ring-green-300' : 'bg-white ring-zinc-200'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-black text-zinc-950">{option.name}</div>
                        <div className="mt-1 text-xs font-semibold text-zinc-500">
                          {option.skillLevel} · {option.suitability}
                        </div>
                      </div>
                      {option.recommended ? (
                        <span className="shrink-0 rounded-full bg-green-700 px-2.5 py-1 text-[11px] font-black text-white">
                          Recommended
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <CrewMetric label="Day rate" value={money(option.dayRate)} />
                      <CrewMetric label="Total labour" value={money(option.totalLabourCost)} />
                    </div>
                    <div className="mt-2 text-xs font-bold text-zinc-600">
                      Expected programme: {option.expectedDays} {option.expectedDays === 1 ? 'day' : 'days'}
                    </div>

                    <p className="mt-3 text-xs leading-5 text-zinc-600">{option.reason}</p>
                    {option.transportWarning ? (
                      <div className="mt-2 rounded-lg bg-amber-100 px-2.5 py-2 text-xs font-bold text-amber-900">
                        {option.transportWarning}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {viewer ? (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setViewer(null)}
        >
          <div className="max-h-[92vh] max-w-5xl" onClick={(event) => event.stopPropagation()}>
            <img
              src={viewer.url}
              alt={viewer.fileName || 'Survey photo'}
              className="max-h-[82vh] max-w-full rounded-2xl object-contain shadow-2xl"
            />
            <div className="mt-3 flex items-center justify-between gap-3 text-white">
              <span className="truncate text-sm font-semibold">{viewer.fileName || 'Survey photo'}</span>
              <button
                type="button"
                onClick={() => setViewer(null)}
                className="rounded-xl bg-white px-4 py-2 text-sm font-black text-zinc-950"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function CostRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2.5 ring-1 ring-inset ring-zinc-200">
      <span className="min-w-0 text-sm font-semibold text-zinc-600">{label}</span>
      <span className="shrink-0 whitespace-nowrap text-sm font-black text-zinc-950">{money(value)}</span>
    </div>
  )
}

function CrewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-white px-3 py-2 ring-1 ring-inset ring-zinc-200">
      <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">{label}</div>
      <div className="mt-1 whitespace-nowrap text-sm font-black text-zinc-900">{value}</div>
    </div>
  )
}
