'use client'

import { useState } from 'react'

type Props = {
  jobId: number
}

export default function MaintenanceChas({ jobId }: Props) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function ask(text?: string) {
    const clean = (text ?? question).trim()
    if (!clean || busy) return

    try {
      setBusy(true)
      setError('')
      setAnswer('')
      if (text) setQuestion(text)

      const response = await fetch(`/api/maintenance/jobs/${jobId}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: clean }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || data?.ok === false) throw new Error(data?.error || 'CHAS could not answer right now.')
      setAnswer(String(data.answer || ''))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CHAS could not answer right now.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 text-white shadow-sm">
      <div className="text-xs font-black uppercase tracking-[0.16em] text-yellow-300">Ask CHAS about this property</div>
      <h2 className="mt-1 text-xl font-black">Job-aware help without re-explaining everything</h2>
      <p className="mt-1 text-sm leading-6 text-zinc-300">CHAS can see today’s maintenance brief, property memory, last-visit note and any extras already logged.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => void ask('What should I prioritise on this maintenance visit today?')} disabled={busy} className="rounded-xl bg-yellow-300 px-3 py-2 text-xs font-black text-zinc-950 disabled:opacity-50">What should I prioritise?</button>
        <button type="button" onClick={() => void ask('Is there anything seasonal I should be careful about on this visit?')} disabled={busy} className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-white ring-1 ring-inset ring-white/15 disabled:opacity-50">Seasonal check</button>
      </div>

      <textarea
        rows={3}
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        placeholder="e.g. Customer wants the hedge lower — what should I check before doing anything?"
        className="mt-4 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-base text-white placeholder:text-zinc-500"
      />
      <button type="button" onClick={() => void ask()} disabled={busy || !question.trim()} className="mt-3 min-h-11 rounded-xl bg-yellow-300 px-4 text-sm font-black text-zinc-950 disabled:opacity-50">{busy ? 'CHAS is thinking…' : 'Ask CHAS'}</button>

      {answer ? <div className="mt-4 whitespace-pre-wrap rounded-2xl bg-white p-4 text-sm leading-6 text-zinc-900">{answer}</div> : null}
      {error ? <div className="mt-4 rounded-2xl bg-red-950/60 px-4 py-3 text-sm font-bold text-red-100 ring-1 ring-inset ring-red-700">{error}</div> : null}
    </section>
  )
}
