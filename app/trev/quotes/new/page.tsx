'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type Customer = {
  id: number
  name: string
  phone: string | null
  email: string | null
  address: string | null
  postcode: string | null
}

export default function NewTrevQuotePage() {
  const router = useRouter()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [newCustomerMode, setNewCustomerMode] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [postcode, setPostcode] = useState('')
  const [scope, setScope] = useState('')

  useEffect(() => {
    let cancelled = false
    async function loadCustomers() {
      try {
        setLoading(true)
        const response = await fetch('/api/customers', { cache: 'no-store' })
        const data = await response.json().catch(() => null)
        if (!response.ok || !Array.isArray(data)) throw new Error('Could not load customers.')
        if (!cancelled) setCustomers(data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load customers.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void loadCustomers()
    return () => { cancelled = true }
  }, [])

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return customers.slice(0, 12)
    return customers.filter((customer) => {
      return [customer.name, customer.phone, customer.email, customer.address, customer.postcode]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    }).slice(0, 20)
  }, [customers, search])

  function chooseCustomer(customer: Customer) {
    setSelectedCustomer(customer)
    setNewCustomerMode(false)
    setName(customer.name || '')
    setPhone(customer.phone || '')
    setEmail(customer.email || '')
    setAddress(customer.address || '')
    setPostcode(customer.postcode || '')
    setError('')
  }

  function startNewCustomer() {
    setSelectedCustomer(null)
    setNewCustomerMode(true)
    setName(search.trim())
    setPhone('')
    setEmail('')
    setAddress('')
    setPostcode('')
    setError('')
  }

  async function createCustomer() {
    const response = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, email, address, postcode }),
    })
    const data = await response.json().catch(() => null)
    if (response.status === 409 && Array.isArray(data?.duplicates) && data.duplicates.length) {
      throw new Error(`Possible duplicate customer found: ${data.duplicates.map((item: Customer) => item.name).join(', ')}. Search and select the existing customer instead.`)
    }
    if (!response.ok || !data?.id) throw new Error(data?.error || 'Could not create customer.')
    return data as Customer
  }

  async function startQuote() {
    const cleanScope = scope.trim()
    if (!cleanScope) {
      setError('Tell me what the customer wants before starting the quote.')
      return
    }

    if (!selectedCustomer && !newCustomerMode) {
      setError('Choose an existing customer or add a new one first.')
      return
    }

    if (newCustomerMode && !name.trim()) {
      setError('Customer name is required.')
      return
    }

    try {
      setSaving(true)
      setError('')

      const customer = selectedCustomer || await createCustomer()
      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.id,
          customerName: customer.name,
          customerPhone: customer.phone,
          customerEmail: customer.email,
          customerAddress: customer.address,
          customerPostcode: customer.postcode,
          scope: cleanScope,
          status: 'needs_review',
          priceExVat: 0,
          vatRate: 20,
          depositPercent: 25,
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.quote?.id) throw new Error(data?.error || 'Could not start quote.')

      router.push(`/admin/quotes/${data.quote.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start quote.')
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-950">
      <div className="mx-auto max-w-3xl px-3 pb-28 pt-3 sm:px-6 sm:py-6">
        <section className="rounded-3xl bg-zinc-950 p-4 text-white shadow-lg sm:p-6">
          <div className="text-xs font-black uppercase tracking-[0.18em] text-yellow-300">New quote</div>
          <h1 className="mt-1 text-3xl font-black tracking-tight">Who are we quoting for?</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-300">Search an existing customer or add a new one, then go straight into the quote. No job is created.</p>
          <Link href="/trev/quotes" className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-4 text-sm font-black text-zinc-950">Back to quotes</Link>
        </section>

        <section className="mt-4 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-xl font-black">Customer</h2>
          <label className="mt-4 block">
            <span className="text-xs font-black uppercase tracking-wide text-zinc-500">Search name, postcode, phone or email</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Start typing a customer..." className="mt-2 min-h-12 w-full rounded-xl border border-zinc-300 bg-white px-4 text-base" />
          </label>

          {loading ? <div className="mt-3 text-sm text-zinc-500">Loading customers…</div> : null}

          {!selectedCustomer && !newCustomerMode ? (
            <div className="mt-3 space-y-2">
              {filteredCustomers.map((customer) => (
                <button key={customer.id} type="button" onClick={() => chooseCustomer(customer)} className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-left transition hover:bg-zinc-100">
                  <div className="font-black">{customer.name}</div>
                  <div className="mt-1 text-sm text-zinc-600">{[customer.address, customer.postcode].filter(Boolean).join(', ') || 'No address saved'}</div>
                  <div className="mt-1 text-xs text-zinc-500">{[customer.phone, customer.email].filter(Boolean).join(' · ')}</div>
                </button>
              ))}
              <button type="button" onClick={startNewCustomer} className="min-h-12 w-full rounded-xl bg-yellow-400 px-4 text-sm font-black text-zinc-950">+ Add new customer</button>
            </div>
          ) : null}

          {selectedCustomer ? (
            <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-4">
              <div className="text-xs font-black uppercase text-green-700">Selected customer</div>
              <div className="mt-1 text-lg font-black">{selectedCustomer.name}</div>
              <div className="mt-1 text-sm text-zinc-700">{[selectedCustomer.address, selectedCustomer.postcode].filter(Boolean).join(', ')}</div>
              <button type="button" onClick={() => setSelectedCustomer(null)} className="mt-3 text-sm font-black text-zinc-700 underline">Choose someone else</button>
            </div>
          ) : null}

          {newCustomerMode ? (
            <div className="mt-4 grid gap-3">
              <div className="flex items-center justify-between gap-3"><h3 className="font-black">New customer</h3><button type="button" onClick={() => setNewCustomerMode(false)} className="text-sm font-black underline">Use existing instead</button></div>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer name" className="min-h-12 rounded-xl border border-zinc-300 px-4" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className="min-h-12 rounded-xl border border-zinc-300 px-4" />
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="min-h-12 rounded-xl border border-zinc-300 px-4" />
              </div>
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address" className="min-h-12 rounded-xl border border-zinc-300 px-4" />
              <input value={postcode} onChange={(e) => setPostcode(e.target.value.toUpperCase())} placeholder="Postcode" className="min-h-12 rounded-xl border border-zinc-300 px-4" />
            </div>
          ) : null}
        </section>

        <section className="mt-4 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-xl font-black">What does the customer want?</h2>
          <textarea value={scope} onChange={(event) => setScope(event.target.value)} placeholder="Type or dictate the job in your own words…" className="mt-3 min-h-40 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-base leading-6" />

          {error ? <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</div> : null}

          <button type="button" onClick={startQuote} disabled={saving} className="mt-4 min-h-14 w-full rounded-2xl bg-yellow-400 px-5 text-base font-black text-zinc-950 disabled:opacity-50">
            {saving ? 'Starting quote…' : 'Start quote'}
          </button>
          <p className="mt-2 text-center text-xs text-zinc-500">This creates a quote only. A job is only created later if the quote is accepted.</p>
        </section>
      </div>
    </main>
  )
}
