'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type ResetRequest = { id: number; workerId: number; status: string; requestedAt: string; firstName: string; lastName: string; phone: string | null }

function digits(value: string | null) {
  const compact = String(value || '').replace(/\D/g, '')
  if (compact.startsWith('0')) return `44${compact.slice(1)}`
  return compact
}

export default function PasswordResetQueuePage() {
  const [items, setItems] = useState<ResetRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<number | null>(null)

  async function load() {
    try {
      setLoading(true); setError('')
      const response = await fetch('/api/admin/subcontractor-password-resets', { cache: 'no-store' })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || 'Could not load reset requests.')
      setItems(data.requests || [])
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not load reset requests.') }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  async function send(item: ResetRequest) {
    try {
      setBusy(item.id); setError('')
      const response = await fetch('/api/admin/subcontractor-password-resets', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: item.id }) })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Could not create reset link.')
      const phone = digits(data.phone || item.phone)
      const href = `https://wa.me/${phone}?text=${encodeURIComponent(data.message)}`
      window.open(href, '_blank', 'noopener,noreferrer')
      await load()
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not create reset link.') }
    finally { setBusy(null) }
  }

  return <div className="space-y-5 pb-8">
    <div><Link href="/admin/subcontractors" className="text-sm font-black text-zinc-500">← Subcontractors</Link><h1 className="mt-2 text-4xl font-black">Password reset requests</h1><p className="mt-2 text-sm font-semibold text-zinc-600">Only send the reset link to the saved mobile number on the subcontractor profile.</p></div>
    {error ? <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div> : null}
    {loading ? <div className="rounded-3xl bg-white p-8 font-bold">Loading requests…</div> : null}
    {!loading && !items.length ? <div className="rounded-3xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm font-semibold text-zinc-500">No password resets waiting.</div> : null}
    <div className="space-y-3">{items.map((item) => <div key={item.id} className="flex flex-col gap-3 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"><div><div className="text-lg font-black">{item.firstName} {item.lastName}</div><div className="mt-1 text-sm font-semibold text-zinc-500">{item.phone || 'No phone recorded'} · requested {new Date(item.requestedAt).toLocaleString('en-GB')}</div></div><button disabled={busy === item.id || !item.phone} onClick={() => void send(item)} className="rounded-xl bg-[#25D366] px-4 py-3 text-sm font-black text-zinc-950 disabled:opacity-50">{busy === item.id ? 'Creating link…' : 'Send reset on WhatsApp'}</button></div>)}</div>
  </div>
}
