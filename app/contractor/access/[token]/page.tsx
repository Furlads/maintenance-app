'use client'

import { FormEvent, useState } from 'react'
import { useParams } from 'next/navigation'

export default function ContractorAccessPage() {
  const params = useParams<{ token: string }>()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (password !== confirm) return setError('Passwords do not match.')
    try {
      setBusy(true); setError('')
      const response = await fetch('/api/contractor/auth/access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: params.token, password }) })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Could not update password.')
      window.location.href = data.redirectTo || '/contractor'
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not update password.') }
    finally { setBusy(false) }
  }

  return <main className="min-h-dvh bg-[#eef2e9] px-4 py-8 text-[#162111]"><div className="mx-auto max-w-md overflow-hidden rounded-[28px] bg-white shadow-xl"><div className="bg-gradient-to-br from-[#13220f] via-[#223718] to-[#30491c] p-6 text-white"><div className="text-xs font-black uppercase tracking-[0.16em] text-[#b8d874]">Furlads subcontractor portal</div><h1 className="mt-2 text-3xl font-black">Set your password</h1><p className="mt-3 text-sm font-semibold leading-6 text-[#dce6d6]">Create a password for your subcontractor account. This secure link stops working once the password is changed.</p></div><form onSubmit={submit} className="space-y-4 p-6"><label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-wide text-zinc-500">New password</span><input required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="new-password" className="w-full rounded-2xl border border-zinc-200 px-4 py-3 font-semibold outline-none focus:border-[#8caf3a]" /></label><label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-wide text-zinc-500">Confirm password</span><input required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} type="password" autoComplete="new-password" className="w-full rounded-2xl border border-zinc-200 px-4 py-3 font-semibold outline-none focus:border-[#8caf3a]" /></label>{error ? <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div> : null}<button disabled={busy} className="w-full rounded-2xl bg-[#a8ca4a] px-5 py-4 font-black text-[#18220f] disabled:opacity-50">{busy ? 'Saving…' : 'Save password & continue'}</button></form></div></main>
}
