'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

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

export default function CustomerPage() {
  const params = useParams()
  const id = params.id

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadCustomer() {
      try {
        const res = await fetch(`/api/customers/${id}`)
        const data = await res.json()
        setCustomer(data)
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      loadCustomer()
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

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
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
    </main>
  )
}