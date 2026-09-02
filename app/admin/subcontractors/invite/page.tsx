'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

export default function InviteSubcontractorPage() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [origin, setOrigin] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const applicationUrl = origin ? `${origin}/subcontractors/apply` : '/subcontractors/apply'
  const firstName = name.trim().split(/\s+/)[0] || 'there'
  const message = useMemo(
    () =>
      `Hi ${firstName},\n\nWe’re building a trusted local network of subcontractors across Furlads and Three Counties Property Care, and we’d like to invite you to apply to join us.\n\nWe regularly have landscaping, groundworks, property maintenance and trade work available, and the network lets us match suitable jobs to the right people and teams.\n\nIf you’re interested, please complete the short application below. It covers the type of work you do, the areas you cover, your rates, availability, insurance and CIS details where applicable.\n\n${applicationUrl}\n\nOnce you’ve submitted it, we’ll review your details and come back to you. There’s no obligation to accept any work offered, and each opportunity can be considered individually.\n\nThanks,\nTrev & the team\nFurlads | Three Counties Property Care`,
    [firstName, applicationUrl]
  )

  const normalisedPhone = phone.replace(/\D/g, '').replace(/^0/, '44')
  const whatsappUrl = `https://wa.me/${normalisedPhone}?text=${encodeURIComponent(message)}`

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="space-y-5 pb-8">
      <Link href="/admin/subcontractors" className="inline-flex text-sm font-black text-zinc-600">← Back to subcontractors</Link>

      <section className="rounded-[28px] bg-gradient-to-br from-[#152315] via-[#273c1d] to-[#3b5625] p-6 text-white shadow-xl sm:p-8">
        <div className="text-xs font-black uppercase tracking-[0.18em] text-[#b8d874]">Furlads & Three Counties trade network</div>
        <h1 className="mt-2 text-4xl font-black tracking-tight">Invite a subcontractor</h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#dce6d6]">Send somebody new a ready-written WhatsApp invitation to apply to the shared Furlads & Three Counties Property Care subcontractor network.</p>
      </section>

      <div className="grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
        <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black text-zinc-950">Who are you inviting?</h2>
          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-wide text-zinc-500">Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#9fbe55]" placeholder="e.g. Dan Smith" />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-wide text-zinc-500">Mobile number</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#9fbe55]" placeholder="e.g. 07..." />
            </label>
          </div>

          <div className="mt-5 grid gap-2">
            <a href={phone.trim() ? whatsappUrl : undefined} target="_blank" rel="noreferrer" aria-disabled={!phone.trim()} className={`rounded-2xl px-5 py-4 text-center font-black ${phone.trim() ? 'bg-[#a8ca4a] text-[#18220f]' : 'cursor-not-allowed bg-zinc-200 text-zinc-500'}`}>Open in WhatsApp</a>
            <button type="button" onClick={() => void copyMessage()} className="rounded-2xl border border-zinc-300 bg-white px-5 py-4 font-black text-zinc-900">{copied ? 'Copied ✓' : 'Copy invite message'}</button>
            <a href="/subcontractors/apply" target="_blank" rel="noreferrer" className="rounded-2xl border border-zinc-300 bg-zinc-50 px-5 py-4 text-center text-sm font-black text-zinc-700">Preview application form ↗</a>
          </div>
        </section>

        <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-[#789333]">Message preview</div>
          <h2 className="mt-1 text-xl font-black text-zinc-950">Ready to send</h2>
          <div className="mt-4 whitespace-pre-wrap rounded-2xl bg-zinc-50 p-4 text-sm font-semibold leading-6 text-zinc-700 ring-1 ring-inset ring-zinc-200">{message}</div>
          <div className="mt-4 rounded-2xl bg-[#f2f7e8] p-4 text-sm font-bold leading-6 text-[#486125]">After they submit the form, go back to <Link href="/admin/subcontractors/applications" className="underline">Applications</Link> to review and approve them.</div>
        </section>
      </div>
    </div>
  )
}
