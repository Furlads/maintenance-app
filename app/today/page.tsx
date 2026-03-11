'use client'

import { useEffect, useMemo, useState } from 'react'

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

export default function TodayPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [workerId, setWorkerId] = useState<number | null>(null)
  const [workerName, setWorkerName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const savedWorkerId = localStorage.getItem('workerId')
    const savedWorkerName = localStorage.getItem('workerName')

    if (savedWorkerId) {
      setWorkerId(Number(savedWorkerId))
    }

    if (savedWorkerName) {
      setWorkerName(savedWorkerName)
    }

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

  const workerJobs = useMemo(() => {
    if (!workerId) return []

    return jobs.filter((job) => {
      const assignedToWorker = job.assignments.some(
        (assignment) => assignment.workerId === workerId
      )

      const isCompleted = job.status.toLowerCase() === 'completed'

      return assignedToWorker && !isCompleted
    })
  }, [jobs, workerId])

  return (
    <main style={{ padding: 20, fontFamily: 'sans-serif', maxWidth: 800 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Today</h1>

      {workerName && (
        <p style={{ marginTop: 0, marginBottom: 20 }}>
          Logged in as <strong>{workerName}</strong>
        </p>
      )}

      <div style={{ marginBottom: 20 }}>
        <a
          href="/jobs"
          style={{
            display: 'inline-block',
            padding: '12px 16px',
            borderRadius: 8,
            border: '1px solid #ccc',
            textDecoration: 'none',
            color: 'inherit',
            marginRight: 10
          }}
        >
          View All Jobs
        </a>

        <a
          href="/customers"
          style={{
            display: 'inline-block',
            padding: '12px 16px',
            borderRadius: 8,
            border: '1px solid #ccc',
            textDecoration: 'none',
            color: 'inherit'
          }}
        >
          View Customers
        </a>
      </div>

      {loading && <p>Loading jobs...</p>}

      {!loading && error && <p>{error}</p>}

      {!loading && !error && !workerId && (
        <p>No worker selected. Go back and choose a worker first.</p>
      )}

      {!loading && !error && workerId && workerJobs.length === 0 && (
        <p>No open jobs assigned to you.</p>
      )}

      {!loading &&
        !error &&
        workerJobs.map((job) => {
          const navigationQuery =
            job.customer?.postcode || job.address || job.customer?.address || ''

          return (
            <div
              key={job.id}
              style={{
                padding: 16,
                border: '1px solid #ddd',
                borderRadius: 10,
                marginBottom: 12
              }}
            >
              <a
                href={`/jobs/${job.id}`}
                style={{
                  textDecoration: 'none',
                  color: 'inherit'
                }}
              >
                <h2 style={{ margin: '0 0 8px 0', fontSize: 20 }}>{job.title}</h2>
              </a>

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

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
                <a
                  href={`/jobs/${job.id}`}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 8,
                    border: '1px solid #ccc',
                    textDecoration: 'none',
                    color: 'inherit'
                  }}
                >
                  Open Job
                </a>

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
            </div>
          )
        })}
    </main>
  )
}