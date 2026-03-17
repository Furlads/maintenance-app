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

  const customersWithPhone = customers.filter((customer) => customer.phone).length
  const customersWithAddress = customers.filter(
    (customer) => customer.address || customer.postcode
  ).length

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
                CUSTOMER DATABASE
              </div>

              <h1
                style={{
                  fontSize: 32,
                  lineHeight: 1.1,
                  margin: '0 0 8px 0'
                }}
              >
                Customers
              </h1>

              <p
                style={{
                  margin: 0,
                  color: 'rgba(255,255,255,0.78)',
                  fontSize: 15,
                  maxWidth: 560
                }}
              >
                View customer records, contact details, addresses and notes in one
                place.
              </p>
            </div>

            <a
              href="/customers/add"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '13px 16px',
                borderRadius: 12,
                textDecoration: 'none',
                background: '#ffcc00',
                color: '#111',
                fontWeight: 800,
                minHeight: 46,
                boxShadow: '0 6px 18px rgba(255, 204, 0, 0.22)'
              }}
            >
              + Add Customer
            </a>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 12,
              marginTop: 18
            }}
          >
            <div
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 14,
                padding: 14
              }}
            >
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>
                Total customers
              </div>
              <div style={{ fontSize: 26, fontWeight: 800 }}>{customers.length}</div>
            </div>

            <div
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 14,
                padding: 14
              }}
            >
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>
                With phone number
              </div>
              <div style={{ fontSize: 26, fontWeight: 800 }}>{customersWithPhone}</div>
            </div>

            <div
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 14,
                padding: 14
              }}
            >
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>
                With address/postcode
              </div>
              <div style={{ fontSize: 26, fontWeight: 800 }}>{customersWithAddress}</div>
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
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: 12,
              alignItems: 'end'
            }}
          >
            <div>
              <label
                htmlFor="customer-search"
                style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#444',
                  marginBottom: 8
                }}
              >
                Search customers
              </label>

              <input
                id="customer-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, phone, email, address, postcode or notes"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: 12,
                  border: '1px solid #d6d6d6',
                  fontSize: 16,
                  boxSizing: 'border-box',
                  background: '#fcfcfc',
                  outline: 'none'
                }}
              />
            </div>

            <div
              style={{
                minWidth: 120,
                textAlign: 'right',
                fontSize: 14,
                fontWeight: 700,
                color: '#555'
              }}
            >
              {!loading && (
                <>
                  {filteredCustomers.length} result
                  {filteredCustomers.length === 1 ? '' : 's'}
                </>
              )}
            </div>
          </div>
        </section>

        {loading && (
          <div
            style={{
              background: '#fff',
              border: '1px solid #e7e7e7',
              borderRadius: 18,
              padding: 20,
              boxShadow: '0 4px 14px rgba(0,0,0,0.04)'
            }}
          >
            Loading customers...
          </div>
        )}

        {!loading && filteredCustomers.length === 0 && (
          <div
            style={{
              background: '#fff',
              border: '1px solid #e7e7e7',
              borderRadius: 18,
              padding: 24,
              textAlign: 'center',
              boxShadow: '0 4px 14px rgba(0,0,0,0.04)'
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                marginBottom: 8,
                color: '#222'
              }}
            >
              {search.trim() ? 'No matching customers found' : 'No customers yet'}
            </div>

            <div style={{ color: '#666', fontSize: 14, marginBottom: 16 }}>
              {search.trim()
                ? 'Try a different search term.'
                : 'Add your first customer to get started.'}
            </div>

            {!search.trim() && (
              <a
                href="/customers/add"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '12px 16px',
                  borderRadius: 12,
                  textDecoration: 'none',
                  background: '#111',
                  color: '#fff',
                  fontWeight: 700
                }}
              >
                Add Customer
              </a>
            )}
          </div>
        )}

        {!loading && filteredCustomers.length > 0 && (
          <div
            style={{
              display: 'grid',
              gap: 14
            }}
          >
            {filteredCustomers.map((customer) => (
              <a
                key={customer.id}
                href={`/customers/${customer.id}`}
                style={{
                  display: 'block',
                  textDecoration: 'none',
                  color: 'inherit',
                  background: '#fff',
                  border: '1px solid #e6e6e6',
                  borderRadius: 18,
                  padding: 18,
                  boxShadow: '0 4px 14px rgba(0,0,0,0.04)'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 12,
                    flexWrap: 'wrap',
                    marginBottom: 14
                  }}
                >
                  <div>
                    <h2
                      style={{
                        margin: '0 0 6px 0',
                        fontSize: 22,
                        lineHeight: 1.15,
                        color: '#111'
                      }}
                    >
                      {customer.name}
                    </h2>

                    <div
                      style={{
                        fontSize: 13,
                        color: '#777'
                      }}
                    >
                      Added {formatDate(customer.createdAt)}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      flexWrap: 'wrap'
                    }}
                  >
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

                    <div
                      style={{
                        padding: '7px 10px',
                        borderRadius: 999,
                        background: '#f4f4f4',
                        border: '1px solid #e3e3e3',
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#555'
                      }}
                    >
                      View customer
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 12,
                    marginBottom: customer.notes ? 14 : 0
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
              </a>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}