'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type Material = {
  item: string
  quantity: string
  neededQuantity?: string
  orderQuantity?: string
  orderFor: string
  estimatedCostExVat: number
  actualCostExVat: number | null
  note: string
}

type Props = {
  jobId: number
  sellingPriceExVat: number
  projectedLabourExVat: number
  projectedPlantWasteExVat: number
  projectedOtherExVat: number
  materials: Material[]
  actualCosts: {
    labourExVat: number | null
    plantWasteExVat: number | null
    otherExVat: number | null
    updatedAt: string | null
  }
}

function money(value: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(Number.isFinite(value) ? value : 0)
}

function valueOrBlank(value: number | null) {
  return value == null ? '' : String(value)
}

function parseOptional(value: string) {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? Number(parsed.toFixed(2)) : null
}

export default function CostTracker({
  jobId,
  sellingPriceExVat,
  projectedLabourExVat,
  projectedPlantWasteExVat,
  projectedOtherExVat,
  materials,
  actualCosts,
}: Props) {
  const router = useRouter()
  const [materialProjected, setMaterialProjected] = useState(
    materials.map((material) => String(material.estimatedCostExVat ?? 0))
  )
  const [materialActuals, setMaterialActuals] = useState(
    materials.map((material) => valueOrBlank(material.actualCostExVat))
  )
  const [labourActual, setLabourActual] = useState(valueOrBlank(actualCosts.labourExVat))
  const [plantWasteActual, setPlantWasteActual] = useState(valueOrBlank(actualCosts.plantWasteExVat))
  const [otherActual, setOtherActual] = useState(valueOrBlank(actualCosts.otherExVat))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const totals = useMemo(() => {
    const projectedMaterials = materialProjected.reduce((sum, value, index) => {
      const parsed = parseOptional(value)
      return sum + (parsed ?? materials[index]?.estimatedCostExVat ?? 0)
    }, 0)

    const liveMaterials = materials.reduce((sum, material, index) => {
      const actual = parseOptional(materialActuals[index] || '')
      const projected = parseOptional(materialProjected[index] || '') ?? material.estimatedCostExVat
      return sum + (actual ?? projected)
    }, 0)

    const labour = parseOptional(labourActual) ?? projectedLabourExVat
    const plantWaste = parseOptional(plantWasteActual) ?? projectedPlantWasteExVat
    const other = parseOptional(otherActual) ?? projectedOtherExVat

    const projectedTotal =
      projectedMaterials +
      projectedLabourExVat +
      projectedPlantWasteExVat +
      projectedOtherExVat

    const liveTotal = liveMaterials + labour + plantWaste + other
    const liveGrossProfit = sellingPriceExVat - liveTotal
    const liveGrossProfitPercent =
      sellingPriceExVat > 0 ? (liveGrossProfit / sellingPriceExVat) * 100 : 0

    const actualEntriesCount =
      materialActuals.filter((value) => parseOptional(value) != null).length +
      [labourActual, plantWasteActual, otherActual].filter(
        (value) => parseOptional(value) != null
      ).length

    return {
      projectedMaterials,
      liveMaterials,
      projectedTotal,
      liveTotal,
      liveGrossProfit,
      liveGrossProfitPercent,
      actualEntriesCount,
    }
  }, [
    materials,
    materialProjected,
    materialActuals,
    labourActual,
    plantWasteActual,
    otherActual,
    projectedLabourExVat,
    projectedPlantWasteExVat,
    projectedOtherExVat,
    sellingPriceExVat,
  ])

  async function save() {
    try {
      setSaving(true)
      setMessage('')
      setError('')

      const response = await fetch(`/api/landscaping/jobs/${jobId}/plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materialProjectedCosts: materialProjected.map(parseOptional),
          materialActualCosts: materialActuals.map(parseOptional),
          labourExVat: parseOptional(labourActual),
          plantWasteExVat: parseOptional(plantWasteActual),
          otherExVat: parseOptional(otherActual),
        }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || 'Could not save landscaping costs.')
      }

      setMessage('Costs saved — projected and live margin figures are now stored with this job.')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save landscaping costs.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
            Materials & live job costs
          </div>
          <h2 className="mt-1 text-xl font-black">What we need, what to order, what it costs</h2>
          <p className="mt-1 max-w-4xl text-sm leading-6 text-zinc-600">
            “Needed” is the calculated job requirement. “Order now” is deliberately rounded down where sensible so existing usable Furlads stock can cover the balance. Projected cost stays conservative and can be corrected before the invoice arrives; actual cost is what we really paid.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="min-h-11 rounded-xl bg-zinc-950 px-4 text-sm font-black text-white disabled:opacity-50"
        >
          {saving ? 'Saving costs…' : 'Save costs'}
        </button>
      </div>

      {message ? (
        <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          {error}
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-zinc-50 p-4 ring-1 ring-inset ring-zinc-200">
          <div className="text-xs font-black uppercase tracking-wide text-zinc-500">Projected cost</div>
          <div className="mt-1 text-2xl font-black">{money(totals.projectedTotal)}</div>
        </div>
        <div className="rounded-2xl bg-blue-50 p-4 ring-1 ring-inset ring-blue-200">
          <div className="text-xs font-black uppercase tracking-wide text-blue-700">Live tracked cost</div>
          <div className="mt-1 text-2xl font-black text-blue-950">{money(totals.liveTotal)}</div>
          <div className="mt-1 text-xs text-blue-800">{totals.actualEntriesCount} actual figure{totals.actualEntriesCount === 1 ? '' : 's'} entered</div>
        </div>
        <div className="rounded-2xl bg-green-50 p-4 ring-1 ring-inset ring-green-200">
          <div className="text-xs font-black uppercase tracking-wide text-green-700">Live gross profit</div>
          <div className="mt-1 text-2xl font-black text-green-950">{money(totals.liveGrossProfit)}</div>
        </div>
        <div className="rounded-2xl bg-green-50 p-4 ring-1 ring-inset ring-green-200">
          <div className="text-xs font-black uppercase tracking-wide text-green-700">Live GP %</div>
          <div className="mt-1 text-2xl font-black text-green-950">{totals.liveGrossProfitPercent.toFixed(1)}%</div>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[1260px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-3 py-3">Item</th>
              <th className="px-3 py-3">Needed</th>
              <th className="px-3 py-3">Order now</th>
              <th className="px-3 py-3">Projected ex VAT</th>
              <th className="px-3 py-3">Actual ex VAT</th>
              <th className="px-3 py-3">Variance</th>
              <th className="px-3 py-3">Note</th>
            </tr>
          </thead>
          <tbody>
            {materials.map((material, index) => {
              const projected = parseOptional(materialProjected[index] || '') ?? material.estimatedCostExVat
              const actual = parseOptional(materialActuals[index] || '')
              const variance = actual == null ? null : actual - projected

              return (
                <tr key={`${material.item}-${index}`} className="border-b border-zinc-100 align-top">
                  <td className="px-3 py-3 font-bold text-zinc-900">{material.item}</td>
                  <td className="max-w-[260px] px-3 py-3 text-zinc-700">
                    {material.neededQuantity || material.quantity}
                  </td>
                  <td className="max-w-[240px] px-3 py-3 font-semibold text-blue-900">
                    {material.orderQuantity || material.neededQuantity || material.quantity}
                  </td>
                  <td className="px-3 py-3">
                    <MoneyInput
                      value={materialProjected[index] || ''}
                      onChange={(value) => {
                        const next = [...materialProjected]
                        next[index] = value
                        setMaterialProjected(next)
                      }}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <MoneyInput
                      value={materialActuals[index] || ''}
                      placeholder="Invoice"
                      onChange={(value) => {
                        const next = [...materialActuals]
                        next[index] = value
                        setMaterialActuals(next)
                      }}
                    />
                  </td>
                  <td className={`px-3 py-3 font-bold ${variance == null ? 'text-zinc-400' : variance <= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {variance == null ? '—' : `${variance > 0 ? '+' : ''}${money(variance)}`}
                  </td>
                  <td className="max-w-[300px] px-3 py-3 text-zinc-600">{material.note || '—'}</td>
                </tr>
              )
            })}

            <CostRow
              label="Labour"
              projected={projectedLabourExVat}
              value={labourActual}
              onChange={setLabourActual}
              note="Actual labour can replace the planned allowance when the job progresses/completes."
            />
            <CostRow
              label="Plant & waste"
              projected={projectedPlantWasteExVat}
              value={plantWasteActual}
              onChange={setPlantWasteActual}
              note="Grab/skip, hired plant, fuel and waste charges grouped here."
            />
            <CostRow
              label="Other / consumables"
              projected={projectedOtherExVat}
              value={otherActual}
              onChange={setOtherActual}
              note="Discs, blades, sundries and other job-specific costs not captured above."
            />
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-zinc-950 px-4 py-4 text-white">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-zinc-400">Selling price ex VAT</div>
          <div className="text-xl font-black">{money(sellingPriceExVat)}</div>
        </div>
        <div className="text-right">
          <div className="text-xs font-bold uppercase tracking-wide text-zinc-400">Live final forecast</div>
          <div className="text-xl font-black">Cost {money(totals.liveTotal)} · GP {money(totals.liveGrossProfit)} · {totals.liveGrossProfitPercent.toFixed(1)}%</div>
        </div>
      </div>
    </section>
  )
}

