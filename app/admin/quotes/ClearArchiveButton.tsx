'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function ClearArchiveButton({ count }: { count: number }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function clearArchive() {
    if (busy || count <= 0) return

    const confirmed = window.confirm(
      `Permanently delete ${count} archived quote${count === 1 ? '' : 's'}? This cannot be undone.`
    )
    if (!confirmed) return

    try {
      setBusy(true)
      setError('')

      const response = await fetch('/api/quotes/archive/clear', {
        method: 'DELETE',
      })
      const data = await response.json().catch(() => null)

      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || 'Could not clear the archive.')
      }

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not clear the archive.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <button
        type="button"
        onClick={clearArchive}
        disabled={busy || count <= 0}
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-red-600 px-4 py-2.5 text-sm font-black text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? 'Clearing archive…' : `Clear archive${count ? ` · ${count}` : ''}`}
      </button>
      {error ? <div className="text-xs font-semibold text-red-700">{error}</div> : null}
    </div>
  )
}
