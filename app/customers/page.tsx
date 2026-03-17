'use client'

import { useEffect, useMemo, useState } from 'react'

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
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function loadCustomers() {
      try {
        const res = await fetch('/api/customers', { cache: 'no-store' })
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

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase()

    if (!term) return customers

    return customers.filter((customer) => {
      return [
        customer.name,
        customer.phone,
        customer.email,
        customer.address,
        customer.postcode,
        customer.notes
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    })
  }, [customers, search])

  return (
    <main
      style={{
        padding: 20,
        fontFamily: 'sans-serif',
        maxWidth: 860,
        margin: '0 auto'
      }}
    >
      <div
        style={{
          marginBottom: 20,
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12
        }}
      >
        <div>
          <h1 style={{ fontSize: 30, margin: '0 0 6px 0' }}>Customers</h1>
          <p style={{ margin: 0, color: '#666', fontSize: 15 }}>
            View customer details, contact info, notes and job history.
          </p>
        </div>

        <a
          href="/customers/add"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '12px 16px',
            borderRadius: 10,
            border: '1px solid #111',
            textDecoration: 'none',
            color: '#111',
            fontWeight: 600,
            background: '#fff',
            minHeight: 44
          }}
        >
          Add Customer
        </a>
      </div>

      <div
        style={{
          marginBottom: 20,
          border: '1px solid #ddd',
          borderRadius: 12,
          background: '#fff',
          padding: 14
        }}
      >
        <label
          htmlFor="customer-search"
          style={{
            display: 'block',
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 8,
            color: '#444'
          }}
        >
          Search customers
        </label>

        <input
          id="customer-search"
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone, address, postcode or notes"
          style={{
            width: '100%',
            padding: '12px 14px',
            borderRadius: 10,
            border: '1px solid #ccc',
            fontSize: 16,
            outline: 'none',
            boxSizing: 'border-box'
          }}
        />
      </div>

      <div style={{ marginBottom: 16, color: '#555', fontSize: 14 }}>
        {!loading && (
          <>
            {filteredCustomers.length} customer
            {filteredCustomers.length === 1 ? '' : 's'} shown
          </>
        )}
      </div>

      {loading && (
        <div
          style={{
            border: '1px solid #ddd',
            borderRadius: 12,
            padding: 16,
            background: '#fff'
          }}
        >
          Loading customers...
        </div>
      )}

      {!loading && filteredCustomers.length === 0 && (
        <div
          style={{
            border: '1px solid #ddd',
            borderRadius: 12,
            padding: 18,
            background: '#fff'
          }}
        >
          {search.trim() ? 'No matching customers found.' : 'No customers found.'}
        </div>
      )}

      {!loading &&
        filteredCustomers.map((customer) => (
          <a
            key={customer.id}
            href={`/customers/${customer.id}`}
            style={{
              display: 'block',
              padding: 18,
              border: '1px solid #ddd',
              borderRadius: 14,
              marginBottom: 14,
              textDecoration: 'none',
              color: 'inherit',
              background: '#fff',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 12,
                flexWrap: 'wrap',
                marginBottom: 10
              }}
            >
              <h2 style={{ margin: 0, fontSize: 22, lineHeight: 1.2 }}>
                {customer.name}
              </h2>

              {customer.postcode && (
                <div
                  style={{
                    padding: '6px 10px',
                    borderRadius: 999,
                    background: '#f4f4f4',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#444'
                  }}
                >
                  {customer.postcode}
                </div>
              )}
            </div>

            <div
              style={{
                display: 'grid',
                gap: 8
              }}
            >
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

              {customer.notes && (
                <div
                  style={{
                    fontSize: 14,
                    color: '#555',
                    background: '#fafafa',
                    border: '1px solid #eee',
                    borderRadius: 10,
                    padding: 10,
                    whiteSpace: 'pre-line'
                  }}
                >
                  <strong style={{ color: '#333' }}>Notes:</strong> {customer.notes}
                </div>
              )}
            </div>
          </a>
        ))}
    </main>
  )
}