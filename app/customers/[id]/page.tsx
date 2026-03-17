'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
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
  const id = params.id

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

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

  if (loading) {
    return (
      <main style={{ padding: 20, fontFamily: 'sans-serif', maxWidth: 900, margin: '0 auto' }}>
        <p>Loading...</p>
      </main>
    )
  }

  if (!customer) {
    return (
      <main style={{ padding: 20, fontFamily: 'sans-serif', maxWidth: 900, margin: '0 auto' }}>
        <p>Customer not found</p>
      </main>
    )
  }

  const navigationQuery = customer.postcode || customer.address || ''

  return (
    <main
      style={{
        padding: 20,
        fontFamily: 'sans-serif',
        maxWidth: 900,
        margin: '0 auto'
      }}
    >
      <div style={{ marginBottom: 14 }}>
        <a
          href="/customers"
          style={{
            display: 'inline-block',
            textDecoration: 'none',
            color: '#444',
            fontSize: 14,
            marginBottom: 12
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
          gap: 12,
          marginBottom: 20,
          flexWrap: 'wrap'
        }}
      >
        <div>
          <h1 style={{ fontSize: 30, margin: '0 0 6px 0' }}>{customer.name}</h1>
          <p style={{ margin: 0, color: '#666', fontSize: 14 }}>
            Customer since {formatDate(customer.createdAt)}
          </p>
        </div>

        <WorkerMenu />
      </div>

      <div
        style={{
          display: 'grid',
          gap: 20,
          marginBottom: 24
        }}
      >
        <section
          style={{
            border: '1px solid #ddd',
            padding: 20,
            borderRadius: 14,
            background: '#fff'
          }}
        >
          <h2 style={{ fontSize: 20, margin: '0 0 16px 0' }}>Customer Details</h2>

          <div style={{ display: 'grid', gap: 12 }}>
            {customer.phone && (
              <div style={{ fontSize: 15 }}>
                <strong>Phone:</strong> {customer.phone}
              </div>
            )}

            {customer.email && (
              <div style={{ fontSize: 15 }}>
                <strong>Email:</strong> {customer.email}
              </div>
            )}

            {customer.address && (
              <div style={{ fontSize: 15, whiteSpace: 'pre-line' }}>
                <strong>Address:</strong> {customer.address}
              </div>
            )}

            {customer.postcode && (
              <div style={{ fontSize: 15 }}>
                <strong>Postcode:</strong> {customer.postcode}
              </div>
            )}

            {customer.notes && (
              <div
                style={{
                  marginTop: 4,
                  padding: 12,
                  borderRadius: 10,
                  background: '#fafafa',
                  border: '1px solid #eee',
                  whiteSpace: 'pre-line',
                  fontSize: 14
                }}
              >
                <strong>Notes:</strong> {customer.notes}
              </div>
            )}

            {!customer.phone &&
              !customer.email &&
              !customer.address &&
              !customer.postcode &&
              !customer.notes && (
                <p style={{ margin: 0, color: '#666' }}>
                  No customer details saved yet.
                </p>
              )}
          </div>
        </section>

        <section
          style={{
            border: '1px solid #ddd',
            padding: 16,
            borderRadius: 14,
            background: '#fff'
          }}
        >
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {customer.phone && (
              <a
                href={`tel:${customer.phone}`}
                style={{
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: '1px solid #ccc',
                  textDecoration: 'none',
                  color: '#111',
                  fontWeight: 600,
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
                  borderRadius: 10,
                  border: '1px solid #ccc',
                  textDecoration: 'none',
                  color: '#111',
                  fontWeight: 600,
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
                  borderRadius: 10,
                  border: '1px solid #ccc',
                  textDecoration: 'none',
                  color: '#111',
                  fontWeight: 600,
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
                borderRadius: 10,
                border: '1px solid #111',
                textDecoration: 'none',
                color: '#fff',
                fontWeight: 600,
                background: '#111'
              }}
            >
              Add Job
            </a>
          </div>
        </section>
      </div>

      <section
        style={{
          border: '1px solid #ddd',
          borderRadius: 14,
          padding: 20,
          background: '#fff',
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
          <div style={{ fontSize: 14, color: '#666' }}>
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
              borderRadius: 12,
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
              <h3 style={{ margin: 0, fontSize: 18 }}>{job.title}</h3>

              <div
                style={{
                  padding: '6px 10px',
                  borderRadius: 999,
                  background: '#fff',
                  border: '1px solid #ddd',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#444'
                }}
              >
                {formatStatus(job.status)}
              </div>
            </div>

            {job.address && (
              <p style={{ margin: '4px 0', whiteSpace: 'pre-line' }}>
                <strong>Address:</strong> {job.address}
              </p>
            )}

            {job.notes && (
              <div
                style={{
                  marginTop: 8,
                  whiteSpace: 'pre-line',
                  fontSize: 14,
                  color: '#444'
                }}
              >
                <strong>Notes:</strong> {job.notes}
              </div>
            )}

            <div style={{ marginTop: 10, fontSize: 13, color: '#666' }}>
              Created {formatDate(job.createdAt)}
            </div>
          </div>
        ))}
      </section>

      <section
        style={{
          border: '1px solid #ddd',
          borderRadius: 14,
          padding: 20,
          background: '#fff'
        }}
      >
        <CustomerHistory customerId={customer.id} />
      </section>
    </main>
  )
}