'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

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

export default function QuoteEditor({ quote }: QuoteEditorProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [actionBusy, setActionBusy] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

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
    }
  }

  async function save(status?: string) {
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

      setSuccess(status ? `Quote moved to ${status.replaceAll('_', ' ')}.` : 'Quote saved.')
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
      setError(
        err instanceof Error
          ? err.message
          : 'Could not regenerate the customer message.'
      )
    } finally {
      setActionBusy('')
    }
  }

  async function regenerateAsTrev() {
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
      setError(
        err instanceof Error
          ? err.message
          : 'Could not regenerate the Trev customer message.'
      )
    } finally {
      setActionBusy('')
    }
  }

  const disabled = saving || Boolean(actionBusy)

  return (
    <div className="space-y-5">
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
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="min-h-11 w-full rounded-xl border border-zinc-300 px-3 text-sm" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-500">Phone</span>
            <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="min-h-11 w-full rounded-xl border border-zinc-300 px-3 text-sm" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-500">Email</span>
            <input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} className="min-h-11 w-full rounded-xl border border-zinc-300 px-3 text-sm" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-500">Postcode</span>
            <input value={customerPostcode} onChange={(e) => setCustomerPostcode(e.target.value)} className="min-h-11 w-full rounded-xl border border-zinc-300 px-3 text-sm uppercase" />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-500">Address</span>
            <input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} className="min-h-11 w-full rounded-xl border border-zinc-300 px-3 text-sm" />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-zinc-950">Quote</h2>

        <label className="mt-4 block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-500">Scope</span>
          <textarea value={scope} onChange={(e) => setScope(e.target.value)} rows={5} className="w-full rounded-xl border border-zinc-300 px-3 py-3 text-sm leading-6" />
        </label>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-500">Price ex VAT</span>
            <input type="number" step="0.01" value={priceExVat} onChange={(e) => setPriceExVat(e.target.value)} className="min-h-11 w-full rounded-xl border border-zinc-300 px-3 text-sm" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-500">VAT %</span>
            <input type="number" value={STANDARD_VAT_RATE} readOnly className="min-h-11 w-full cursor-not-allowed rounded-xl border border-zinc-200 bg-zinc-100 px-3 text-sm font-bold text-zinc-600" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-500">Deposit %</span>
            <input type="number" step="0.01" value={depositPercent} onChange={(e) => setDepositPercent(e.target.value)} className="min-h-11 w-full rounded-xl border border-zinc-300 px-3 text-sm" />
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
            <input type="number" step="0.5" value={estimatedDays} onChange={(e) => setEstimatedDays(e.target.value)} className="min-h-11 w-full rounded-xl border border-zinc-300 px-3 text-sm" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-500">Team size</span>
            <input type="number" step="1" value={estimatedTeamSize} onChange={(e) => setEstimatedTeamSize(e.target.value)} className="min-h-11 w-full rounded-xl border border-zinc-300 px-3 text-sm" />
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
          {!isMultiOptionQuote ? (
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
        <textarea value={customerMessage} onChange={(e) => setCustomerMessage(e.target.value)} rows={14} className="mt-4 w-full rounded-xl border border-zinc-300 px-3 py-3 text-sm leading-6" />
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-zinc-950">Internal notes</h2>
        <textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} rows={5} className="mt-4 w-full rounded-xl border border-zinc-300 px-3 py-3 text-sm leading-6" />
      </section>

      {quote.quoteWorking ? (
        <details className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <summary className="cursor-pointer px-5 py-4 text-sm font-black text-zinc-900">View CHAS quote working</summary>
          <div className="border-t border-zinc-200 p-5">
            <div className="whitespace-pre-wrap rounded-2xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-700">{quote.quoteWorking}</div>
          </div>
        </details>
      ) : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void save()} disabled={disabled} className="min-h-11 rounded-xl bg-zinc-950 px-4 text-sm font-black text-white disabled:opacity-50">
            {saving ? 'Saving…' : 'Save changes'}
          </button>

          {!['accepted', 'archived'].includes(quote.status) ? (
            <button type="button" onClick={() => void runStatusAction('ready_to_send')} disabled={disabled} className="min-h-11 rounded-xl bg-yellow-300 px-4 text-sm font-black text-zinc-950 disabled:opacity-50">
              Ready to send
            </button>
          ) : null}

          {!['accepted', 'archived'].includes(quote.status) ? (
            <button type="button" onClick={() => void runStatusAction('sent')} disabled={disabled} className="min-h-11 rounded-xl border border-blue-300 bg-blue-50 px-4 text-sm font-black text-blue-800 disabled:opacity-50">
              Mark sent
            </button>
          ) : null}

          {!quote.jobId && quote.status !== 'archived' ? (
            <button type="button" onClick={acceptAndCreateJob} disabled={disabled} className="min-h-11 rounded-xl bg-green-700 px-4 text-sm font-black text-white disabled:opacity-50">
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

          {!['accepted', 'declined', 'archived'].includes(quote.status) ? (
            <button type="button" onClick={() => void runStatusAction('declined')} disabled={disabled} className="min-h-11 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-black text-red-700 disabled:opacity-50">
              Mark declined
            </button>
          ) : null}

          {quote.status === 'archived' ? (
            <button type="button" onClick={() => void runStatusAction('needs_review')} disabled={disabled} className="min-h-11 rounded-xl border border-zinc-300 bg-white px-4 text-sm font-black text-zinc-800 disabled:opacity-50">
              Restore
            </button>
          ) : (
            <button type="button" onClick={() => void runStatusAction('archived')} disabled={disabled} className="min-h-11 rounded-xl border border-zinc-300 bg-white px-4 text-sm font-black text-zinc-600 disabled:opacity-50">
              Archive
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
