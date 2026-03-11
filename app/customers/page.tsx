'use client'

import { useEffect, useState } from 'react'

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

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadCustomers() {
      try {
        const res = await fetch('/api/customers')
        const data = await res.json()
        setCustomers(Array.isArray(data) ? data : [])
      } catch (error) {
        console.error(error)
        setCustomers([])
      } finally {
        setLoading(false)
      }
    }

    loadCustomers()
  }, [])

  return (
    <main style={{ padding: 20, fontFamily: 'sans-serif', maxWidth: 700 }}>
      <h1 style={{ fontSize: 28, marginBottom: 20 }}>Customers</h1>

      <div style={{ marginBottom: 20 }}>
        <a
          href="/customers/add"
          style={{
            display: 'inline-block',
            padding: '12px 16px',
            borderRadius: 8,
            border: '1px solid #ccc',
            textDecoration: 'none',
            color: 'inherit'
          }}
        >
          Add Customer
        </a>
      </div>

      {loading && <p>Loading customers...</p>}

      {!loading && customers.length === 0 && <p>No customers found.</p>}

      {!loading &&
        customers.map((customer) => (
          <div
            key={customer.id}
            style={{
              padding: 16,
              border: '1px solid #ddd',
              borderRadius: 10,
              marginBottom: 12
            }}
          >
            <h2 style={{ margin: '0 0 8px 0', fontSize: 20 }}>{customer.name}</h2>

            {customer.phone && <p style={{ margin: '4px 0' }}>Phone: {customer.phone}</p>}
            {customer.address && <p style={{ margin: '4px 0' }}>Address: {customer.address}</p>}
            {customer.postcode && <p style={{ margin: '4px 0' }}>Postcode: {customer.postcode}</p>}
            {customer.notes && <p style={{ margin: '4px 0' }}>Notes: {customer.notes}</p>}
          </div>
        ))}
    </main>
  )
}