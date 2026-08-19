'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function PlanActions({
  jobId,
  scheduleDate,
}: {
  jobId: number
  scheduleDate: string | null
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function regenerate() {
    try {
      setBusy(true)
      setError('')

      const response = await fetch(`/api/landscaping/jobs/${jobId}/plan`, {
        method: 'POST',
      })
      const data = await response.json().catch(() => null)

      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || 'Could not regenerate the landscaping plan.')
      }

      router.refresh()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not regenerate the landscaping plan.'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      {error ? (
        <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          {error}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void regenerate()}
          disabled={busy}
          className="min-h-11 rounded-xl bg-yellow-300 px-4 text-sm font-black text-zinc-950 disabled:opacity-50"
        >
          {busy ? 'CHAS is rebuilding the pack…' : '✨ Regenerate job pack'}
        </button>
        <Link
          href={`/landscaping/jobs/${jobId}`}
          className="inline-flex min-h-11 items-center rounded-xl border border-zinc-300 bg-white px-4 text-sm font-black text-zinc-800"
        >
          Worker job sheet
        </Link>
        <Link
          href={scheduleDate ? `/admin/schedule?date=${scheduleDate}` : '/admin/schedule'}
          className="inline-flex min-h-11 items-center rounded-xl bg-zinc-950 px-4 text-sm font-black text-white"
        >
          Open schedule
        </Link>
      </div>
    </div>
  )
}
