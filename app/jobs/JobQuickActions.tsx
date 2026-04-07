'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function JobQuickActions({
  jobId,
  customerName,
  jobType,
}: {
  jobId: number
  customerName: string
  jobType?: string | null
}) {
  const router = useRouter()
  const [loadingAction, setLoadingAction] = useState<
    'quote-complete' | 'cancel' | 'archive' | null
  >(null)

  const isQuoteJob = String(jobType || '').toLowerCase().includes('quote')

  async function runQuoteComplete() {
    const confirmed = window.confirm(
      `Mark ${customerName || `Job #${jobId}`} as quote complete and remove it from the schedule?`
    )

    if (!confirmed) return
    if (loadingAction) return

    setLoadingAction('quote-complete')

    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'quoted',
          visitDate: null,
          startTime: null,
          arrivedAt: null,
          finishedAt: null,
          pausedAt: null,
          pausedMinutes: 0,
        }),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to complete quote')
      }

      router.refresh()
      router.replace('/jobs')
    } catch (error) {
      console.error(error)
      window.alert(
        error instanceof Error ? error.message : 'Failed to complete quote.'
      )
    } finally {
      setLoadingAction(null)
    }
  }

  async function runCancel() {
    const confirmed = window.confirm(
      `Are you sure you want to cancel ${customerName || `Job #${jobId}`}?`
    )

    if (!confirmed) return
    if (loadingAction) return

    setLoadingAction('cancel')

    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'cancel',
        }),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to cancel job')
      }

      router.refresh()
      router.replace('/jobs')
    } catch (error) {
      console.error(error)
      window.alert(
        error instanceof Error ? error.message : 'Failed to cancel job.'
      )
    } finally {
      setLoadingAction(null)
    }
  }

  async function runArchive() {
    const confirmed = window.confirm(
      `Are you sure you want to archive ${customerName || `Job #${jobId}`}?`
    )

    if (!confirmed) return
    if (loadingAction) return

    setLoadingAction('archive')

    try {
      const res = await fetch(`/api/jobs/${jobId}/archive`, {
        method: 'POST',
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to archive job')
      }

      router.refresh()
      router.replace('/jobs')
    } catch (error) {
      console.error(error)
      window.alert(
        error instanceof Error ? error.message : 'Failed to archive job.'
      )
    } finally {
      setLoadingAction(null)
    }
  }

  return (
    <div
      className={`grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap ${
        isQuoteJob ? 'grid-cols-1 sm:grid-cols-none' : 'grid-cols-2'
      }`}
    >
      {isQuoteJob ? (
        <button
          type="button"
          onClick={runQuoteComplete}
          disabled={loadingAction !== null}
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-purple-300 bg-white px-4 py-2.5 text-sm font-semibold text-purple-700 transition hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-70 sm:min-w-[140px] sm:w-auto"
        >
          {loadingAction === 'quote-complete'
            ? 'Completing Quote...'
            : 'Quote Complete'}
        </button>
      ) : null}

      <button
        type="button"
        onClick={runCancel}
        disabled={loadingAction !== null}
        className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70 sm:min-w-[82px] sm:w-auto"
      >
        {loadingAction === 'cancel' ? 'Cancelling...' : 'Cancel'}
      </button>

      <button
        type="button"
        onClick={runArchive}
        disabled={loadingAction !== null}
        className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-70 sm:min-w-[82px] sm:w-auto"
      >
        {loadingAction === 'archive' ? 'Archiving...' : 'Archive'}
      </button>
    </div>
  )
}