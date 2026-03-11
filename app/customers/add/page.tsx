'use client'

import { FormEvent, useState } from 'react'

export default function AddCustomerPage() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
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
          address
        })
      })

      if (!res.ok) {
        throw new Error('Failed to save customer')
      }

      setName('')
      setPhone('')
      setAddress('')
      setMessage('Customer saved successfully.')
    } catch (error) {
      console.error(error)
      setMessage('Failed to save customer.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ padding: 20, fontFamily: 'sans-serif', maxWidth: 500 }}>
      <h1 style={{ fontSize: 28, marginBottom: 20 }}>Add Customer</h1>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6 }}>Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{
              width: '100%',
              padding: 12,
              border: '1px solid #ccc',
              borderRadius: 8
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6 }}>Phone</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{
              width: '100%',
              padding: 12,
              border: '1px solid #ccc',
              borderRadius: 8
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6 }}>Address</label>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={4}
            style={{
              width: '100%',
              padding: 12,
              border: '1px solid #ccc',
              borderRadius: 8
            }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '12px 16px',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer'
          }}
        >
          {loading ? 'Saving...' : 'Save Customer'}
        </button>
      </form>

      {message && (
        <p style={{ marginTop: 16 }}>
          {message}
        </p>
      )}
    </main>
  )
}