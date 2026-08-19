'use client'

import { useState } from 'react'

type SiteIssue = {
  id: string
  message: string
  reportedBy: string
  reportedAt: string
  resolved: boolean
}

type Props = {
  jobId: number
  initialIssues: SiteIssue[]
}

export default function SiteIssuesPanel({ jobId, initialIssues }: Props) {
  const [issues, setIssues] = useState(initialIssues)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function setResolved(id: string, resolved: boolean) {
    const next = issues.map((issue) => issue.id === id ? { ...issue, resolved } : issue)
    setIssues(next)
    try {
      setSaving(true)
      setError('')
      const response = await fetch(`/api/landscaping/jobs/${jobId}/controls`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteIssues: next }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Could not update site issue.')
      setIssues(data.controls?.siteIssues || next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update site issue.')
    } finally {
      setSaving(false)
    }
  }

  if (!issues.length) return null

  const open = issues.filter((issue) => !issue.resolved)

  return (
    <section className="rounded-3xl border border-red-200 bg-red-50 p-5 shadow-sm">
      <div className="text-xs font-black uppercase tracking-[0.16em] text-red-700">Worker site reports</div>
      <h2 className="mt-1 text-xl font-black text-red-950">Problems raised from site</h2>
      <p className="mt-1 text-sm leading-6 text-red-900">{open.length} open issue{open.length === 1 ? '' : 's'}. Resolve them here once Trev/Kelly has dealt with them.</p>
      <div className="mt-4 space-y-2">
        {issues.slice().reverse().map((issue) => (
          <div key={issue.id} className="rounded-2xl bg-white p-4 ring-1 ring-inset ring-red-200">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="font-bold text-zinc-950">{issue.message}</div>
                <div className="mt-1 text-xs text-zinc-500">Reported by {issue.reportedBy || 'worker'}</div>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => void setResolved(issue.id, !issue.resolved)}
                className={`min-h-10 rounded-xl px-3 text-xs font-black ${issue.resolved ? 'bg-zinc-100 text-zinc-700' : 'bg-red-900 text-white'}`}
              >
                {issue.resolved ? 'Reopen issue' : 'Mark resolved'}
              </button>
            </div>
          </div>
        ))}
      </div>
      {error ? <div className="mt-3 rounded-xl bg-white px-3 py-2 text-sm font-bold text-red-800">{error}</div> : null}
    </section>
  )
}
