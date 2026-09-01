'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'

export default function ContractorForgotPasswordPage() {
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    try {
      setBusy(true)
      setError('')
      const response = await fetch('/api/contractor/auth/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      if (!response.ok) throw new Error('Could not submit reset request.')
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit reset request.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="min-h-dvh bg-[#eef2e9] px-4 py-8 text-[#162111]">
    <div className="mx-auto max-w-md overflow-hidden rounded-[28px] bg-white shadow-xl">
      <div className="bg-gradient-to-br from-[#13220f] via-[#223718] to-[#30491c] p-6 text-white">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-[#b8d874]">Furlads subcontractor portal</div>
        <h1 className="mt-2 text-3xl font-black">Reset your password</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-[#dce6d6]">Enter the mobile number registered on your subcontractor account. The office will send a secure reset link to that number.</p>
      </div>
      {sent ? <div className="space-y-4 p-6"><div className="rounded-2xl bg-green-50 p-4 text-sm font-bold leading-6 text-green-800">If that number matches an active subcontractor account, the reset request has been sent to the office.</div><Link href="/contractor/login" className="inline-flex w-full items-center justify-center rounded-2xl bg-[#a8ca4a] px-5 py-4 font-black text-[#18220f]">Back to login</Link></div> : <form onSubmit={submit} className="space-y-4 p-6"><label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-wide text-zinc-500">Mobile number</span><input required value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" className="w-full rounded-2xl border border-zinc-200 px-4 py-3 font-semibold outline-none focus:border-[#8caf3a]" /></label>{error ? <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div> : null}<button disabled={busy} className="w-full rounded-2xl bg-[#a8ca4a] px-5 py-4 font-black text-[#18220f] disabled:opacity-50">{busy ? 'Sending…' : 'Request reset link'}</button><Link href="/contractor/login" className="block text-center text-sm font-black text-zinc-500">Back to login</Link></form>}
    </div>
  </main>
}
