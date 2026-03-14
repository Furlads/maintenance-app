'use client'

import { useState } from 'react'

export default function AdminSchedulerButton() {
  const [running, setRunning] = useState(false)

  async function handleRunScheduler() {
    if (running) return

    setRunning(true)

    try {
      const res = await fetch('/api/scheduler/run', {
        method: 'POST',
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || 'Scheduler failed')
      }

      window.alert('Unscheduled jobs have been automatically placed into the diary.')
      window.location.reload()
    } catch (error) {
      console.error(error)
      window.alert(
        error instanceof Error ? error.message : 'Scheduler failed to run.'
      )
    } finally {
      setRunning(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleRunScheduler}
      disabled={running}
      className="rounded-xl bg-yellow-400 px-4 py-2.5 text-sm font-semibold text-zinc-900 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {running ? 'Scheduling jobs...' : 'Auto schedule jobs'}
    </button>
  )
}