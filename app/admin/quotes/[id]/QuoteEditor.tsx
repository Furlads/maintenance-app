'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

type QuoteReviewMessage = {
  id: number
  question: string
  answer: string
  createdAt?: string
}

type QuoteEditorProps = {
  quote: {
    id: number
    customerName: string | null
    customerPhone: string | null
    customerEmail: string | null
    customerAddress: string | null
    customerPostcode: string | null
    scope: string
    customerMessage: string | null
    internalNotes: string | null
    quoteWorking: string | null
    priceExVat: number
    vatRate: number
    depositPercent: number
    estimatedDays: number | null
    estimatedTeamSize: number | null
    status: string
    jobId: number | null
  }
}

const STANDARD_VAT_RATE = 20

function money(value: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(Number.isFinite(value) ? value : 0)
}

function asNumber(value: string, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function messageNeedsKellyRewrite(value: unknown) {
  const text = String(value || '').trim()
  const lower = text.toLowerCase()

  return (
    !text ||
    lower.includes('trevor at furlads') ||
    lower.includes('cheers,\ntrevor') ||
    lower.includes('cost (ex. vat)') ||
    lower.includes('cost breakdown') ||
    !lower.includes('kelly') ||
    !lower.includes('main point of contact')
  )
}

function readinessClass(ready: boolean) {
  return ready
    ? 'border-green-200 bg-green-50 text-green-900'
    : 'border-amber-200 bg-amber-50 text-amber-900'
}

export default function QuoteEditor({ quote }: QuoteEditorProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [actionBusy, setActionBusy] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [amendmentMode, setAmendmentMode] = useState(false)
  const [reviewInput, setReviewInput] = useState('')
  const [reviewBusy, setReviewBusy] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [reviewMessages, setReviewMessages] = useState<QuoteReviewMessage[]>([])

  const [customerName, setCustomerName] = useState(quote.customerName || '')
  const [customerPhone, setCustomerPhone] = useState(quote.customerPhone || '')
  const [customerEmail, setCustomerEmail] = useState(quote.customerEmail || '')
  const [customerAddress, setCustomerAddress] = useState(quote.customerAddress || '')
  const [customerPostcode, setCustomerPostcode] = useState(quote.customerPostcode || '')
  const [scope, setScope] = useState(quote.scope)
  const [customerMessage, setCustomerMessage] = useState(quote.customerMessage || '')
  const [internalNotes, setInternalNotes] = useState(quote.internalNotes || '')
  const [priceExVat, setPriceExVat] = useState(String(quote.priceExVat || 0))
  const [depositPercent, setDepositPercent] = useState(String(quote.depositPercent ?? 25))
  const [estimatedDays, setEstimatedDays] = useState(
    quote.estimatedDays == null ? '' : String(quote.estimatedDays)
  )
  const [estimatedTeamSize, setEstimatedTeamSize] = useState(
    quote.estimatedTeamSize == null ? '' : String(quote.estimatedTeamSize)
  )

  const acceptedBaseline = quote.status === 'accepted' || Boolean(quote.jobId)
  const fieldsLocked = acceptedBaseline && !amendmentMode

  useEffect(() => {
    let cancelled = false

    async function loadReviewMessages() {
      try {
        const response = await fetch(`/api/quotes/${quote.id}/chas`, { cache: 'no-store' })
        const data = await response.json().catch(() => null)
        if (!response.ok || !data?.ok) return
        if (!cancelled) setReviewMessages(Array.isArray(data.messages) ? data.messages : [])
      } catch {
        // Review chat is optional; do not block quote editing if history cannot load.
      }
    }

    void loadReviewMessages()
    return () => {
      cancelled = true
    }
  }, [quote.id])

  const figures = useMemo(() => {
    const price = asNumber(priceExVat)
    const vat = STANDARD_VAT_RATE
    const deposit = asNumber(depositPercent, 25)
    const vatAmount = Number(((price * vat) / 100).toFixed(2))
    const totalIncVat = Number((price + vatAmount).toFixed(2))
    const depositAmount = Number(((totalIncVat * deposit) / 100).toFixed(2))

    return { price, vat, deposit, vatAmount, totalIncVat, depositAmount }
  }, [priceExVat, depositPercent])

  const isMultiOptionQuote = Boolean(
    quote.quoteWorking &&
      (quote.quoteWorking.includes('OPTIONS / PACKAGES') ||
        quote.quoteWorking.includes('ALL-TOGETHER COMBINATIONS'))
  )

  const readiness = useMemo(() => {
    const customerReady = Boolean(customerName.trim() && (customerPhone.trim() || customerEmail.trim()))
    const scopeReady = scope.trim().length >= 10
    const priceReady = figures.price > 0
    const programmeReady = asNumber(estimatedDays) > 0 && asNumber(estimatedTeamSize) > 0
    const messageReady = customerMessage.trim().length >= 20
    const readyToSend = customerReady && scopeReady && priceReady && programmeReady && messageReady

    return {
      customerReady,
      scopeReady,
      priceReady,
      programmeReady,
      messageReady,
      readyToSend,
    }
  }, [
    customerName,
    customerPhone,
    customerEmail,
    scope,
    figures.price,
    estimatedDays,
    estimatedTeamSize,
    customerMessage,
  ])

  function payload() {
    return {
      customerName,
      customerPhone,
      customerEmail,
      customerAddress,
      customerPostcode,
      scope,
      customerMessage,
      internalNotes,
      priceExVat: figures.price,
      vatRate: STANDARD_VAT_RATE,
      vatAmount: figures.vatAmount,
      totalIncVat: figures.totalIncVat,
      depositPercent: figures.deposit,
      depositAmount: figures.depositAmount,
      estimatedDays: estimatedDays.trim() ? asNumber(estimatedDays) : null,
      estimatedTeamSize: estimatedTeamSize.trim()
        ? Math.max(1, Math.round(asNumber(estimatedTeamSize, 1)))
        : null,
      amendmentMode,
    }
  }

  async function save(status?: string) {
    if (fieldsLocked) {
      setError('This accepted quote is locked. Use “Reopen quote for amendment” first if the commercial baseline genuinely needs changing.')
      return
    }

    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const res = await fetch(`/api/quotes/${quote.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload(),
          ...(status ? { status } : {}),
        }),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Failed to save quote.')

      setSuccess(
        acceptedBaseline && amendmentMode
          ? 'Quote amendment saved. Review the linked landscaping job pack because its accepted baseline may now differ.'
          : status
            ? `Quote moved to ${status.replaceAll('_', ' ')}.`
            : 'Quote saved.'
      )
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save quote.')
    } finally {
      setSaving(false)
    }
  }

  async function runStatusAction(status: string) {
    setActionBusy(status)
    try {
      await save(status)
    } finally {
      setActionBusy('')
    }
  }

  async function acceptAndCreateJob() {
    try {
      setActionBusy('accepted')
      setError('')
      setSuccess('')

      const saveRes = await fetch(`/api/quotes/${quote.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload()),
      })
      const saveData = await saveRes.json().catch(() => null)
      if (!saveRes.ok) throw new Error(saveData?.error || 'Failed to save quote first.')

      const res = await fetch(`/api/quotes/${quote.id}/accept`, {
        method: 'POST',
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Failed to create job.')

      const jobId = Number(data?.job?.id)
      if (!Number.isInteger(jobId) || jobId <= 0) {
        throw new Error('The quote was accepted, but the new landscaping job could not be opened.')
      }

      router.push(`/admin/landscaping/jobs/${jobId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept quote.')
      setActionBusy('')
    }
  }

  async function requestKellyMessage(additionalInstructions: string) {
    const response = await fetch('/api/ai/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'write',
        customerName,
        quoteMode: 'single',
        jobDetails: scope,
        additionalInstructions,
        priceExVat: figures.price,
        vatRate: STANDARD_VAT_RATE,
        depositPercent: figures.deposit,
      }),
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      throw new Error(data?.error || 'Could not regenerate the customer message.')
    }

    return String(data?.whatsappQuote || '').trim()
  }

  async function regenerateCustomerMessage() {
    if (fieldsLocked) {
      setError('The accepted quote is locked. Reopen it for amendment before changing customer-facing wording.')
      return
    }

    if (isMultiOptionQuote) {
      setError('This is a multi-option quote. Regenerate it through CHAS so none of the separate prices or combinations are lost.')
      return
    }

    if (!scope.trim() || figures.price <= 0) {
      setError('The quote needs a scope and price before the customer message can be regenerated.')
      return
    }

    try {
      setActionBusy('regenerate-kelly')
      setError('')
      setSuccess('')

      let message = await requestKellyMessage(
        'Regenerate this existing customer quote in the current Furlads style. It must come from Kelly, feel warm, exciting and reassuring, lead with the finished transformation, keep the commercial figures clear but not invoice-like, and state that Kelly is the customer’s main point of contact from here. Do not sign off from Trevor and do not use a Cost breakdown heading.'
      )

      if (messageNeedsKellyRewrite(message)) {
        message = await requestKellyMessage(
          'QUALITY GATE: the previous draft failed the Furlads customer-experience standard. Rewrite it completely. Mandatory: write from Kelly; use the customer’s friendly first name where clear; open with excitement about the transformation; use friendly WhatsApp sections; do not use Cost breakdown or internal pricing-formula language; finish from Kelly at Furlads and explicitly say Kelly is the main point of contact from here. Keep every supplied price, VAT and deposit figure exact.'
        )
      }

      if (messageNeedsKellyRewrite(message)) {
        throw new Error('The regenerated draft still did not meet the Kelly-led quote standard. Please try again.')
      }

      setCustomerMessage(message)
      setSuccess('Fresh Kelly-led customer message generated. Review it, then press Save changes.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not regenerate the customer message.')
    } finally {
      setActionBusy('')
    }
  }

  async function regenerateAsTrev() {
    if (fieldsLocked) {
      setError('The accepted quote is locked. Reopen it for amendment before changing customer-facing wording.')
      return
    }

    if (isMultiOptionQuote) {
      setError('This is a multi-option quote. Regenerate it through CHAS so none of the separate prices or combinations are lost.')
      return
    }

    if (!scope.trim() || figures.price <= 0) {
      setError('The quote needs a scope and price before the customer message can be regenerated.')
      return
    }

    try {
      setActionBusy('regenerate-trev')
      setError('')
      setSuccess('')

      const response = await fetch('/api/ai/quote/trev-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          scope,
          priceExVat: figures.price,
          vatRate: STANDARD_VAT_RATE,
          depositPercent: figures.deposit,
        }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.error || 'Could not regenerate the Trev customer message.')
      }

      const message = String(data?.whatsappQuote || '').trim()
      if (!message) throw new Error('The Trev message came back empty.')

      setCustomerMessage(message)
      setSuccess('Fresh post-visit Trev message generated. Review it, then press Save changes.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not regenerate the Trev customer message.')
    } finally {
      setActionBusy('')
    }
  }

  async function askChas() {
    const question = reviewInput.trim()
    if (!question || reviewBusy) return

    try {
      setReviewBusy(true)
      setReviewError('')

      const response = await fetch(`/api/quotes/${quote.id}/chas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || 'Could not ask CHAS about this quote.')
      }

      setReviewMessages((current) => [...current, data.message])
      setReviewInput('')
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Could not ask CHAS about this quote.')
    } finally {
      setReviewBusy(false)
    }
  }

  const disabled = saving || Boolean(actionBusy)
  const inputClass = fieldsLocked
    ? 'min-h-11 w-full cursor-not-allowed rounded-xl border border-zinc-200 bg-zinc-100 px-3 text-sm text-zinc-600'
    : 'min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm'
  const textareaClass = fieldsLocked
    ? 'w-full cursor-not-allowed rounded-xl border border-zinc-200 bg-zinc-100 px-3 py-3 text-sm leading-6 text-zinc-600'
    : 'w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm leading-6'

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Quote readiness</div>
            <h2 className="mt-1 text-lg font-black text-zinc-950">
              {readiness.readyToSend ? 'Everything needed to send is in place' : 'Finish the amber items before sending'}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <ReadinessPill label="Customer" ready={readiness.customerReady} />
            <ReadinessPill label="Scope" ready={readiness.scopeReady} />
            <ReadinessPill label="Price" ready={readiness.priceReady} />
            <ReadinessPill label="Programme" ready={readiness.programmeReady} />
            <ReadinessPill label="Message" ready={readiness.messageReady} />
            <ReadinessPill label="Ready to send" ready={readiness.readyToSend} strong />
          </div>
        </div>
      </section>

      {acceptedBaseline ? (
        <section className={`rounded-2xl border p-5 shadow-sm ${amendmentMode ? 'border-amber-300 bg-amber-50' : 'border-green-200 bg-green-50'}`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-600">Accepted quote protection</div>
              <h2 className="mt-1 text-lg font-black text-zinc-950">
                {amendmentMode ? 'Amendment mode is ON' : 'Commercial baseline locked'}
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-700">
                {amendmentMode
                  ? 'Changes here can make the linked landscaping job pack out of date. Save deliberately, then review/regenerate the job pack if the scope, price, duration or team changed.'
                  : 'This quote has been accepted and/or converted to a job. Scope, price, programme and customer wording are read-only until you deliberately reopen it.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setAmendmentMode((current) => !current)
                setError('')
                setSuccess('')
              }}
              className={`min-h-11 rounded-xl px-4 text-sm font-black ${amendmentMode ? 'border border-zinc-300 bg-white text-zinc-900' : 'bg-amber-500 text-zinc-950'}`}
            >
              {amendmentMode ? 'Cancel amendment mode' : 'Reopen quote for amendment'}
            </button>
          </div>
        </section>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">
          {success}
        </div>
      ) : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-zinc-950">Customer</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-500">Name</span>
            <input disabled={fieldsLocked} value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-500">Phone</span>
            <input disabled={fieldsLocked} value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-500">Email</span>
            <input disabled={fieldsLocked} value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-500">Postcode</span>
            <input disabled={fieldsLocked} value={customerPostcode} onChange={(e) => setCustomerPostcode(e.target.value)} className={`${inputClass} uppercase`} />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-500">Address</span>
            <input disabled={fieldsLocked} value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} className={inputClass} />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-zinc-950">Quote</h2>

        <label className="mt-4 block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-500">Scope</span>
          <textarea disabled={fieldsLocked} value={scope} onChange={(e) => setScope(e.target.value)} rows={5} className={textareaClass} />
        </label>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-500">Price ex VAT</span>
            <input disabled={fieldsLocked} type="number" step="0.01" value={priceExVat} onChange={(e) => setPriceExVat(e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-500">VAT %</span>
            <input type="number" value={STANDARD_VAT_RATE} readOnly className="min-h-11 w-full cursor-not-allowed rounded-xl border border-zinc-200 bg-zinc-100 px-3 text-sm font-bold text-zinc-600" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-500">Deposit %</span>
            <input disabled={fieldsLocked} type="number" step="0.01" value={depositPercent} onChange={(e) => setDepositPercent(e.target.value)} className={inputClass} />
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-zinc-50 p-4 ring-1 ring-inset ring-zinc-200">
            <div className="text-xs font-bold uppercase tracking-wide text-zinc-500">VAT</div>
            <div className="mt-1 text-xl font-black">{money(figures.vatAmount)}</div>
          </div>
          <div className="rounded-2xl bg-yellow-50 p-4 ring-1 ring-inset ring-yellow-200">
            <div className="text-xs font-bold uppercase tracking-wide text-yellow-800">Total</div>
            <div className="mt-1 text-xl font-black">{money(figures.totalIncVat)}</div>
          </div>
          <div className="rounded-2xl bg-zinc-50 p-4 ring-1 ring-inset ring-zinc-200">
            <div className="text-xs font-bold uppercase tracking-wide text-zinc-500">Deposit</div>
            <div className="mt-1 text-xl font-black">{money(figures.depositAmount)}</div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-500">Estimated days</span>
            <input disabled={fieldsLocked} type="number" step="0.5" value={estimatedDays} onChange={(e) => setEstimatedDays(e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-500">Team size</span>
            <input disabled={fieldsLocked} type="number" step="1" value={estimatedTeamSize} onChange={(e) => setEstimatedTeamSize(e.target.value)} className={inputClass} />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-zinc-950">Customer-ready message</h2>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              Choose Kelly for the normal office follow-up, or Trev for a more personal message after the site visit.
            </p>
          </div>
          {!isMultiOptionQuote && !fieldsLocked ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void regenerateCustomerMessage()}
                disabled={disabled}
                className="min-h-11 rounded-xl bg-yellow-300 px-4 text-sm font-black text-zinc-950 disabled:opacity-50"
              >
                {actionBusy === 'regenerate-kelly' ? 'Regenerating…' : '✨ Regenerate with Kelly'}
              </button>
              <button
                type="button"
                onClick={() => void regenerateAsTrev()}
                disabled={disabled}
                className="min-h-11 rounded-xl border border-zinc-300 bg-white px-4 text-sm font-black text-zinc-900 disabled:opacity-50"
              >
                {actionBusy === 'regenerate-trev' ? 'Regenerating…' : '👋 Regenerate as Trev'}
              </button>
            </div>
          ) : null}
        </div>
        <textarea disabled={fieldsLocked} value={customerMessage} onChange={(e) => setCustomerMessage(e.target.value)} rows={14} className={`mt-4 ${textareaClass}`} />
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-zinc-950">Internal notes</h2>
        <textarea disabled={fieldsLocked} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} rows={5} className={`mt-4 ${textareaClass}`} />
      </section>

      {quote.quoteWorking ? (
        <details className="rounded-2xl border border-blue-200 bg-blue-50 shadow-sm">
          <summary className="cursor-pointer px-5 py-4 text-sm font-black text-blue-950">🧮 How CHAS priced this</summary>
          <div className="border-t border-blue-200 p-5">
            <p className="mb-3 text-xs leading-5 text-blue-800">
              Internal pricing working only. Use Ask CHAS below if you want a particular allowance, duration or assumption explained.
            </p>
            <div className="whitespace-pre-wrap rounded-2xl bg-white p-4 text-sm leading-6 text-zinc-700 ring-1 ring-inset ring-blue-100">{quote.quoteWorking}</div>
          </div>
        </details>
      ) : null}

      <section className="rounded-2xl border border-yellow-200 bg-yellow-50 p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.16em] text-yellow-800">Quote review</div>
            <h2 className="mt-1 text-xl font-black text-zinc-950">Ask CHAS about this quote 💬</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-700">
              CHAS can see this quote's scope, price, VAT/deposit, programme, internal notes and stored pricing working. It explains and challenges the quote but never silently changes it.
            </p>
          </div>
          {acceptedBaseline ? (
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-zinc-700 ring-1 ring-inset ring-yellow-300">Accepted baseline protected</span>
          ) : null}
        </div>

        {reviewMessages.length ? (
          <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto rounded-2xl bg-white p-4 ring-1 ring-inset ring-yellow-200">
            {reviewMessages.map((message) => (
              <div key={message.id} className="space-y-2">
                <div className="ml-auto max-w-[88%] rounded-2xl bg-zinc-950 px-4 py-3 text-sm leading-6 text-white">
                  {message.question}
                </div>
                <div className="max-w-[92%] whitespace-pre-wrap rounded-2xl bg-zinc-100 px-4 py-3 text-sm leading-6 text-zinc-800">
                  {message.answer}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <textarea
            value={reviewInput}
            onChange={(event) => setReviewInput(event.target.value)}
            rows={3}
            placeholder="e.g. Why is this £5,200? Have we allowed enough time? What could catch us out?"
            className="min-h-[88px] flex-1 rounded-xl border border-yellow-300 bg-white px-3 py-3 text-sm leading-6"
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
            disabled={reviewBusy || !reviewInput.trim()}
            className="min-h-11 rounded-xl bg-zinc-950 px-5 text-sm font-black text-white disabled:opacity-50"
          >
            {reviewBusy ? 'CHAS is checking…' : 'Ask CHAS'}
          </button>
        </div>
        {reviewError ? <div className="mt-3 text-sm font-semibold text-red-700">{reviewError}</div> : null}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {!fieldsLocked ? (
            <button type="button" onClick={() => void save()} disabled={disabled} className="min-h-11 rounded-xl bg-zinc-950 px-4 text-sm font-black text-white disabled:opacity-50">
              {saving ? 'Saving…' : amendmentMode ? 'Save amended quote' : 'Save changes'}
            </button>
          ) : null}

          {!acceptedBaseline && !['accepted', 'archived'].includes(quote.status) ? (
            <button type="button" onClick={() => void runStatusAction('ready_to_send')} disabled={disabled || !readiness.readyToSend} className="min-h-11 rounded-xl bg-yellow-300 px-4 text-sm font-black text-zinc-950 disabled:opacity-50">
              Ready to send
            </button>
          ) : null}

          {!acceptedBaseline && !['accepted', 'archived'].includes(quote.status) ? (
            <button type="button" onClick={() => void runStatusAction('sent')} disabled={disabled || !readiness.readyToSend} className="min-h-11 rounded-xl border border-blue-300 bg-blue-50 px-4 text-sm font-black text-blue-800 disabled:opacity-50">
              Mark sent
            </button>
          ) : null}

          {!quote.jobId && quote.status !== 'archived' ? (
            <button type="button" onClick={acceptAndCreateJob} disabled={disabled || !readiness.readyToSend} className="min-h-11 rounded-xl bg-green-700 px-4 text-sm font-black text-white disabled:opacity-50">
              {actionBusy === 'accepted' ? 'Creating job pack…' : 'Accepted — create landscaping job'}
            </button>
          ) : null}

          {quote.jobId ? (
            <>
              <Link href={`/admin/landscaping/jobs/${quote.jobId}`} className="inline-flex min-h-11 items-center rounded-xl border border-green-300 bg-green-50 px-4 text-sm font-black text-green-800">
                Job planning #{quote.jobId}
              </Link>
              <Link href={`/landscaping/jobs/${quote.jobId}`} className="inline-flex min-h-11 items-center rounded-xl border border-zinc-300 bg-white px-4 text-sm font-black text-zinc-800">
                Worker job sheet
              </Link>
              <Link href="/admin/schedule" className="inline-flex min-h-11 items-center rounded-xl bg-green-700 px-4 text-sm font-black text-white">
                Book in schedule
              </Link>
            </>
          ) : null}

          {!acceptedBaseline && !['accepted', 'declined', 'archived'].includes(quote.status) ? (
            <button type="button" onClick={() => void runStatusAction('declined')} disabled={disabled} className="min-h-11 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-black text-red-700 disabled:opacity-50">
              Mark declined
            </button>
          ) : null}

          {!acceptedBaseline ? (
            quote.status === 'archived' ? (
              <button type="button" onClick={() => void runStatusAction('needs_review')} disabled={disabled} className="min-h-11 rounded-xl border border-zinc-300 bg-white px-4 text-sm font-black text-zinc-800 disabled:opacity-50">
                Restore
              </button>
            ) : (
              <button type="button" onClick={() => void runStatusAction('archived')} disabled={disabled} className="min-h-11 rounded-xl border border-zinc-300 bg-white px-4 text-sm font-black text-zinc-600 disabled:opacity-50">
                Archive
              </button>
            )
          ) : null}
        </div>
      </section>
    </div>
  )
}

function ReadinessPill({
  label,
  ready,
  strong = false,
}: {
  label: string
  ready: boolean
  strong?: boolean
}) {
  return (
    <span className={`rounded-xl border px-3 py-2 text-xs font-black ${readinessClass(ready)} ${strong ? 'ring-2 ring-inset ring-current/10' : ''}`}>
      {ready ? '✓' : '•'} {label}
    </span>
  )
}
