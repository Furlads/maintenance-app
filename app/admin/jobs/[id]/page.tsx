'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

type Job = {
  id: string
  title: string
  address: string
  postcode?: string | null
  notes?: string | null
  status: 'todo' | 'done' | 'unscheduled'
  visitDate?: string | null
  startTime?: string | null
  assignedTo: string
  arrivedAt?: string | null
  finishedAt?: string | null
  createdAt: string
}

export default function JobPage() {
  const params = useParams()
  const router = useRouter()
  const jobId = params?.id as string

  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  async function loadJob() {
    setLoading(true)
    try {
      const res = await fetch(`/api/jobs/${jobId}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Failed to load job')
      setJob(data)
    } catch (e: any) {
      setMsg(e?.message ?? 'Failed to load job')
    } finally {
      setLoading(false)
    }
  }

  async function markArrived() {
    await fetch(`/api/jobs/${jobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'arrived' })
    })
    loadJob()
  }

  async function markFinished() {
    await fetch(`/api/jobs/${jobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'finished' })
    })
    loadJob()
  }

  useEffect(() => {
    if (jobId) loadJob()
  }, [jobId])

  if (loading) return <div className="p-6">Loading…</div>

  if (!job) return <div className="p-6 text-red-600">{msg || 'Job not found'}</div>

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold">{job.title}</h1>
          <div className="text-sm text-gray-500">
            Assigned to {job.assignedTo}
          </div>
        </div>

        <button
          onClick={() => router.push('/admin')}
          className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
        >
          ← Back
        </button>
      </div>

      <div className="rounded-lg border bg-white p-4 space-y-4">

        <div>
          <div className="text-sm font-medium">Address</div>
          <div className="text-sm text-gray-700 whitespace-pre-line">
            {job.address}
          </div>
        </div>

        <div>
          <div className="text-sm font-medium">Status</div>
          <div className="text-sm">{job.status}</div>
        </div>

        {job.arrivedAt && (
          <div className="text-sm text-green-700">
            Arrived at {new Date(job.arrivedAt).toLocaleTimeString()}
          </div>
        )}

        {job.finishedAt && (
          <div className="text-sm text-blue-700">
            Finished at {new Date(job.finishedAt).toLocaleTimeString()}
          </div>
        )}

        <div className="flex gap-3 pt-4">

          {!job.arrivedAt && (
            <button
              onClick={markArrived}
              className="rounded bg-green-600 text-white px-4 py-2 text-sm hover:opacity-90"
            >
              Mark Arrived
            </button>
          )}

          {!job.finishedAt && (
            <button
              onClick={markFinished}
              className="rounded bg-blue-600 text-white px-4 py-2 text-sm hover:opacity-90"
            >
              Mark Finished
            </button>
          )}

        </div>

      </div>

      <div className="mt-6 text-sm text-gray-400">
        Created {new Date(job.createdAt).toLocaleString()}
      </div>
    </div>
  )
}