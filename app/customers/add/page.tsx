'use client'

import { FormEvent, useState } from 'react'

type DuplicateCustomer = {
  id: number
  name: string
  phone: string | null
  email: string | null
  address: string | null
  postcode: string | null
  createdAt: string
}

const fieldLabelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 8,
  fontWeight: 700,
  fontSize: 13,
  color: '#555',
  textTransform: 'uppercase',
  letterSpacing: 0.3,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 48,
  padding: 14,
  borderRadius: 12,
  border: '1px solid #d6d6d6',
  fontSize: 16,
  boxSizing: 'border-box',
  background: '#fcfcfc',
  outline: 'none',
}

const textareaStyle: React.CSSProperties = {
  width: '100%',
  padding: 14,
  borderRadius: 12,
  border: '1px solid #d6d6d6',
  fontSize: 16,
  boxSizing: 'border-box',
  resize: 'vertical',
  background: '#fcfcfc',
  outline: 'none',
}

export default function AddCustomerPage() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [postcode, setPostcode] = useState('')
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [duplicates, setDuplicates] = useState<DuplicateCustomer[]>([])

  async function saveCustomer(forceCreate = false) {
    setLoading(true)
    setMessage('')
    setDuplicates([])

    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          phone,
          email,
          address,
          postcode,
          notes,
          forceCreate,
        }),
      })

      const data = await res.json()

      if (res.status === 409 && data?.requiresConfirmation) {
        const duplicateList = Array.isArray(data.duplicates) ? data.duplicates : []
        setDuplicates(duplicateList)

        const shouldCreateAnyway = window.confirm(
          `This customer may already exist (${duplicateList.length} possible match${
            duplicateList.length === 1 ? '' : 'es'
          }). Are you sure you want to create another one?`
        )

        if (shouldCreateAnyway) {
          return await saveCustomer(true)
        }

        setMessage('Customer was not created because a possible duplicate was found.')
        return
      }

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to save customer')
      }

      setName('')
      setPhone('')
      setEmail('')
      setAddress('')
      setPostcode('')
      setNotes('')
      setDuplicates([])
      setMessage('Customer saved successfully.')
    } catch (error) {
      console.error(error)
      setMessage('Failed to save customer.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    await saveCustomer(false)
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f5f5f5',
        padding: 16,
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: 860,
          margin: '0 auto',
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
            border: '1px solid #222',
          }}
        >
          <div style={{ marginBottom: 12 }}>
            <a
              href="/customers"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                textDecoration: 'none',
                color: 'rgba(255,255,255,0.78)',
                fontSize: 14,
                fontWeight: 600,
                minHeight: 44,
              }}
            >
              ← Back to customers
            </a>
          </div>

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
              marginBottom: 12,
            }}
          >
            NEW CUSTOMER
          </div>

          <h1 style={{ fontSize: 32, margin: '0 0 8px 0', lineHeight: 1.1 }}>
            Add Customer
          </h1>

          <p
            style={{
              margin: 0,
              color: 'rgba(255,255,255,0.78)',
              fontSize: 15,
              maxWidth: 560,
            }}
          >
            Save customer contact details, address and any important notes.
          </p>
        </section>

        <form
          onSubmit={handleSubmit}
          style={{
            border: '1px solid #e7e7e7',
            borderRadius: 18,
            background: '#fff',
            padding: 20,
            boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ marginBottom: 18 }}>
            <label htmlFor="name" style={fieldLabelStyle}>
              Name
            </label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Customer name"
              style={inputStyle}
            />
          </div>

          <div
            className="customer-two-col"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: 16,
              marginBottom: 18,
            }}
          >
            <div>
              <label htmlFor="phone" style={fieldLabelStyle}>
                Phone
              </label>
              <input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone number"
                style={inputStyle}
              />
            </div>

            <div>
              <label htmlFor="email" style={fieldLabelStyle}>
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <label htmlFor="address" style={fieldLabelStyle}>
              Address
            </label>
            <textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={4}
              placeholder="Customer address"
              style={textareaStyle}
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label htmlFor="postcode" style={fieldLabelStyle}>
              Postcode
            </label>
            <input
              id="postcode"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value.toUpperCase())}
              placeholder="Postcode"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label htmlFor="notes" style={fieldLabelStyle}>
              Customer Notes
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Gate codes, access details, preferences, pets, anything useful..."
              style={textareaStyle}
            />
          </div>

          <div
            className="customer-actions"
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'stretch',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="submit"
              disabled={loading}
              style={{
                minHeight: 48,
                padding: '12px 18px',
                borderRadius: 12,
                border: '1px solid #111',
                background: '#ffcc00',
                color: '#111',
                cursor: loading ? 'default' : 'pointer',
                fontWeight: 800,
                minWidth: 140,
                boxShadow: '0 6px 18px rgba(255, 204, 0, 0.18)',
              }}
            >
              {loading ? 'Saving...' : 'Save Customer'}
            </button>

            <a
              href="/customers"
              style={{
                minHeight: 48,
                padding: '12px 18px',
                borderRadius: 12,
                border: '1px solid #d8d8d8',
                textDecoration: 'none',
                color: '#333',
                background: '#fff',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxSizing: 'border-box',
              }}
            >
              Cancel
            </a>
          </div>

          {duplicates.length > 0 && (
            <div
              style={{
                marginTop: 16,
                padding: '12px 14px',
                borderRadius: 12,
                background: '#fff8e7',
                border: '1px solid #f0d48a',
                color: '#333',
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 8 }}>
                Possible duplicate customer found
              </div>

              <div style={{ fontSize: 14, marginBottom: 10 }}>
                Matching records:
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                {duplicates.map((customer) => (
                  <div
                    key={customer.id}
                    style={{
                      background: '#fff',
                      border: '1px solid #ead79a',
                      borderRadius: 10,
                      padding: 10,
                      overflowWrap: 'anywhere',
                    }}
                  >
                    <div style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
                      {customer.name}
                    </div>
                    <div style={{ fontSize: 14, color: '#555', overflowWrap: 'anywhere' }}>
                      {customer.phone || 'No phone'} • {customer.email || 'No email'}
                    </div>
                    <div style={{ fontSize: 14, color: '#555', overflowWrap: 'anywhere' }}>
                      {customer.address || 'No address'}{' '}
                      {customer.postcode ? `• ${customer.postcode}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {message && (
            <div
              style={{
                marginTop: 16,
                padding: '12px 14px',
                borderRadius: 12,
                background: message.includes('successfully') ? '#f3f9f1' : '#fff4f4',
                border: message.includes('successfully')
                  ? '1px solid #cfe7c7'
                  : '1px solid #f0c9c9',
                color: '#333',
              }}
            >
              {message}
            </div>
          )}

          <style jsx>{`
            @media (min-width: 720px) {
              .customer-two-col {
                grid-template-columns: 1fr 1fr !important;
              }
            }

            @media (max-width: 719px) {
              .customer-actions {
                flex-direction: column;
              }

              .customer-actions > * {
                width: 100%;
              }
            }
          `}</style>
        </form>
      </div>
    </main>
  )
}