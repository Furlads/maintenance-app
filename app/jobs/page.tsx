'use client'

import { useEffect, useState } from 'react'

type Worker = {
  id: number
  firstName: string
  lastName: string
}

type JobAssignment = {
  id: number
  workerId: number
  worker: Worker
}

type Customer = {
  id: number
  name: string
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

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadJobs() {
      try {
        setError('')

        const res = await fetch('/api/jobs')

        if (!res.ok) {
          throw new Error('Failed to load jobs')
        }

        const data = await res.json()
        setJobs(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error(err)
        setJobs([])
        setError('Failed to load jobs.')
      } finally {
        setLoading(false)
      }
    }

    loadJobs()
  }, [])

  return (
    <main style={{ padding: 20, fontFamily: 'sans-serif', maxWidth: 800 }}>
      <h1 style={{ fontSize: 28, marginBottom: 20 }}>Jobs</h1>

      <div style={{ marginBottom: 20 }}>
        <a
          href="/jobs/add"
          style={{
            display: 'inline-block',
            padding: '12px 16px',
            borderRadius: 8,
            border: '1px solid #ccc',
            textDecoration: 'none',
            color: 'inherit'
          }}
        >
          Add Job
        </a>
      </div>

      {loading && <p>Loading jobs...</p>}

      {!loading && error && <p>{error}</p>}

      {!loading && !error && jobs.length === 0 && <p>No jobs found.</p>}

      {!loading &&
        !error &&
        jobs.map((job) => (
          <div
            key={job.id}
            style={{
              padding: 16,
              border: '1px solid #ddd',
              borderRadius: 10,
              marginBottom: 12
            }}
          >
            <h2 style={{ margin: '0 0 8px 0', fontSize: 20 }}>{job.title}</h2>

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
        ))}
    </main>
  )
}