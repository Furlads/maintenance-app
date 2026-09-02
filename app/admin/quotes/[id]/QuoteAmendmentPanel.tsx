'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type CostRow = {
  category: string
  amount: number
  detail: string
}

type Preview = {
  summary: string
  before: {
    priceExVat: number
    vatAmount: number
    totalIncVat: number
    depositAmount: number
    estimatedDays: number | null
    estimatedTeamSize: number | null
  }
  after: {
    priceExVat: number
    vatRate: number
    vatAmount: number
    totalIncVat: number
    depositPercent: number
    depositAmount: number
    scope: string
    quoteWorking: string
    customerMessage: string
    estimatedDays: number | null
    estimatedTeamSize: number | null
    estimatedHardCosts: number
    grossProfit: number | null
    grossMarginPercent: number | null
    costBreakdown: CostRow[]
  }
  notes: string[]
}

type Props = {
  quoteId: number
  status: string
  jobId: number | null
  totalIncVat: number
}

function money(value: number | null | undefined) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(Number.isFinite(Number(value)) ? Number(value) : 0)
}

export default function QuoteAmendmentPanel({ quoteId, status, jobId, totalIncVat }: Props) {
  const router = useRouter()
  const [instruction, setInstruction] = useState('')
  const [allInPrice, setAllInPrice] = useState(String(totalIncVat || ''))
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState<'preview' | 'apply' | ''>('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const isCommercialQuote = ['sent', 'accepted'].includes(status) || Boolean(jobId)
  const changedPrice = useMemo(() => {
    const next = Number(allInPrice)
    return Number.isFinite(next) && next > 0 && Math.abs(next - totalIncVat) >= 0.01
  }, [allInPrice, totalIncVat])

  if (!isCommercialQuote) return null

  async function run(mode: 'preview' | 'apply') {
    try {
      setBusy(mode)
      setError('')
      setSuccess('')

      const response = await fetch(`/api/quotes/${quoteId}/amend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          instruction: instruction.trim(),
          totalIncVatOverride: changedPrice ? Number(allInPrice) : null,
        }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || 'Could not process quote amendment.')
      }

      setPreview(data.preview)

      if (mode === 'apply') {
        setSuccess(
          data.planningWarning
            ? `Amendment saved. ${data.planningWarning}`
            : 'Amendment saved and the linked job planning has been refreshed.'
        )
        setInstruction('')
        setAllInPrice(String(data.preview.after.totalIncVat))
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not process quote amendment.')
    } finally {
      setBusy('')
    }
  }

  const gp = preview?.after.grossMarginPercent
  const gpClass =
    gp == null
      ? 'border-zinc-200 bg-zinc-50 text-zinc-700'
      : gp < 30
        ? 'border-red-200 bg-red-50 text-red-800'
        : gp < 35
          ? 'border-amber-200 bg-amber-50 text-amber-900'
          : 'border-green-200 bg-green-50 text-green-900'

  return (
    <section className="rounded-2xl border border-violet-200 bg-violet-50 p-5 shadow-sm">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.16em] text-violet-700">Commercial amendment</div>
          <h2 className="mt-1 text-xl font-black text-zinc-950">Change a sent/accepted quote safely</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-700">
            Tell CHAS what to remove or change, adjust the customer&apos;s all-in price if needed, then preview the effect before anything is saved.
          </p>
        </div>
        <span className="w-fit rounded-full bg-white px-3 py-1.5 text-xs font-black text-violet-800 ring-1 ring-inset ring-violet-200">
          Current total {money(totalIncVat)}
        </span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_220px]">
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-600">What needs changing?</span>
          <textarea
            value={instruction}
            onChange={(event) => {
              setInstruction(event.target.value)
              setPreview(null)
            }}
            rows={3}
            placeholder="e.g. Remove Option C completely and keep Options A, B and D"
            className="w-full rounded-xl border border-violet-200 bg-white px-3 py-3 text-sm leading-6"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-600">New total inc VAT</span>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-3 text-sm font-bold text-zinc-500">£</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={allInPrice}
              onChange={(event) => {
                setAllInPrice(event.target.value)
                setPreview(null)
              }}
              className="min-h-11 w-full rounded-xl border border-violet-200 bg-white pl-7 pr-3 text-sm font-bold"
            />
          </div>
          <p className="mt-1 text-xs leading-5 text-zinc-500">Changing this changes revenue/GP, not the underlying job costs.</p>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void run('preview')}
          disabled={Boolean(busy) || (!instruction.trim() && !changedPrice)}
          className="min-h-11 rounded-xl bg-violet-700 px-4 text-sm font-black text-white disabled:opacity-50"
        >
          {busy === 'preview' ? 'Checking impact…' : 'Preview amendment'}
        </button>
        {preview ? (
          <button
            type="button"
            onClick={() => void run('apply')}
            disabled={Boolean(busy)}
            className="min-h-11 rounded-xl bg-zinc-950 px-4 text-sm font-black text-white disabled:opacity-50"
          >
            {busy === 'apply' ? 'Saving amendment…' : 'Apply amendment'}
          </button>
        ) : null}
      </div>

      {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</div> : null}
      {success ? <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-800">{success}</div> : null}

      {preview ? (
        <div className="mt-5 space-y-4 border-t border-violet-200 pt-5">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">Preview</div>
            <div className="mt-1 text-sm font-bold text-zinc-900">{preview.summary}</div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Old customer total" value={money(preview.before.totalIncVat)} />
            <Metric label="New customer total" value={money(preview.after.totalIncVat)} strong />
            <Metric label="New ex VAT revenue" value={money(preview.after.priceExVat)} />
            <Metric label="New deposit" value={money(preview.after.depositAmount)} />
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px]">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-xs font-black uppercase tracking-wide text-zinc-500">Internal job costs</div>
              {preview.after.costBreakdown.length ? (
                <div className="mt-3 space-y-2">
                  {preview.after.costBreakdown.map((row, index) => (
                    <div key={`${row.category}-${index}`} className="flex items-start justify-between gap-4 text-sm">
                      <div>
                        <div className="font-bold text-zinc-900">{row.category}</div>
                        {row.detail ? <div className="text-xs leading-5 text-zinc-500">{row.detail}</div> : null}
                      </div>
                      <div className="whitespace-nowrap font-black text-zinc-950">{money(row.amount)}</div>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-zinc-200 pt-2 text-sm font-black">
                    <span>Total job cost</span>
                    <span>{money(preview.after.estimatedHardCosts)}</span>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm leading-6 text-zinc-600">The stored quote does not contain enough supported costing detail for an exact labour/material split.</p>
              )}
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-xs font-black uppercase tracking-wide text-zinc-500">Gross profit</div>
              <div className="mt-2 text-2xl font-black text-zinc-950">
                {preview.after.grossProfit == null ? 'Not known' : money(preview.after.grossProfit)}
              </div>
            </div>

            <div className={`rounded-2xl border p-4 ${gpClass}`}>
              <div className="text-xs font-black uppercase tracking-wide">GP %</div>
              <div className="mt-2 text-2xl font-black">{gp == null ? 'Not known' : `${gp.toFixed(1)}%`}</div>
              {gp != null && gp < 30 ? <div className="mt-1 text-xs font-bold">Below the 30% minimum target</div> : null}
            </div>
          </div>

          <details className="rounded-2xl border border-violet-200 bg-white">
            <summary className="cursor-pointer px-4 py-3 text-sm font-black text-zinc-900">Review revised scope before applying</summary>
            <div className="border-t border-violet-100 p-4 whitespace-pre-wrap text-sm leading-6 text-zinc-700">{preview.after.scope}</div>
          </details>

          {preview.notes.length ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="font-black">CHAS notes</div>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {preview.notes.map((note) => <li key={note}>{note}</li>)}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function Metric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${strong ? 'border-violet-300 bg-violet-100' : 'border-zinc-200 bg-white'}`}>
      <div className="text-xs font-black uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-xl font-black text-zinc-950">{value}</div>
    </div>
  )
}
