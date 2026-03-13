'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type Worker = {
  id: number
  firstName?: string | null
  lastName?: string | null
  name?: string | null
}

type Assignment = {
  id?: number
  workerId?: number
  worker?: Worker | null
}

type Customer = {
  id: number
  name?: string | null
  firstName?: string | null
  lastName?: string | null
  companyName?: string | null
}

type Job = {
  id: number
  title?: string | null
  address?: string | null
  notes?: string | null
  status?: string | null
  jobType?: string | null
  visitDate?: string | null
  startTime?: string | null
  durationMinutes?: number | null
  durationMins?: number | null
  overrunMins?: number | null
  assignedTo?: string | null
  customer?: Customer | null
  assignments?: Assignment[]
}

function formatDate(dateValue?: string | null) {
  if (!dateValue) return 'No date set'

  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return 'No date set'

  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(date)
}

function formatStatus(status?: string | null) {
  if (!status) return 'Unknown'

  return status
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function getStatusStyles(status?: string | null) {
  const value = (status || '').toLowerCase()

  if (value === 'done') {
    return {
      background: '#dcfce7',
      color: '#166534',
      border: '1px solid #86efac'
    }
  }

  if (value === 'in_progress') {
    return {
      background: '#dbeafe',
      color: '#1d4ed8',
      border: '1px solid #93c5fd'
    }
  }

  if (value === 'paused') {
    return {
      background: '#fef3c7',
      color: '#92400e',
      border: '1px solid #fcd34d'
    }
  }

  if (value === 'unscheduled') {
    return {
      background: '#f3f4f6',
      color: '#374151',
      border: '1px solid #d1d5db'
    }
  }

  return {
    background: '#fef3c7',
    color: '#92400e',
    border: '1px solid #fde68a'
  }
}

function getCustomerName(customer?: Customer | null) {
  if (!customer) return 'No customer'

  if (customer.name) return customer.name
  if (customer.companyName) return customer.companyName

  const fullName = `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim()
  return fullName || 'No customer'
}

function getAssignedWorkers(job: Job) {
  if (Array.isArray(job.assignments) && job.assignments.length > 0) {
    const names = job.assignments
      .map((assignment) => {
        const worker = assignment.worker
        if (!worker) return null

        if (worker.name) return worker.name

        const fullName = `${worker.firstName ?? ''} ${worker.lastName ?? ''}`.trim()
        return fullName || null
      })
      .filter(Boolean) as string[]

    if (names.length > 0) return names.join(', ')
  }

  if (job.assignedTo && job.assignedTo.trim()) {
    return job.assignedTo
  }

  return 'Unassigned'
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  async function loadJobs() {
    try {
      setLoading(true)
      setError('')

      const res = await fetch('/api/jobs', { cache: 'no-store' })

      if (!res.ok) {
        throw new Error('Failed to load jobs')
      }

      const data = await res.json()

      const nextJobs = Array.isArray(data)
        ? data
        : Array.isArray(data?.jobs)
          ? data.jobs
          : []

      setJobs(nextJobs)
    } catch (err) {
      console.error(err)
      setError('Failed to load jobs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadJobs()
  }, [])

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchesStatus =
        statusFilter === 'all'
          ? true
          : (job.status || '').toLowerCase() === statusFilter.toLowerCase()

      const searchText = search.trim().toLowerCase()

      const haystack = [
        job.title,
        job.address,
        job.status,
        job.jobType,
        getCustomerName(job.customer),
        getAssignedWorkers(job)
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const matchesSearch = !searchText || haystack.includes(searchText)

      return matchesStatus && matchesSearch
    })
  }, [jobs, search, statusFilter])

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f8fafc',
        padding: '16px'
      }}
    >
      <div
        style={{
          maxWidth: '1100px',
          margin: '0 auto'
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            marginBottom: '18px'
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: '28px',
                fontWeight: 800,
                color: '#111827'
              }}
            >
              Jobs
            </h1>

            <p
              style={{
                margin: '6px 0 0 0',
                color: '#6b7280',
                fontSize: '14px'
              }}
            >
              Manage landscaping jobs, maintenance visits, worker assignments and progress.
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '10px',
              flexWrap: 'wrap'
            }}
          >
            <button
              onClick={loadJobs}
              style={{
                border: '1px solid #d1d5db',
                background: '#fff',
                color: '#111827',
                padding: '12px 16px',
                borderRadius: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Refresh
            </button>

            <Link
              href="/jobs/add"
              style={{
                textDecoration: 'none',
                background: '#111827',
                color: '#fff',
                padding: '12px 16px',
                borderRadius: '12px',
                fontWeight: 700
              }}
            >
              + Add Job
            </Link>
          </div>
        </div>

        <div
          style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '18px',
            padding: '14px',
            marginBottom: '18px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '12px'
            }}
          >
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#374151',
                  marginBottom: '6px'
                }}
              >
                Search jobs
              </label>

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title, address, customer or worker"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: '1px solid #d1d5db',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#374151',
                  marginBottom: '6px'
                }}
              >
                Filter by status
              </label>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: '1px solid #d1d5db',
                  fontSize: '14px',
                  outline: 'none',
                  background: '#fff'
                }}
              >
                <option value="all">All statuses</option>
                <option value="unscheduled">Unscheduled</option>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="paused">Paused</option>
                <option value="done">Done</option>
              </select>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'end'
              }}
            >
              <div
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  color: '#374151',
                  fontSize: '14px',
                  fontWeight: 700
                }}
              >
                {filteredJobs.length} job{filteredJobs.length === 1 ? '' : 's'} shown
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div
            style={{
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '18px',
              padding: '22px',
              color: '#6b7280'
            }}
          >
            Loading jobs...
          </div>
        ) : error ? (
          <div
            style={{
              background: '#fff7ed',
              border: '1px solid #fdba74',
              color: '#9a3412',
              borderRadius: '18px',
              padding: '18px',
              fontWeight: 700
            }}
          >
            {error}
          </div>
        ) : filteredJobs.length === 0 ? (
          <div
            style={{
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '18px',
              padding: '22px',
              color: '#6b7280'
            }}
          >
            No jobs found.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gap: '14px'
            }}
          >
            {filteredJobs.map((job) => {
              const statusStyles = getStatusStyles(job.status)

              return (
                <div
                  key={job.id}
                  style={{
                    background: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '18px',
                    padding: '16px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '12px',
                      flexWrap: 'wrap',
                      marginBottom: '12px'
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          flexWrap: 'wrap',
                          marginBottom: '8px'
                        }}
                      >
                        <h2
                          style={{
                            margin: 0,
                            fontSize: '20px',
                            lineHeight: 1.2,
                            color: '#111827'
                          }}
                        >
                          {job.title || `Job #${job.id}`}
                        </h2>

                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '6px 10px',
                            borderRadius: '999px',
                            fontSize: '12px',
                            fontWeight: 800,
                            ...statusStyles
                          }}
                        >
                          {formatStatus(job.status)}
                        </span>
                      </div>

                      <div
                        style={{
                          color: '#6b7280',
                          fontSize: '14px',
                          display: 'grid',
                          gap: '6px'
                        }}
                      >
                        <div>
                          <strong style={{ color: '#111827' }}>Customer:</strong>{' '}
                          {getCustomerName(job.customer)}
                        </div>

                        <div>
                          <strong style={{ color: '#111827' }}>Address:</strong>{' '}
                          {job.address || 'No address'}
                        </div>

                        <div>
                          <strong style={{ color: '#111827' }}>Type:</strong>{' '}
                          {job.jobType || 'Not set'}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        gap: '10px',
                        alignItems: 'flex-start',
                        flexWrap: 'wrap'
                      }}
                    >
                      <Link
                        href={`/jobs/${job.id}`}
                        style={{
                          textDecoration: 'none',
                          padding: '11px 14px',
                          borderRadius: '12px',
                          border: '1px solid #d1d5db',
                          background: '#fff',
                          color: '#111827',
                          fontWeight: 700
                        }}
                      >
                        View
                      </Link>

                      <Link
                        href={`/jobs/${job.id}`}
                        style={{
                          textDecoration: 'none',
                          padding: '11px 14px',
                          borderRadius: '12px',
                          border: '1px solid #111827',
                          background: '#111827',
                          color: '#fff',
                          fontWeight: 700
                        }}
                      >
                        Edit
                      </Link>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: '10px',
                      marginTop: '8px'
                    }}
                  >
                    <div
                      style={{
                        background: '#f9fafb',
                        border: '1px solid #e5e7eb',
                        borderRadius: '14px',
                        padding: '12px'
                      }}
                    >
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: 800,
                          color: '#6b7280',
                          marginBottom: '4px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em'
                        }}
                      >
                        Visit date
                      </div>
                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          color: '#111827'
                        }}
                      >
                        {formatDate(job.visitDate)}
                      </div>
                    </div>

                    <div
                      style={{
                        background: '#f9fafb',
                        border: '1px solid #e5e7eb',
                        borderRadius: '14px',
                        padding: '12px'
                      }}
                    >
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: 800,
                          color: '#6b7280',
                          marginBottom: '4px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em'
                        }}
                      >
                        Start time
                      </div>
                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          color: '#111827'
                        }}
                      >
                        {job.startTime || 'Not set'}
                      </div>
                    </div>

                    <div
                      style={{
                        background: '#f9fafb',
                        border: '1px solid #e5e7eb',
                        borderRadius: '14px',
                        padding: '12px'
                      }}
                    >
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: 800,
                          color: '#6b7280',
                          marginBottom: '4px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em'
                        }}
                      >
                        Duration
                      </div>
                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          color: '#111827'
                        }}
                      >
                        {job.durationMinutes ?? job.durationMins ?? 0} mins
                      </div>
                    </div>

                    <div
                      style={{
                        background: '#f9fafb',
                        border: '1px solid #e5e7eb',
                        borderRadius: '14px',
                        padding: '12px'
                      }}
                    >
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: 800,
                          color: '#6b7280',
                          marginBottom: '4px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em'
                        }}
                      >
                        Assigned workers
                      </div>
                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          color: '#111827'
                        }}
                      >
                        {getAssignedWorkers(job)}
                      </div>
                    </div>
                  </div>

                  {job.notes ? (
                    <div
                      style={{
                        marginTop: '12px',
                        padding: '12px',
                        borderRadius: '14px',
                        background: '#fffbea',
                        border: '1px solid #fef08a',
                        color: '#713f12',
                        fontSize: '14px'
                      }}
                    >
                      <strong>Notes:</strong> {job.notes}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}