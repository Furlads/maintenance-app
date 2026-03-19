'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import CustomerHistory from './CustomerHistory'
import WorkerMenu from '@/app/components/WorkerMenu'

type Customer = {
  id: number
  name: string
  phone: string | null
  email: string | null
  address: string | null
  postcode: string | null
  notes: string | null
  archived?: boolean
  createdAt: string
}

type Job = {
  id: number
  customerId: number
  title: string
  address: string | null
  notes: string | null
  status: string
  createdAt: string
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  } catch {
    return value
  }
}

function formatStatus(value: string) {
  if (!value) return 'Unknown'

  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export default function CustomerPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function loadPageData() {
      try {
        const [customerRes, jobsRes] = await Promise.all([
          fetch(`/api/customers/${id}`, { cache: 'no-store' }),
          fetch('/api/jobs', { cache: 'no-store' })
        ])

        const customerData = await customerRes.json()
        const jobsData = await jobsRes.json()

        setCustomer(customerData)

        const customerId = Number(id)
        const filteredJobs = Array.isArray(jobsData)
          ? jobsData.filter((job) => job.customerId === customerId)
          : []

        setJobs(filteredJobs)
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      loadPageData()
    }
  }, [id])

  async function handleArchive() {
    if (!customer || actionLoading) return

    const confirmed = window.confirm(
      'Archive this customer? They will be hidden from the main customer list but not deleted.'
    )

    if (!confirmed) return

    setActionLoading(true)
    setMessage('')

    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'archive' })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to archive customer')
      }

      router.push('/customers')
      router.refresh()
    } catch (error) {
      console.error(error)
      setMessage(
        error instanceof Error ? error.message : 'Failed to archive customer'
      )
    } finally {
      setActionLoading(false)
    }
  }

  async function handleDelete() {
    if (!customer || actionLoading) return

    const confirmed = window.confirm(
      'Delete this customer permanently? This cannot be undone.'
    )

    if (!confirmed) return

    setActionLoading(true)
    setMessage('')

    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: 'DELETE'
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to delete customer')
      }

      router.push('/customers')
      router.refresh()
    } catch (error) {
      console.error(error)
      setMessage(
        error instanceof Error ? error.message : 'Failed to delete customer'
      )
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <main
        style={{
          minHeight: '100vh',
          background: '#f5f5f5',
          padding: 16,
          fontFamily: 'sans-serif'
        }}
      >
        <div style={{ maxWidth: 980, margin: '0 auto' }}>
          <div
            style={{
              background: '#fff',
              border: '1px solid #e6e6e6',
              borderRadius: 18,
              padding: 20,
              boxShadow: '0 4px 14px rgba(0,0,0,0.04)'
            }}
          >
            <p style={{ margin: 0 }}>Loading...</p>
          </div>
        </div>
      </main>
    )
  }

  if (!customer) {
    return (
      <main
        style={{
          minHeight: '100vh',
          background: '#f5f5f5',
          padding: 16,
          fontFamily: 'sans-serif'
        }}
      >
        <div style={{ maxWidth: 980, margin: '0 auto' }}>
          <div
            style={{
              background: '#fff',
              border: '1px solid #e6e6e6',
              borderRadius: 18,
              padding: 20,
              boxShadow: '0 4px 14px rgba(0,0,0,0.04)'
            }}
          >
            <p style={{ margin: 0 }}>Customer not found</p>
          </div>
        </div>
      </main>
    )
  }

  const navigationQuery = customer.postcode || customer.address || ''

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f5f5f5',
        padding: 16,
        fontFamily: 'sans-serif'
      }}
    >
      <div
        style={{
          maxWidth: 980,
          margin: '0 auto'
        }}
      >
        <section
          style={{
            background: 'linear-gradient(135deg, #111 0%, #1e1e1e 100%)',
            color: '#fff',
            borderRadius: 20,
            padding: 20,
            marginBottom: 18,
            boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
            border: '1px solid #222'
          }}
        >
          <div style={{ marginBottom: 14 }}>
            <a
              href="/customers"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                textDecoration: 'none',
                color: 'rgba(255,255,255,0.78)',
                fontSize: 14,
                fontWeight: 600
              }}
            >
              ← Back to customers
            </a>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 16,
              flexWrap: 'wrap'
            }}
          >
            <div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  borderRadius: 999,
                  background: 'rgba(255, 204, 0, 0.14)',
                  color: '#ffcc00',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 0.3,
                  marginBottom: 12
                }}
              >
                CUSTOMER PROFILE
              </div>

              <h1
                style={{
                  fontSize: 32,
                  lineHeight: 1.1,
                  margin: '0 0 8px 0'
                }}
              >
                {customer.name}
              </h1>

              <p
                style={{
                  margin: 0,
                  color: 'rgba(255,255,255,0.78)',
                  fontSize: 15
                }}
              >
                Customer since {formatDate(customer.createdAt)}
              </p>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start'
              }}
            >
              <WorkerMenu />
            </div>
          </div>
        </section>

        <section
          style={{
            background: '#fff',
            border: '1px solid #e7e7e7',
            borderRadius: 18,
            padding: 16,
            marginBottom: 18,
            boxShadow: '0 4px 14px rgba(0,0,0,0.04)'
          }}
        >
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {customer.phone && (
              <a
                href={`tel:${customer.phone}`}
                style={{
                  padding: '12px 16px',
                  borderRadius: 12,
                  border: '1px solid #d8d8d8',
                  textDecoration: 'none',
                  color: '#111',
                  fontWeight: 700,
                  background: '#fff'
                }}
              >
                Call Customer
              </a>
            )}

            {customer.email && (
              <a
                href={`mailto:${customer.email}`}
                style={{
                  padding: '12px 16px',
                  borderRadius: 12,
                  border: '1px solid #d8d8d8',
                  textDecoration: 'none',
                  color: '#111',
                  fontWeight: 700,
                  background: '#fff'
                }}
              >
                Email Customer
              </a>
            )}

            {navigationQuery && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(navigationQuery)}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: '12px 16px',
                  borderRadius: 12,
                  border: '1px solid #d8d8d8',
                  textDecoration: 'none',
                  color: '#111',
                  fontWeight: 700,
                  background: '#fff'
                }}
              >
                Navigate
              </a>
            )}

            <a
              href={`/jobs/add?customerId=${customer.id}`}
              style={{
                padding: '12px 16px',
                borderRadius: 12,
                border: '1px solid #111',
                textDecoration: 'none',
                color: '#111',
                fontWeight: 800,
                background: '#ffcc00',
                boxShadow: '0 6px 18px rgba(255, 204, 0, 0.18)'
              }}
            >
              + Add Job
            </a>

            <button
              type="button"
              onClick={handleArchive}
              disabled={actionLoading}
              style={{
                padding: '12px 16px',
                borderRadius: 12,
                border: '1px solid #d4a017',
                background: '#fff4d6',
                color: '#6b4f00',
                fontWeight: 800,
                cursor: actionLoading ? 'default' : 'pointer'
              }}
            >
              {actionLoading ? 'Working...' : 'Archive Customer'}
            </button>

            <button
              type="button"
              onClick={handleDelete}
              disabled={actionLoading}
              style={{
                padding: '12px 16px',
                borderRadius: 12,
                border: '1px solid #dc2626',
                background: '#fff1f2',
                color: '#991b1b',
                fontWeight: 800,
                cursor: actionLoading ? 'default' : 'pointer'
              }}
            >
              {actionLoading ? 'Working...' : 'Delete Customer'}
            </button>
          </div>

          {message && (
            <div
              style={{
                marginTop: 14,
                padding: '12px 14px',
                borderRadius: 12,
                background: '#fff4f4',
                border: '1px solid #f0c9c9',
                color: '#333'
              }}
            >
              {message}
            </div>
          )}
        </section>

        <div
          style={{
            display: 'grid',
            gap: 18,
            marginBottom: 24
          }}
        >
          <section
            style={{
              border: '1px solid #e7e7e7',
              padding: 20,
              borderRadius: 18,
              background: '#fff',
              boxShadow: '0 4px 14px rgba(0,0,0,0.04)'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                alignItems: 'center',
                flexWrap: 'wrap',
                marginBottom: 16
              }}
            >
              <h2 style={{ fontSize: 22, margin: 0 }}>Customer Details</h2>

              {customer.postcode && (
                <div
                  style={{
                    padding: '7px 10px',
                    borderRadius: 999,
                    background: '#fff8d9',
                    border: '1px solid #ffe27a',
                    fontSize: 12,
                    fontWeight: 800,
                    color: '#6a5600'
                  }}
                >
                  {customer.postcode}
                </div>
              )}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 12
              }}
            >
              <div
                style={{
                  background: '#fafafa',
                  border: '1px solid #efefef',
                  borderRadius: 12,
                  padding: 12
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#777',
                    marginBottom: 6,
                    textTransform: 'uppercase',
                    letterSpacing: 0.3
                  }}
                >
                  Phone
                </div>
                <div style={{ fontSize: 15, color: '#222' }}>
                  {customer.phone || 'Not added'}
                </div>
              </div>

              <div
                style={{
                  background: '#fafafa',
                  border: '1px solid #efefef',
                  borderRadius: 12,
                  padding: 12
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#777',
                    marginBottom: 6,
                    textTransform: 'uppercase',
                    letterSpacing: 0.3
                  }}
                >
                  Email
                </div>
                <div
                  style={{
                    fontSize: 15,
                    color: '#222',
                    wordBreak: 'break-word'
                  }}
                >
                  {customer.email || 'Not added'}
                </div>
              </div>

              <div
                style={{
                  background: '#fafafa',
                  border: '1px solid #efefef',
                  borderRadius: 12,
                  padding: 12,
                  gridColumn: '1 / -1'
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#777',
                    marginBottom: 6,
                    textTransform: 'uppercase',
                    letterSpacing: 0.3
                  }}
                >
                  Address
                </div>
                <div
                  style={{
                    fontSize: 15,
                    color: '#222',
                    whiteSpace: 'pre-line'
                  }}
                >
                  {customer.address || 'Not added'}
                </div>
              </div>
            </div>

            {customer.notes && (
              <div
                style={{
                  marginTop: 14,
                  background: '#fffdf4',
                  border: '1px solid #f3e6a8',
                  borderRadius: 12,
                  padding: 12
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#7a6700',
                    marginBottom: 6,
                    textTransform: 'uppercase',
                    letterSpacing: 0.3
                  }}
                >
                  Notes
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: '#3f3a22',
                    whiteSpace: 'pre-line'
                  }}
                >
                  {customer.notes}
                </div>
              </div>
            )}

            {!customer.phone &&
              !customer.email &&
              !customer.address &&
              !customer.postcode &&
              !customer.notes && (
                <p style={{ margin: '12px 0 0 0', color: '#666' }}>
                  No customer details saved yet.
                </p>
              )}
          </section>

          <section
            style={{
              border: '1px solid #e7e7e7',
              borderRadius: 18,
              padding: 20,
              background: '#fff',
              boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
              marginBottom: 24
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                alignItems: 'center',
                flexWrap: 'wrap',
                marginBottom: 16
              }}
            >
              <h2 style={{ fontSize: 22, margin: 0 }}>Jobs</h2>
              <div style={{ fontSize: 14, color: '#666', fontWeight: 700 }}>
                {jobs.length} job{jobs.length === 1 ? '' : 's'}
              </div>
            </div>

            {jobs.length === 0 && <p style={{ margin: 0 }}>No jobs yet for this customer.</p>}

            {jobs.map((job) => (
              <div
                key={job.id}
                style={{
                  border: '1px solid #e6e6e6',
                  padding: 16,
                  borderRadius: 14,
                  marginBottom: 12,
                  background: '#fafafa'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 12,
                    flexWrap: 'wrap',
                    marginBottom: 8
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: 18, color: '#111' }}>{job.title}</h3>

                  <div
                    style={{
                      padding: '6px 10px',
                      borderRadius: 999,
                      background: '#fff',
                      border: '1px solid #ddd',
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#444'
                    }}
                  >
                    {formatStatus(job.status)}
                  </div>
                </div>

                {job.address && (
                  <div
                    style={{
                      background: '#fff',
                      border: '1px solid #ececec',
                      borderRadius: 10,
                      padding: 10,
                      marginTop: 8
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#777',
                        marginBottom: 6,
                        textTransform: 'uppercase',
                        letterSpacing: 0.3
                      }}
                    >
                      Address
                    </div>
                    <div style={{ whiteSpace: 'pre-line', fontSize: 14, color: '#222' }}>
                      {job.address}
                    </div>
                  </div>
                )}

                {job.notes && (
                  <div
                    style={{
                      background: '#fff',
                      border: '1px solid #ececec',
                      borderRadius: 10,
                      padding: 10,
                      marginTop: 8
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#777',
                        marginBottom: 6,
                        textTransform: 'uppercase',
                        letterSpacing: 0.3
                      }}
                    >
                      Notes
                    </div>
                    <div
                      style={{
                        whiteSpace: 'pre-line',
                        fontSize: 14,
                        color: '#444'
                      }}
                    >
                      {job.notes}
                    </div>
                  </div>
                )}

                <div style={{ marginTop: 10, fontSize: 13, color: '#666' }}>
                  Created {formatDate(job.createdAt)}
                </div>
              </div>
            ))}
          </section>
        </div>

        <section
          style={{
            border: '1px solid #e7e7e7',
            borderRadius: 18,
            padding: 20,
            background: '#fff',
            boxShadow: '0 4px 14px rgba(0,0,0,0.04)'
          }}
        >
          <CustomerHistory customerId={customer.id} />
        </section>
      </div>
    </main>
  )
}