function MoneyInput({
  value,
  onChange,
  placeholder = 'Enter',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <div className="relative w-32">
      <span className="pointer-events-none absolute left-3 top-2.5 text-zinc-400">£</span>
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-10 w-full rounded-xl border border-zinc-300 bg-white pl-7 pr-2 text-sm"
      />
    </div>
  )
}

function CostRow({
  label,
  projected,
  value,
  onChange,
  note,
}: {
  label: string
  projected: number
  value: string
  onChange: (value: string) => void
  note: string
}) {
  const actual = parseOptional(value)
  const variance = actual == null ? null : actual - projected

  return (
    <tr className="border-b border-zinc-100 align-top bg-zinc-50/60">
      <td className="px-3 py-3 font-bold text-zinc-900">{label}</td>
      <td className="px-3 py-3 text-zinc-500">—</td>
      <td className="px-3 py-3 text-zinc-500">—</td>
      <td className="px-3 py-3 font-bold text-zinc-900">{money(projected)}</td>
      <td className="px-3 py-3">
        <MoneyInput value={value} onChange={onChange} />
      </td>
      <td className={`px-3 py-3 font-bold ${variance == null ? 'text-zinc-400' : variance <= 0 ? 'text-green-700' : 'text-red-700'}`}>
        {variance == null ? '—' : `${variance > 0 ? '+' : ''}${money(variance)}`}
      </td>
      <td className="px-3 py-3 text-zinc-600">{note}</td>
    </tr>
  )
}
