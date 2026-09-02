'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Props = {
  quoteId: number
  customerName?: string | null
  compact?: boolean
}

export default function DeleteQuoteButton({ quoteId, customerName, compact = false }: Props) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    const label = customerName?.trim() ? ` for ${customerName.trim()}` : ''
    if (!window.confirm(`Delete Quote #${quoteId}${label}?\n\nThis cannot be undone.`)) return

    setDeleting(true)
    setError('')

    try {
      const response = await fetch(`/api/quotes/${quoteId}`, { method: 'DELETE' })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.error || 'Could not delete the quote.')
      }

      router.refresh()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete the quote.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className={compact
          ? 'inline-flex min-h-9 items-center justify-center rounded-lg border border-red-200 bg-white px-3 text-xs font-black text-red-700 hover:bg-red-50 disabled:opacity-50'
          : 'inline-flex min-h-11 items-center justify-center rounded-xl border border-red-200 bg-white px-4 text-sm font-black text-red-700 hover:bg-red-50 disabled:opacity-50'}
      >
        {deleting ? 'Deleting…' : 'Delete'}
      </button>
      {error ? <div className="max-w-64 text-right text-[11px] font-semibold text-red-700">{error}</div> : null}
    </div>
  )
}
