'use client'

import { useEffect, useMemo, useState } from 'react'

type ReportsResponse = {
  preset: string
  label: string
  from: string
  toExclusive: string
  totalReports: number
  totalPhotos: number
  totalReportNotes: number
  reports: any[]
}

type Preset = 'today' | 'week' | 'month' | 'custom'

function todayDateInputValue() {
  const now = new Date()
  return now.toISOString().slice(0, 10)
}

function getWeekStartValue() {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now.setDate(diff))
  return monday.toISOString().slice(0, 10)
}

export default function AdminReportsPage() {
  const [preset, setPreset] = useState<Preset>('today')
  const [fromDate, setFromDate] = useState(getWeekStartValue())
  const [toDate, setToDate] = useState(todayDateInputValue())
  const [data, setData] = useState<ReportsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const queryString = useMemo(() => {
    if (preset === 'custom') {
      return new URLSearchParams({
        preset: 'custom',
        from: fromDate,
        to: toDate,
      }).toString()
    }

    return new URLSearchParams({ preset }).toString()
  }, [preset, fromDate, toDate])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')

      try {
        const res = await fetch(`/api/reports?${queryString}`, {
          cache: 'no-store',
        })

        const json = await res.json()

        if (!res.ok) throw new Error(json?.error || 'Failed')

        setData(json)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [queryString])

  return (
    <main className="min-h-screen bg-zinc-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        
        {/* HEADER */}
        <div className="rounded-2xl bg-zinc-900 p-6 text-white">
          <h1 className="text-2xl font-bold">End of job reports</h1>
          <p className="text-sm text-zinc-300 mt-1">
            View completed reports by date range
          </p>
        </div>

        {/* FILTERS */}
        <div className="rounded-2xl border bg-white p-4">
          <div className="flex gap-2 mb-4 flex-wrap">
            {(['today', 'week', 'month', 'custom'] as Preset[]).map((p) => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={`px-4 py-2 rounded-full text-sm font-bold ${
                  preset === p
                    ? 'bg-zinc-900 text-white'
                    : 'bg-zinc-100'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {preset === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="border rounded-lg px-3 py-2"
              />
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="border rounded-lg px-3 py-2"
              />
            </div>
          )}
        </div>

        {/* CONTENT */}
        <div className="rounded-2xl border bg-white p-4">
          {loading && <p>Loading...</p>}

          {error && (
            <div className="text-red-600">{error}</div>
          )}

          {!loading && data && data.reports.length === 0 && (
            <p>No reports found.</p>
          )}

          {!loading && data && data.reports.length > 0 && (
            <div className="space-y-3">
              {data.reports.map((r: any) => (
                <div key={r.id} className="border rounded-xl p-3">
                  <div className="font-bold">{r.customer?.name}</div>
                  <div className="text-sm text-zinc-500">{r.title}</div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </main>
  )
}