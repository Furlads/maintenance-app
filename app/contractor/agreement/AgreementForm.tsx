'use client'

import { useState } from 'react'

type Props = {
  title: string
  version: string
  acceptanceText: string
  fullName: string
  nextPath: string
}

export default function AgreementForm({ title, version, acceptanceText, fullName, nextPath }: Props) {
  const [typedName, setTypedName] = useState(fullName)
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    try {
      setBusy(true)
      setError('')
      const response = await fetch('/api/contractor/agreement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ typedName, agreed }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Could not record your agreement.')
      window.location.href = nextPath || '/contractor'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record your agreement.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="text-xs font-black uppercase tracking-[0.15em] text-[#789333]">Agreement acceptance · version {version}</div>
    <h2 className="mt-2 text-2xl font-black">Accept {title}</h2>
    <p className="mt-3 text-sm font-semibold leading-6 text-zinc-600">{acceptanceText}</p>

    <label className="mt-5 flex items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 h-5 w-5" />
      <span className="text-sm font-semibold leading-6">I agree to the subcontractor terms above and understand they apply to work I accept from Furlads.</span>
    </label>

    <label className="mt-4 block">
      <span className="mb-2 block text-xs font-black uppercase tracking-wider text-zinc-500">Type your full name</span>
      <input value={typedName} onChange={(e) => setTypedName(e.target.value)} className="w-full rounded-2xl border border-zinc-300 px-4 py-3 font-semibold outline-none focus:border-[#9fbe55]" />
    </label>

    {error ? <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div> : null}

    <button type="button" onClick={submit} disabled={busy || !agreed || typedName.trim().length < 3} className="mt-5 w-full rounded-2xl bg-[#a8ca4a] px-5 py-4 font-black text-[#18220f] disabled:opacity-50">
      {busy ? 'Saving agreement…' : 'Agree & continue'}
    </button>
  </section>
}
