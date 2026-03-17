'use client'

import { useState } from 'react'

export default function JobQuickActions({
  jobId,
  customerName,
}: {
  jobId: number
  customerName: string
}) {
  const [loadingAction, setLoadingAction] = useState<'cancel' | 'archive' | null>(null)

  async function runAction(action: 'cancel' | 'archive') {
    const label = action === 'cancel' ? 'cancel' : 'archive'
    const confirmed = window.confirm(
      `Are you sure you want to ${label} ${customerName || `Job #${jobId}`}?`
    )

    if (!confirmed) return
    if (loadingAction) return

    setLoadingAction(action)

    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
        }),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || `Failed to ${label} job`)
      }

      window.location.reload()
    } catch (error) {
      console.error(error)
      window.alert(
        error instanceof Error ? error.message : `Failed to ${label} job.`
      )
    } finally {
      setLoadingAction(null)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => runAction('cancel')}
        disabled={loadingAction !== null}
        className="inline-flex min-w-[82px] items-center justify-center rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loadingAction === 'cancel' ? 'Cancelling...' : 'Cancel'}
      </button>

      <button
        type="button"
        onClick={() => runAction('archive')}
        disabled={loadingAction !== null}
        className="inline-flex min-w-[82px] items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loadingAction === 'archive' ? 'Archiving...' : 'Archive'}
      </button>
    </>
  )
}