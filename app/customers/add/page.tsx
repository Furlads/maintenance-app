'use client'

import { FormEvent, useState } from 'react'

export default function AddCustomerPage() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [postcode, setPostcode] = useState('')
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
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

      if (!res.ok) {
        throw new Error('Failed to save customer')
      }

      setName('')
      setPhone('')
      setEmail('')
      setAddress('')
      setPostcode('')
      setNotes('')
      setMessage('Customer saved successfully.')
    } catch (error) {
      console.error(error)
      setMessage('Failed to save customer.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main
      style={{
        padding: 20,
        fontFamily: 'sans-serif',
        maxWidth: 720,
        margin: '0 auto'
      }}
    >
      <div style={{ marginBottom: 20 }}>
        <a
          href="/customers"
          style={{
            display: 'inline-block',
            marginBottom: 12,
            textDecoration: 'none',
            color: '#444',
            fontSize: 14
          }}
        >
          ← Back to customers
        </a>

        <h1 style={{ fontSize: 30, margin: '0 0 6px 0' }}>Add Customer</h1>
        <p style={{ margin: 0, color: '#666', fontSize: 15 }}>
          Save customer contact details, address and any important notes.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          border: '1px solid #ddd',
          borderRadius: 14,
          background: '#fff',
          padding: 18
        }}
      >
        <div style={{ marginBottom: 18 }}>
          <label
            htmlFor="name"
            style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}
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
              padding: 12,
              borderRadius: 10,
              border: '1px solid #ccc',
              fontSize: 16,
              boxSizing: 'border-box'
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
              style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}
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
                padding: 12,
                borderRadius: 10,
                border: '1px solid #ccc',
                fontSize: 16,
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label
              htmlFor="email"
              style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}
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
                padding: 12,
                borderRadius: 10,
                border: '1px solid #ccc',
                fontSize: 16,
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label
            htmlFor="address"
            style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}
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
              padding: 12,
              borderRadius: 10,
              border: '1px solid #ccc',
              fontSize: 16,
              boxSizing: 'border-box',
              resize: 'vertical'
            }}
          />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label
            htmlFor="postcode"
            style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}
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
              padding: 12,
              borderRadius: 10,
              border: '1px solid #ccc',
              fontSize: 16,
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label
            htmlFor="notes"
            style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}
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
              padding: 12,
              borderRadius: 10,
              border: '1px solid #ccc',
              fontSize: 16,
              boxSizing: 'border-box',
              resize: 'vertical'
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
            disabled={loading}
            style={{
              padding: '12px 18px',
              borderRadius: 10,
              border: '1px solid #111',
              background: '#111',
              color: '#fff',
              cursor: loading ? 'default' : 'pointer',
              fontWeight: 600,
              minWidth: 140
            }}
          >
            {loading ? 'Saving...' : 'Save Customer'}
          </button>

          <a
            href="/customers"
            style={{
              padding: '12px 18px',
              borderRadius: 10,
              border: '1px solid #ccc',
              textDecoration: 'none',
              color: '#333',
              background: '#fff',
              fontWeight: 600
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
              borderRadius: 10,
              background: message.includes('successfully') ? '#f3f9f1' : '#fff4f4',
              border: message.includes('successfully')
                ? '1px solid #cfe7c7'
                : '1px solid #f0c9c9',
              color: '#333'
            }}
          >
            {message}
          </div>
        )}
      </form>
    </main>
  )
}