'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

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

export default function EditCustomerPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [postcode, setPostcode] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    async function loadCustomer() {
      try {
        const res = await fetch(`/api/customers/${id}`, { cache: 'no-store' })
        const data: Customer | { error?: string } = await res.json()

        if (!res.ok || !('id' in data)) {
          throw new Error(
            'error' in data && data.error ? data.error : 'Failed to load customer'
          )
        }

        setName(data.name ?? '')
        setPhone(data.phone ?? '')
        setEmail(data.email ?? '')
        setAddress(data.address ?? '')
        setPostcode(data.postcode ?? '')
        setNotes(data.notes ?? '')
      } catch (error) {
        console.error(error)
        setMessage(
          error instanceof Error ? error.message : 'Failed to load customer'
        )
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      loadCustomer()
    }
  }, [id])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          phone,
          email,
          address,
          postcode,
          notes
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to update customer')
      }

      router.push(`/customers/${id}`)
      router.refresh()
    } catch (error) {
      console.error(error)
      setMessage(
        error instanceof Error ? error.message : 'Failed to update customer'
      )
    } finally {
      setSaving(false)
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
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <div
            style={{
              background: '#fff',
              border: '1px solid #e7e7e7',
              borderRadius: 18,
              padding: 20,
              boxShadow: '0 4px 14px rgba(0,0,0,0.04)'
            }}
          >
            Loading...
          </div>
        </div>
      </main>
    )
  }

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
          maxWidth: 860,
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
          <div style={{ marginBottom: 12 }}>
            <a
              href={`/customers/${id}`}
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
              ← Back to customer
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
              marginBottom: 12
            }}
          >
            EDIT CUSTOMER
          </div>

          <h1 style={{ fontSize: 32, margin: '0 0 8px 0', lineHeight: 1.1 }}>
            Edit Customer
          </h1>

          <p
            style={{
              margin: 0,
              color: 'rgba(255,255,255,0.78)',
              fontSize: 15,
              maxWidth: 560
            }}
          >
            Update customer contact details, address and notes without changing
            their job history.
          </p>
        </section>

        <form
          onSubmit={handleSubmit}
          style={{
            border: '1px solid #e7e7e7',
            borderRadius: 18,
            background: '#fff',
            padding: 20,
            boxShadow: '0 4px 14px rgba(0,0,0,0.04)'
          }}
        >
          <div style={{ marginBottom: 18 }}>
            <label
              htmlFor="name"
              style={{
                display: 'block',
                marginBottom: 8,
                fontWeight: 700,
                fontSize: 13,
                color: '#555',
                textTransform: 'uppercase',
                letterSpacing: 0.3
              }}
            >
              Name
            </label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Customer name"
              style={{
                width: '100%',
                padding: 14,
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
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 16,
              marginBottom: 18
            }}
          >
            <div>
              <label
                htmlFor="phone"
                style={{
                  display: 'block',
                  marginBottom: 8,
                  fontWeight: 700,
                  fontSize: 13,
                  color: '#555',
                  textTransform: 'uppercase',
                  letterSpacing: 0.3
                }}
              >
                Phone
              </label>
              <input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone number"
                style={{
                  width: '100%',
                  padding: 14,
                  borderRadius: 12,
                  border: '1px solid #d6d6d6',
                  fontSize: 16,
                  boxSizing: 'border-box',
                  background: '#fcfcfc',
                  outline: 'none'
                }}
              />
            </div>

            <div>
              <label
                htmlFor="email"
                style={{
                  display: 'block',
                  marginBottom: 8,
                  fontWeight: 700,
                  fontSize: 13,
                  color: '#555',
                  textTransform: 'uppercase',
                  letterSpacing: 0.3
                }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                style={{
                  width: '100%',
                  padding: 14,
                  borderRadius: 12,
                  border: '1px solid #d6d6d6',
                  fontSize: 16,
                  boxSizing: 'border-box',
                  background: '#fcfcfc',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <label
              htmlFor="address"
              style={{
                display: 'block',
                marginBottom: 8,
                fontWeight: 700,
                fontSize: 13,
                color: '#555',
                textTransform: 'uppercase',
                letterSpacing: 0.3
              }}
            >
              Address
            </label>
            <textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={4}
              placeholder="Customer address"
              style={{
                width: '100%',
                padding: 14,
                borderRadius: 12,
                border: '1px solid #d6d6d6',
                fontSize: 16,
                boxSizing: 'border-box',
                resize: 'vertical',
                background: '#fcfcfc',
                outline: 'none'
              }}
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 16,
              marginBottom: 18
            }}
          >
            <div>
              <label
                htmlFor="postcode"
                style={{
                  display: 'block',
                  marginBottom: 8,
                  fontWeight: 700,
                  fontSize: 13,
                  color: '#555',
                  textTransform: 'uppercase',
                  letterSpacing: 0.3
                }}
              >
                Postcode
              </label>
              <input
                id="postcode"
                value={postcode}
                onChange={(e) => setPostcode(e.target.value.toUpperCase())}
                placeholder="Postcode"
                style={{
                  width: '100%',
                  padding: 14,
                  borderRadius: 12,
                  border: '1px solid #d6d6d6',
                  fontSize: 16,
                  boxSizing: 'border-box',
                  background: '#fcfcfc',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <label
              htmlFor="notes"
              style={{
                display: 'block',
                marginBottom: 8,
                fontWeight: 700,
                fontSize: 13,
                color: '#555',
                textTransform: 'uppercase',
                letterSpacing: 0.3
              }}
            >
              Customer Notes
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Gate codes, access details, preferences, pets, anything useful..."
              style={{
                width: '100%',
                padding: 14,
                borderRadius: 12,
                border: '1px solid #d6d6d6',
                fontSize: 16,
                boxSizing: 'border-box',
                resize: 'vertical',
                background: '#fcfcfc',
                outline: 'none'
              }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              flexWrap: 'wrap'
            }}
          >
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '12px 18px',
                borderRadius: 12,
                border: '1px solid #111',
                background: '#ffcc00',
                color: '#111',
                cursor: saving ? 'default' : 'pointer',
                fontWeight: 800,
                minWidth: 140,
                boxShadow: '0 6px 18px rgba(255, 204, 0, 0.18)'
              }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>

            <a
              href={`/customers/${id}`}
              style={{
                padding: '12px 18px',
                borderRadius: 12,
                border: '1px solid #d8d8d8',
                textDecoration: 'none',
                color: '#333',
                background: '#fff',
                fontWeight: 700
              }}
            >
              Cancel
            </a>
          </div>

          {message && (
            <div
              style={{
                marginTop: 16,
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
        </form>
      </div>
    </main>
  )
}