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

type InitialControls = {
  materials: Record<string, TrackingRow>
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
    const readyToStart = packReady && materialsOrdered && teamBooked && deliveryConfirmed

    return {
      materialsOrdered,
      deliveryConfirmed,
      readyToStart,
    }
  }, [materials, tracking, packReady, teamBooked])

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

  async function saveTracking() {
    try {
      setSaving(true)
      setSaveError('')
      setSavedMessage('')

      const response = await fetch(`/api/landscaping/jobs/${jobId}/controls`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ materials: tracking }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || 'Could not save material ordering status.')
      }

      setSavedMessage('Ordering status saved.')
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save material ordering status.')
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

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <ReadinessPill label="Pack ready" ready={packReady} />
          <ReadinessPill label="Materials ordered" ready={readiness.materialsOrdered} />
          <ReadinessPill label="Team booked" ready={teamBooked} />
          <ReadinessPill label="Delivery confirmed" ready={readiness.deliveryConfirmed} />
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
            {saving ? 'Saving…' : 'Save ordering status'}
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
