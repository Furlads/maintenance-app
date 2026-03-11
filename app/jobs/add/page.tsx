'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type Customer = {
  id: number
  name: string
}

export default function AddJobPage() {
  const searchParams = useSearchParams()
  const customerIdFromUrl = searchParams.get('customerId') || ''

  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerId, setCustomerId] = useState(customerIdFromUrl)
  const [title, setTitle] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('Scheduled')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function loadCustomers() {
      try {
        const res = await fetch('/api/customers')
        const data = await res.json()
        setCustomers(Array.isArray(data) ? data : [])
      } catch (error) {
        console.error(error)
        setCustomers([])
      }
    }

    loadCustomers()
  }, [])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customerId: Number(customerId),
          title,
          address,
          notes,
          status
        })
      })

      if (!res.ok) {
        throw new Error('Failed to save job')
      }

      setTitle('')
      setAddress('')
      setNotes('')
      setStatus('Scheduled')
      setMessage('Job saved successfully.')
    } catch (error) {
      console.error(error)
      setMessage('Failed to save job.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ padding: 20, fontFamily: 'sans-serif', maxWidth: 600 }}>
      <h1 style={{ fontSize: 28, marginBottom: 20 }}>Add Job</h1>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6 }}>Customer</label>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            required
            style={{
              width: '100%',
              padding: 12,
              border: '1px solid #ccc',
              borderRadius: 8
            }}
          >
            <option value="">Select customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6 }}>Job Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
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
          <label style={{ display: 'block', marginBottom: 6 }}>Address</label>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={3}
            style={{
              width: '100%',
              padding: 12,
              border: '1px solid #ccc',
              borderRadius: 8
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6 }}>Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            style={{
              width: '100%',
              padding: 12,
              border: '1px solid #ccc',
              borderRadius: 8
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6 }}>Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{
              width: '100%',
              padding: 12,
              border: '1px solid #ccc',
              borderRadius: 8
            }}
          >
            <option value="Scheduled">Scheduled</option>
            <option value="Quoted">Quoted</option>
            <option value="Completed">Completed</option>
          </select>
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
          {loading ? 'Saving...' : 'Save Job'}
        </button>
      </form>

      {message && <p style={{ marginTop: 16 }}>{message}</p>}
    </main>
  )
}