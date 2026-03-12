'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import CustomerHistory from './CustomerHistory'

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
          fetch(`/api/customers/${id}`),
          fetch('/api/jobs')
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
    return <p style={{ padding: 20 }}>Loading...</p>
  }

  if (!customer) {
    return <p style={{ padding: 20 }}>Customer not found</p>
  }

  const navigationQuery = customer.postcode || customer.address || ''

  return (
    <main style={{ padding: 20, fontFamily: 'sans-serif', maxWidth: 700 }}>
      <h1 style={{ fontSize: 28, marginBottom: 20 }}>{customer.name}</h1>

      <div
        style={{
          border: '1px solid #ddd',
          padding: 20,
          borderRadius: 10,
          marginBottom: 20
        }}
      >
        {customer.phone && (
          <p>
            <strong>Phone:</strong> {customer.phone}
          </p>
        )}

        {customer.address && (
          <p>
            <strong>Address:</strong> {customer.address}
          </p>
        )}

        {customer.postcode && (
          <p>
            <strong>Postcode:</strong> {customer.postcode}
          </p>
        )}

        {customer.notes && (
          <p>
            <strong>Notes:</strong> {customer.notes}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        {customer.phone && (
          <a
            href={`tel:${customer.phone}`}
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

        <a
          href={`/jobs/add?customerId=${customer.id}`}
          style={{
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

      <section>
        <h2 style={{ fontSize: 22, marginBottom: 16 }}>Jobs</h2>

        {jobs.length === 0 && <p>No jobs yet for this customer.</p>}

        {jobs.map((job) => (
          <div
            key={job.id}
            style={{
              border: '1px solid #ddd',
              padding: 16,
              borderRadius: 10,
              marginBottom: 12
            }}
          >
            <h3 style={{ margin: '0 0 8px 0', fontSize: 18 }}>{job.title}</h3>

            {job.address && <p style={{ margin: '4px 0' }}>Address: {job.address}</p>}
            {job.notes && <p style={{ margin: '4px 0' }}>Notes: {job.notes}</p>}
            <p style={{ margin: '4px 0' }}>Status: {job.status}</p>
          </div>
        ))}
      </section>

      <section style={{ marginTop: 30 }}>
        <CustomerHistory customerId={customer.id} />
      </section>
    </main>
  )
}