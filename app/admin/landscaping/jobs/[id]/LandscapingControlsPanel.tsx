'use client'

import { useMemo, useState } from 'react'

type Material = {
  item: string
  neededQuantity?: string
  orderQuantity?: string
  quantity: string
}

type TrackingStatus = 'not_ordered' | 'ordered' | 'delivered' | 'stock'

type TrackingRow = {
  status: TrackingStatus
  supplier: string
  deliveryDate: string
}

type ExtraItem = {
  id: string
  type: 'material' | 'tool'
  item: string
  quantity: string
  status: 'needed' | 'bought' | 'on_site'
  note: string
}

type InitialControls = {
  materials: Record<string, TrackingRow>
  customerExtras?: string[]
  extraItems?: ExtraItem[]
}

type ReviewMessage = {
  question: string
  answer: string
}

type Props = {
  jobId: number
  materials: Material[]
  initialControls: InitialControls
  packReady: boolean
  teamBooked: boolean
  bookedStartDate: string | null
  initialMessages: ReviewMessage[]
}

const EMPTY_TRACKING: TrackingRow = {
  status: 'not_ordered',
  supplier: '',
  deliveryDate: '',
}

function prettyStatus(value: TrackingStatus) {
  if (value === 'ordered') return 'Ordered'
  if (value === 'delivered') return 'Delivered'
  if (value === 'stock') return 'Using stock'
  return 'Not ordered'
}

function prettyExtraStatus(value: ExtraItem['status']) {
  if (value === 'bought') return 'Bought'
  if (value === 'on_site') return 'On site'
  return 'Needed'
}

