'use client'

import { useState } from 'react'

export default function SchedulePage() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function runScheduler() {
    try {
      setLoading(true)
      setMessage(null)

      const res = await fetch('/api/scheduler/run', {
        method: 'POST',
      })

      const data = await res.json()

      if (!data.ok) {
        setMessage('Scheduler failed')
        return
      }

      // 👇 THIS IS THE IMPORTANT BIT
      if (data.travelMinutesSaved > 0) {
        setMessage(
          `Saved ${data.travelMinutesSaved} mins travel across ${data.optimisedDays} day${
            data.optimisedDays === 1 ? '' : 's'
          }`
        )
      } else {
        setMessage('No better route found 👍')
      }

      // OPTIONAL: trigger your refresh
      // await refreshSchedule()

    } catch (err) {
      console.error(err)
      setMessage('Error running scheduler')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 space-y-4">

      {/* Top bar */}
      <div className="flex gap-2">
        <button
          onClick={runScheduler}
          disabled={loading}
          className="bg-black text-white px-4 py-3 rounded-xl text-sm font-semibold w-full"
        >
          {loading ? 'Running…' : 'Auto Schedule'}
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className="bg-green-100 text-green-800 p-3 rounded-xl text-sm font-medium">
          {message}
        </div>
      )}

      {/* Your schedule UI continues below */}
      <div>
        {/* existing schedule layout here */}
      </div>
    </div>
  )
}