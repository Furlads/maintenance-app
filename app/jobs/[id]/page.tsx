'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type Worker = {
  id: number
  firstName: string
  lastName: string
  phone: string | null
}

type JobAssignment = {
  id: number
  workerId: number
  worker: Worker
}

type Customer = {
  id: number
  name: string
  phone: string | null
  address: string | null
  postcode: string | null
}

type Job = {
  id: number
  title: string
  address: string
  notes: string | null
  status: string
  jobType: string
  createdAt: string
  customer: Customer
  assignments: JobAssignment[]
}

export default function JobPage() {
  const params = useParams()
  const id = Number(params.id)

  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadJob() {
      try {
        setError('')

        const res = await fetch('/api/jobs')

        if (!res.ok) {
          throw new Error('Failed to load jobs')
        }

        const data = await res.json()
        const jobs = Array.isArray(data) ? data : []
        const foundJob = jobs.find((item) => item.id === id) || null

        setJob(foundJob)
      } catch (err) {
        console.error(err)
        setError('Failed to load job.')
        setJob(null)
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      loadJob()
    }
  }, [id])

  if (loading) {
    return (
      <main style={{ padding: 20, fontFamily: 'sans-serif' }}>
        <p>Loading job...</p>
      </main>
    )
  }

  if (error) {
    return (
      <main style={{ padding: 20, fontFamily: 'sans-serif' }}>
        <p>{error}</p>
      </main>
    )
  }

  if (!job) {
    return (
      <main style={{ padding: 20, fontFamily: 'sans-serif' }}>
        <p>Job not found.</p>
      </main>
    )
  }

  const navigationQuery =
    job.customer?.postcode || job.address || job.customer?.address || ''

  return (
    <main style={{ padding: 20, fontFamily: 'sans-serif', maxWidth: 800 }}>
      <h1 style={{ fontSize: 28, marginBottom: 20 }}>{job.title}</h1>

      <div
        style={{
          padding: 16,
          border: '1px solid #ddd',
          borderRadius: 10,
          marginBottom: 20
        }}
      >
        <p style={{ margin: '4px 0' }}>
          <strong>Customer:</strong> {job.customer?.name || 'Unknown customer'}
        </p>

        <p style={{ margin: '4px 0' }}>
          <strong>Type:</strong> {job.jobType}
        </p>

        <p style={{ margin: '4px 0' }}>
          <strong>Status:</strong> {job.status}
        </p>

        <p style={{ margin: '4px 0' }}>
          <strong>Address:</strong> {job.address}
        </p>

        {job.notes && (
          <p style={{ margin: '4px 0' }}>
            <strong>Notes:</strong> {job.notes}
          </p>
        )}

        <p style={{ margin: '4px 0' }}>
          <strong>Assigned:</strong>{' '}
          {job.assignments.length > 0
            ? job.assignments
                .map(
                  (assignment) =>
                    `${assignment.worker.firstName} ${assignment.worker.lastName}`
                )
                .join(', ')
            : 'Nobody assigned'}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {job.customer?.phone && (
          <a
            href={`tel:${job.customer.phone}`}
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              border: '1px solid #ccc',
              textDecoration: 'none',
              color: 'inherit'
            }}
          >
            Call Customer
          </a>
        )}

        {navigationQuery && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(navigationQuery)}`}
            target="_blank"
            rel="noreferrer"
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              border: '1px solid #ccc',
              textDecoration: 'none',
              color: 'inherit'
            }}
          >
            Navigate
          </a>
        )}
      </div>
    </main>
  )
}