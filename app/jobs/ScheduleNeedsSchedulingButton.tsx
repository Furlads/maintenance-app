'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function ScheduleNeedsSchedulingButton({
  count,
}: {
  count: number
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSchedule() {
    setBusy(true)
    setMessage('')

    try {
      const res = await fetch('/api/schedule/rebuild', {
        method: 'POST',
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to rebuild schedule')
      }

      setMessage('Scheduler updated.')
      router.refresh()
    } catch (error) {
      console.error(error)
      setMessage(
        error instanceof Error ? error.message : 'Failed to rebuild schedule.'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <button
        type="button"
        onClick={handleSchedule}
        disabled={busy}
        className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-70"
      >
        {busy ? `Scheduling ${count}...` : `Schedule ${count} Now`}
      </button>

      {message ? (
        <div className="text-xs font-medium text-zinc-500">{message}</div>
      ) : null}
    </div>
  )
}