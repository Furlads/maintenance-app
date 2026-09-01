'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'

export default function ContractorLoginPage() {
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    try {
      setBusy(true)
      setError('')
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), password }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Could not log in.')
      window.location.href = '/contractor'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log in.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="min-h-dvh bg-[#eef2e9] px-4 py-8 text-[#162111]">
    <div className="mx-auto max-w-md overflow-hidden rounded-[28px] bg-white shadow-xl">
      <div className="bg-gradient-to-br from-[#13220f] via-[#223718] to-[#30491c] p-6 text-white">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-[#b8d874]">Furlads subcontractor portal</div>
        <h1 className="mt-2 text-3xl font-black">Your work dashboard</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-[#dce6d6]">Log in to see all work offered to you, jobs you’ve accepted and what’s coming up in your diary.</p>
      </div>
      <form onSubmit={submit} className="space-y-4 p-6">
        <label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-wide text-zinc-500">Mobile number</span><input required value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" className="w-full rounded-2xl border border-zinc-200 px-4 py-3 font-semibold outline-none focus:border-[#8caf3a]" /></label>
        <label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-wide text-zinc-500">Password</span><input required value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" className="w-full rounded-2xl border border-zinc-200 px-4 py-3 font-semibold outline-none focus:border-[#8caf3a]" /></label>
        {error ? <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div> : null}
        <button disabled={busy} className="w-full rounded-2xl bg-[#a8ca4a] px-5 py-4 font-black text-[#18220f] disabled:opacity-50">{busy ? 'Logging in…' : 'Open my dashboard'}</button>
        <Link href="/contractor/forgot" className="block text-center text-sm font-black text-[#56752c]">Forgotten your password?</Link>
        <p className="text-xs font-semibold leading-5 text-zinc-500">First time here? Use the secure account setup link sent by the office, or open a WhatsApp job invitation and choose “First-time signup”.</p>
      </form>
    </div>
  </main>
}
