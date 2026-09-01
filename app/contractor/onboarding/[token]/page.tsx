'use client'

import { FormEvent, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function ContractorOnboardingPage() {
  const params = useParams<{ token: string }>()
  const router = useRouter()
  const token = String(params?.token || '')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    try {
      setBusy(true)
      setError('')
      const response = await fetch('/api/contractor/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, phone, password }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || 'Could not set up your account.')
      router.replace(data.redirectTo || '/contractor/agreement?next=%2Fcontractor')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set up your account.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="min-h-dvh bg-[#eef2e9] px-4 py-8 text-[#162111]">
    <div className="mx-auto max-w-lg">
      <section className="rounded-[30px] bg-gradient-to-br from-[#13220f] via-[#223718] to-[#30491c] p-6 text-white shadow-xl sm:p-8">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-[#b8d874]">Furlads subcontractor network</div>
        <h1 className="mt-2 text-4xl font-black">Set up your account</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-[#dce6d6]">Your application has been approved. Confirm the mobile number you applied with and create a password. You’ll then review the subcontractor agreement before your dashboard opens.</p>
      </section>

      <form onSubmit={submit} className="mt-5 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
        <label className="block text-xs font-black uppercase tracking-wider text-zinc-500">Mobile number</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" className="mt-2 min-h-12 w-full rounded-xl border border-zinc-300 px-4 text-base font-semibold" placeholder="07…" required />

        <label className="mt-4 block text-xs font-black uppercase tracking-wider text-zinc-500">Create password</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="new-password" minLength={8} className="mt-2 min-h-12 w-full rounded-xl border border-zinc-300 px-4 text-base font-semibold" required />

        <label className="mt-4 block text-xs font-black uppercase tracking-wider text-zinc-500">Confirm password</label>
        <input value={confirm} onChange={(e) => setConfirm(e.target.value)} type="password" autoComplete="new-password" minLength={8} className="mt-2 min-h-12 w-full rounded-xl border border-zinc-300 px-4 text-base font-semibold" required />

        {error ? <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div> : null}
        <button disabled={busy} className="mt-5 min-h-12 w-full rounded-xl bg-[#a8ca4a] px-5 font-black text-[#18220f] disabled:opacity-50">{busy ? 'Setting up…' : 'Continue to agreement'}</button>
        <p className="mt-4 text-xs font-semibold leading-5 text-zinc-500">For security, this link expires after 14 days and the mobile number must match the approved application.</p>
      </form>
    </div>
  </main>
}