function formatDate(value: string | null) {
  if (!value) return 'Not booked'
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function newExtraItem(): ExtraItem {
  return {
    id: `extra-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'material',
    item: '',
    quantity: '',
    status: 'needed',
    note: '',
  }
}

export default function LandscapingControlsPanel({
  jobId,
  materials,
  initialControls,
  packReady,
  teamBooked,
  bookedStartDate,
  initialMessages,
}: Props) {
  const [tracking, setTracking] = useState<Record<string, TrackingRow>>(() => {
    const result: Record<string, TrackingRow> = {}
    for (const material of materials) {
      result[material.item] = initialControls.materials[material.item] || EMPTY_TRACKING
    }
    return result
  })
  const [customerExtrasText, setCustomerExtrasText] = useState(
    (initialControls.customerExtras || []).join('\n')
  )
  const [extraItems, setExtraItems] = useState<ExtraItem[]>(initialControls.extraItems || [])
  const [saving, setSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState('')
  const [saveError, setSaveError] = useState('')
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const [askError, setAskError] = useState('')
  const [messages, setMessages] = useState<ReviewMessage[]>(initialMessages)

  const readiness = useMemo(() => {
    const rows = materials.map((material) => tracking[material.item] || EMPTY_TRACKING)
    const materialsOrdered = materials.length > 0 && rows.every((row) => row.status !== 'not_ordered')
    const deliveryConfirmed = materials.length > 0 && rows.every((row) => {
      if (row.status === 'stock' || row.status === 'delivered') return true
      if (row.status === 'ordered') return Boolean(row.deliveryDate)
      return false
    })
    const unresolvedExtras = extraItems.some((item) => item.item.trim() && item.status === 'needed')
    const readyToStart = packReady && materialsOrdered && teamBooked && deliveryConfirmed && !unresolvedExtras

    return {
      materialsOrdered,
      deliveryConfirmed,
      unresolvedExtras,
      readyToStart,
    }
  }, [materials, tracking, packReady, teamBooked, extraItems])

  function updateMaterial(item: string, patch: Partial<TrackingRow>) {
    setTracking((current) => ({
      ...current,
      [item]: {
        ...(current[item] || EMPTY_TRACKING),
        ...patch,
      },
    }))
    setSavedMessage('')
  }

  function updateExtra(id: string, patch: Partial<ExtraItem>) {
    setExtraItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item))
    setSavedMessage('')
  }

  async function saveTracking() {
    try {
      setSaving(true)
      setSaveError('')
      setSavedMessage('')

      const customerExtras = customerExtrasText
        .split('\n')
        .map((value) => value.trim())
        .filter(Boolean)
      const cleanedExtraItems = extraItems.filter((item) => item.item.trim())

      const response = await fetch(`/api/landscaping/jobs/${jobId}/controls`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materials: tracking,
          customerExtras,
          extraItems: cleanedExtraItems,
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || 'Could not save landscaping controls.')
      }

      setExtraItems(cleanedExtraItems)
      setSavedMessage('Job controls saved — worker sheet updated.')
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save landscaping controls.')
    } finally {
      setSaving(false)
    }
  }

  async function askChas() {
    const clean = question.trim()
    if (!clean || asking) return

    try {
      setAsking(true)
      setAskError('')

      const response = await fetch(`/api/landscaping/jobs/${jobId}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: clean }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || 'CHAS could not answer that right now.')
      }

      setMessages((current) => [...current, { question: clean, answer: data.answer }])
      setQuestion('')
    } catch (error) {
      setAskError(error instanceof Error ? error.message : 'CHAS could not answer that right now.')
    } finally {
      setAsking(false)
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Job readiness</div>
            <h2 className="mt-1 text-xl font-black">Is this job genuinely ready to start?</h2>
            <p className="mt-1 text-sm text-zinc-600">Booked start: {formatDate(bookedStartDate)}</p>
          </div>
          <div className={`rounded-2xl px-4 py-3 text-sm font-black ${readiness.readyToStart ? 'bg-green-100 text-green-950' : 'bg-amber-100 text-amber-950'}`}>
            {readiness.readyToStart ? '✓ Ready to start' : '⚠ Still needs attention'}
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
          <ReadinessPill label="Pack ready" ready={packReady} />
          <ReadinessPill label="Materials ordered" ready={readiness.materialsOrdered} />
          <ReadinessPill label="Team booked" ready={teamBooked} />
          <ReadinessPill label="Delivery confirmed" ready={readiness.deliveryConfirmed} />
          <ReadinessPill label="Extras covered" ready={!readiness.unresolvedExtras} />
          <ReadinessPill label="Ready to start" ready={readiness.readyToStart} />
        </div>
      </section>

      <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Material ordering</div>
            <h2 className="mt-1 text-xl font-black">What has actually been sorted?</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-600">
              Keep the calculated order quantity separate from the buying status. “Using stock” counts as covered without creating a delivery.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void saveTracking()}
            disabled={saving}
            className="min-h-11 rounded-xl bg-zinc-950 px-4 text-sm font-black text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save job controls'}
          </button>
        </div>

        {savedMessage ? <div className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-sm font-bold text-green-800">{savedMessage}</div> : null}
        {saveError ? <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-800">{saveError}</div> : null}

        <div className="mt-4 space-y-3">
          {materials.map((material) => {
            const row = tracking[material.item] || EMPTY_TRACKING
            return (
              <div key={material.item} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="grid gap-3 xl:grid-cols-[1.3fr_1fr_170px_1fr_170px] xl:items-end">
                  <div>
                    <div className="font-black text-zinc-950">{material.item}</div>
                    <div className="mt-1 text-xs leading-5 text-zinc-500">Order: {material.orderQuantity || material.neededQuantity || material.quantity}</div>
                  </div>
                  <label className="text-xs font-bold text-zinc-600">
                    Status
                    <select
                      value={row.status}
                      onChange={(event) => updateMaterial(material.item, { status: event.target.value as TrackingStatus })}
                      className="mt-1 min-h-10 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-900"
                    >
                      <option value="not_ordered">Not ordered</option>
                      <option value="ordered">Ordered</option>
                      <option value="delivered">Delivered</option>
                      <option value="stock">Using stock</option>
                    </select>
                  </label>
                  <div className="rounded-xl bg-white px-3 py-2 text-center text-xs font-black text-zinc-700 ring-1 ring-inset ring-zinc-200">
                    {prettyStatus(row.status)}
                  </div>
                  <label className="text-xs font-bold text-zinc-600">
                    Supplier
                    <input
                      value={row.supplier}
                      onChange={(event) => updateMaterial(material.item, { supplier: event.target.value })}
                      placeholder="e.g. local / Travis Perkins"
                      className="mt-1 min-h-10 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900"
                    />
                  </label>
                  <label className="text-xs font-bold text-zinc-600">
                    Delivery
                    <input
                      type="date"
                      value={row.deliveryDate}
                      onChange={(event) => updateMaterial(material.item, { deliveryDate: event.target.value })}
                      disabled={row.status === 'stock' || row.status === 'delivered'}
                      className="mt-1 min-h-10 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 disabled:bg-zinc-100"
                    />
                  </label>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">Live site additions</div>
            <h2 className="mt-1 text-xl font-black text-blue-950">Customer extras & additional materials/tools</h2>
            <p className="mt-1 max-w-4xl text-sm leading-6 text-blue-900">
              Put agreed customer add-ons here so the lads can see them. Add any extra material or tool that becomes necessary, including things already bought on the way to site. This does not rewrite the accepted quote or locked projected costs.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setExtraItems((current) => [...current, newExtraItem()])}
            className="min-h-10 rounded-xl border border-blue-300 bg-white px-4 text-sm font-black text-blue-900"
          >
            + Add material/tool
          </button>
        </div>

        <label className="mt-4 block">
          <span className="text-xs font-black uppercase tracking-wide text-blue-800">Customer-requested extras</span>
          <textarea
            value={customerExtrasText}
            onChange={(event) => {
              setCustomerExtrasText(event.target.value)
              setSavedMessage('')
            }}
            rows={4}
            placeholder={'One agreed extra per line\ne.g. Move two existing planters to rear corner'}
            className="mt-2 w-full rounded-2xl border border-blue-200 bg-white px-4 py-3 text-sm leading-6 text-zinc-900"
          />
        </label>

        <div className="mt-4 space-y-3">
          {extraItems.length ? extraItems.map((item) => (
            <div key={item.id} className="rounded-2xl bg-white p-4 ring-1 ring-inset ring-blue-200">
              <div className="grid gap-3 xl:grid-cols-[140px_1.3fr_180px_150px_1fr_auto] xl:items-end">
                <label className="text-xs font-bold text-zinc-600">
                  Type
                  <select
                    value={item.type}
                    onChange={(event) => updateExtra(item.id, { type: event.target.value as ExtraItem['type'] })}
                    className="mt-1 min-h-10 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm"
                  >
                    <option value="material">Material</option>
                    <option value="tool">Tool / plant</option>
                  </select>
                </label>
                <label className="text-xs font-bold text-zinc-600">
                  Item
                  <input
                    value={item.item}
                    onChange={(event) => updateExtra(item.id, { item: event.target.value })}
                    placeholder="e.g. extra diamond blade"
                    className="mt-1 min-h-10 w-full rounded-xl border border-zinc-300 px-3 text-sm"
                  />
                </label>
                <label className="text-xs font-bold text-zinc-600">
                  Quantity
                  <input
                    value={item.quantity}
                    onChange={(event) => updateExtra(item.id, { quantity: event.target.value })}
                    placeholder="e.g. 2 boxes"
                    className="mt-1 min-h-10 w-full rounded-xl border border-zinc-300 px-3 text-sm"
                  />
                </label>
                <label className="text-xs font-bold text-zinc-600">
                  Status
                  <select
                    value={item.status}
                    onChange={(event) => updateExtra(item.id, { status: event.target.value as ExtraItem['status'] })}
                    className="mt-1 min-h-10 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm font-bold"
                  >
                    <option value="needed">Needed</option>
                    <option value="bought">Bought</option>
                    <option value="on_site">On site</option>
                  </select>
                </label>
                <label className="text-xs font-bold text-zinc-600">
                  Note
                  <input
                    value={item.note}
                    onChange={(event) => updateExtra(item.id, { note: event.target.value })}
                    placeholder="Why / where / who has it"
                    className="mt-1 min-h-10 w-full rounded-xl border border-zinc-300 px-3 text-sm"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setExtraItems((current) => current.filter((row) => row.id !== item.id))}
                  className="min-h-10 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-black text-red-700"
                >
                  Remove
                </button>
              </div>
              <div className="mt-2 text-xs font-bold text-blue-800">Worker sheet status: {prettyExtraStatus(item.status)}</div>
            </div>
          )) : (
            <div className="rounded-2xl bg-white px-4 py-3 text-sm text-blue-900 ring-1 ring-inset ring-blue-200">
              No additional materials or tools recorded yet.
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => void saveTracking()}
          disabled={saving}
          className="mt-4 min-h-11 rounded-xl bg-blue-900 px-4 text-sm font-black text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save extras to worker sheet'}
        </button>
      </section>

      <section className="rounded-3xl border border-yellow-200 bg-yellow-50 p-5 shadow-sm">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-yellow-800">Ask CHAS about this plan</div>
        <h2 className="mt-1 text-xl font-black text-zinc-950">Challenge the pack without leaving the job</h2>
        <p className="mt-1 max-w-4xl text-sm leading-6 text-zinc-700">
          Ask why a quantity is there, whether a day looks realistic, what might be missing or why the margin looks low. CHAS sees this job’s accepted scope, plan, materials, costs and order status.
        </p>

        {messages.length ? (
          <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto rounded-2xl bg-white p-4 ring-1 ring-inset ring-yellow-200">
            {messages.map((message, index) => (
              <div key={`${index}-${message.question.slice(0, 20)}`}>
                <div className="ml-auto max-w-[88%] rounded-2xl bg-zinc-950 px-4 py-3 text-sm text-white">{message.question}</div>
                <div className="mt-2 max-w-[92%] whitespace-pre-wrap rounded-2xl bg-yellow-50 px-4 py-3 text-sm leading-6 text-zinc-800 ring-1 ring-inset ring-yellow-200">{message.answer}</div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="e.g. Why have you allowed 4 bulk bags of Type 1 here?"
            rows={3}
            className="min-h-[86px] flex-1 rounded-2xl border border-yellow-300 bg-white px-4 py-3 text-sm text-zinc-900"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void askChas()
              }
            }}
          />
          <button
            type="button"
            onClick={() => void askChas()}
            disabled={asking || !question.trim()}
            className="min-h-12 rounded-2xl bg-zinc-950 px-5 text-sm font-black text-white disabled:opacity-50 sm:self-end"
          >
            {asking ? 'CHAS is checking…' : 'Ask CHAS'}
          </button>
        </div>
        {askError ? <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-800">{askError}</div> : null}
      </section>
    </div>
  )
}

function ReadinessPill({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className={`rounded-2xl px-3 py-3 text-sm font-black ring-1 ring-inset ${ready ? 'bg-green-50 text-green-900 ring-green-200' : 'bg-zinc-50 text-zinc-500 ring-zinc-200'}`}>
      {ready ? '✓' : '○'} {label}
    </div>
  )
}
