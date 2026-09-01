'use client'

import { FormEvent, useState } from 'react'

type Props = {
  token: string
  firstName: string
  registered: boolean
}

export default function ContractorAuthGate({ token, firstName, registered }: Props) {
  const [mode, setMode] = useState<'login' | 'signup'>(registered ? 'login' : 'signup')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    try {
      setBusy(true)
      setError('')
      const endpoint = mode === 'signup' ? '/api/contractor/auth/signup' : '/api/contractor/auth/login'
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, phone, password }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Could not verify your account.')
      window.location.href = data.redirectTo || `/contractor/opportunity/${encodeURIComponent(token)}`
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify your account.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="min-h-dvh bg-[#eef2e9] px-4 py-8 text-[#162111]">
    <div className="mx-auto max-w-md overflow-hidden rounded-[28px] bg-white shadow-xl">
      <div className="bg-gradient-to-br from-[#13220f] via-[#223718] to-[#30491c] p-6 text-white">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-[#b8d874]">Furlads subcontractor portal</div>
        <h1 className="mt-2 text-3xl font-black">Hi {firstName}</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-[#dce6d6]">This link goes straight to your job. Verify your account first and you’ll be returned to it automatically.</p>
      </div>

      <div className="p-6">
        <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-zinc-100 p-1">
          <button type="button" onClick={() => { setMode('login'); setError('') }} className={`rounded-xl px-3 py-3 text-sm font-black ${mode === 'login' ? 'bg-white shadow' : 'text-zinc-500'}`}>Log in</button>
          <button type="button" onClick={() => { setMode('signup'); setError('') }} className={`rounded-xl px-3 py-3 text-sm font-black ${mode === 'signup' ? 'bg-white shadow' : 'text-zinc-500'}`}>First-time signup</button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-wide text-zinc-500">Mobile number</span>
            <input required value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" className="w-full rounded-2xl border border-zinc-200 px-4 py-3 font-semibold outline-none focus:border-[#8caf3a]" />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-wide text-zinc-500">Password</span>
            <input required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} className="w-full rounded-2xl border border-zinc-200 px-4 py-3 font-semibold outline-none focus:border-[#8caf3a]" />
          </label>
          {mode === 'signup' ? <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-wide text-zinc-500">Confirm password</span>
            <input required minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" autoComplete="new-password" className="w-full rounded-2xl border border-zinc-200 px-4 py-3 font-semibold outline-none focus:border-[#8caf3a]" />
          </label> : null}

          {error ? <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div> : null}

          <button disabled={busy} className="w-full rounded-2xl bg-[#a8ca4a] px-5 py-4 font-black text-[#18220f] disabled:opacity-50">{busy ? 'Checking…' : mode === 'signup' ? 'Create account & open job' : 'Verify & open job'}</button>
        </form>

        <p className="mt-5 text-xs font-semibold leading-5 text-zinc-500">For security, the mobile number must match the subcontractor record this invitation was sent to.</p>
      </div>
    </div>
  </main>
}
