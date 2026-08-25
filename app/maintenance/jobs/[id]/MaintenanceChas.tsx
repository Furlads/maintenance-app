'use client'

import { ChangeEvent, useRef, useState } from 'react'
import ChasAvatar from '@/app/components/ChasAvatar'

type Props = { jobId: number }

async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Could not read that photo.'))
    reader.readAsDataURL(file)
  })
}

export default function MaintenanceChas({ jobId }: Props) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [imageDataUrl, setImageDataUrl] = useState('')
  const [imageName, setImageName] = useState('')
  const photoInputRef = useRef<HTMLInputElement | null>(null)

  async function ask(text?: string) {
    const clean = (text ?? question).trim()
    if ((!clean && !imageDataUrl) || busy) return

    try {
      setBusy(true)
      setError('')
      setAnswer('')
      if (text) setQuestion(text)

      const response = await fetch(`/api/maintenance/jobs/${jobId}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: clean, imageDataUrl }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || 'CHAS could not answer right now.')
      }
      setAnswer(String(data.answer || ''))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CHAS could not answer right now.')
    } finally {
      setBusy(false)
    }
  }

  async function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setError('')
      if (!file.type.startsWith('image/')) {
        throw new Error('Please choose a photo.')
      }
      if (file.size > 8 * 1024 * 1024) {
        throw new Error('That photo is too large. Please choose a smaller one.')
      }

      const dataUrl = await fileToDataUrl(file)
      setImageDataUrl(dataUrl)
      setImageName(file.name || 'Site photo')
    } catch (err) {
      setImageDataUrl('')
      setImageName('')
      setError(err instanceof Error ? err.message : 'Could not add that photo.')
    } finally {
      if (photoInputRef.current) photoInputRef.current.value = ''
    }
  }

  function clearPhoto() {
    setImageDataUrl('')
    setImageName('')
  }

  return (
    <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4 text-white shadow-sm sm:p-5">
      <div className="flex items-center gap-3">
        <ChasAvatar size={62} />
        <div>
          <div className="text-xs font-black uppercase tracking-[0.16em] text-yellow-300">Ask CHAS about this job</div>
          <h2 className="mt-1 text-xl font-black">Job-aware help without re-explaining everything</h2>
          <div className="mt-1 text-[11px] font-bold text-zinc-400">Furlads • Three Counties Property Care</div>
        </div>
      </div>

      <p className="mt-3 text-sm leading-6 text-zinc-300">
        CHAS can see this job’s brief, customer/property details, useful history and any extras already logged. Add a photo if you need help with something you can see on site.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
        <button
          type="button"
          onClick={() => void ask('What should I prioritise on this job today?')}
          disabled={busy}
          className="min-h-11 rounded-xl bg-yellow-300 px-3 py-2 text-sm font-black text-zinc-950 disabled:opacity-50 sm:text-xs"
        >
          What should I prioritise?
        </button>
        <button
          type="button"
          onClick={() => photoInputRef.current?.click()}
          disabled={busy}
          className="min-h-11 rounded-xl bg-white/10 px-3 py-2 text-sm font-black text-white ring-1 ring-inset ring-white/15 disabled:opacity-50 sm:text-xs"
        >
          Add photo
        </button>
      </div>

      <input
        ref={photoInputRef}
        type="file"
        accept="image/*,.heic,.heif"
        onChange={(event) => void handlePhoto(event)}
        className="hidden"
      />

      {imageDataUrl ? (
        <div className="mt-4 overflow-hidden rounded-2xl bg-white/10 p-3 ring-1 ring-inset ring-white/15">
          <img src={imageDataUrl} alt="Photo for CHAS" className="max-h-72 w-full rounded-xl object-contain" />
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="min-w-0 truncate text-xs font-bold text-zinc-300">{imageName || 'Site photo added'}</div>
            <button type="button" onClick={clearPhoto} className="shrink-0 text-xs font-black text-yellow-300">Remove</button>
          </div>
        </div>
      ) : null}

      <textarea
        rows={3}
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="e.g. What is this? Can I cut this back? Is this fixing detail right?"
        className="mt-4 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-base text-white placeholder:text-zinc-500"
      />

      <button
        type="button"
        onClick={() => void ask()}
        disabled={busy || (!question.trim() && !imageDataUrl)}
        className="mt-3 min-h-12 w-full rounded-xl bg-yellow-300 px-4 text-sm font-black text-zinc-950 disabled:opacity-50 sm:w-auto"
      >
        {busy ? 'CHAS is thinking…' : 'Ask CHAS'}
      </button>

      {answer ? (
        <div className="mt-4 flex gap-3 rounded-2xl bg-white p-4 text-sm leading-6 text-zinc-900">
          <ChasAvatar size={38} />
          <div className="whitespace-pre-wrap flex-1">{answer}</div>
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-2xl bg-red-950/60 px-4 py-3 text-sm font-bold text-red-100 ring-1 ring-inset ring-red-700">{error}</div>
      ) : null}
    </section>
  )
}
