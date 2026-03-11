'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'

type Customer = {
  id: number
  name: string
  address: string | null
  postcode: string | null
}

type Worker = {
  id: number
  firstName: string
  lastName: string
  active: boolean
}

export default function AddJobPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [workers, setWorkers] = useState<Worker[]>([])
  const [customerId, setCustomerId] = useState('')
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('Scheduled')
  const [jobType, setJobType] = useState('Quote')
  const [assignedTo, setAssignedTo] = useState<number[]>([])
  const [useDifferentAddress, setUseDifferentAddress] = useState(false)
  const [jobAddress, setJobAddress] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const customerIdFromUrl = params.get('customerId') || ''
    setCustomerId(customerIdFromUrl)

    async function loadData() {
      try {
        const [customerRes, workerRes] = await Promise.all([
          fetch('/api/customers'),
          fetch('/api/workers')
        ])

        const customerData = await customerRes.json()
        const workerData = await workerRes.json()

        setCustomers(Array.isArray(customerData) ? customerData : [])
        setWorkers(
          Array.isArray(workerData)
            ? workerData.filter((worker) => worker.active)
            : []
        )
      } catch (error) {
        console.error(error)
        setCustomers([])
        setWorkers([])
      }
    }

    loadData()
  }, [])

  const selectedCustomer = useMemo(() => {
    return customers.find((customer) => String(customer.id) === customerId) || null
  }, [customers, customerId])

  const defaultCustomerAddress = useMemo(() => {
    if (!selectedCustomer) return ''

    const parts = [selectedCustomer.address, selectedCustomer.postcode].filter(Boolean)
    return parts.join('\n')
  }, [selectedCustomer])

  const finalAddress = useDifferentAddress ? jobAddress : defaultCustomerAddress

  function toggleWorker(workerId: number) {
    setAssignedTo((prev) =>
      prev.includes(workerId)
        ? prev.filter((id) => id !== workerId)
        : [...prev, workerId]
    )
  }

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
          address: finalAddress,
          notes,
          status,
          jobType,
          assignedTo
        })
      })

      if (!res.ok) {
        throw new Error('Failed to save job')
      }

      setTitle('')
      setNotes('')
      setStatus('Scheduled')
      setJobType('Quote')
      setUseDifferentAddress(false)
      setJobAddress('')
      setAssignedTo([])
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
            onChange={(e) => {
              setCustomerId(e.target.value)
              setUseDifferentAddress(false)
              setJobAddress('')
            }}
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
          <label style={{ display: 'block', marginBottom: 6 }}>Job Type</label>
          <select
            value={jobType}
            onChange={(e) => setJobType(e.target.value)}
            style={{
              width: '100%',
              padding: 12,
              border: '1px solid #ccc',
              borderRadius: 8
            }}
          >
            <option value="Quote">Quote</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Landscaping">Landscaping</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {selectedCustomer && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6 }}>Customer Address</label>
            <textarea
              value={defaultCustomerAddress}
              readOnly
              rows={3}
              style={{
                width: '100%',
                padding: 12,
                border: '1px solid #ccc',
                borderRadius: 8,
                backgroundColor: '#f7f7f7'
              }}
            />
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={useDifferentAddress}
              onChange={(e) => setUseDifferentAddress(e.target.checked)}
            />
            Job is at a different address
          </label>
        </div>

        {useDifferentAddress && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6 }}>Job Address</label>
            <textarea
              value={jobAddress}
              onChange={(e) => setJobAddress(e.target.value)}
              rows={3}
              required={useDifferentAddress}
              style={{
                width: '100%',
                padding: 12,
                border: '1px solid #ccc',
                borderRadius: 8
              }}
            />
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 10 }}>Assigned To</label>

          {workers.length === 0 && (
            <p style={{ margin: 0 }}>No active workers found.</p>
          )}

          {workers.map((worker) => (
            <label
              key={worker.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 8
              }}
            >
              <input
                type="checkbox"
                checked={assignedTo.includes(worker.id)}
                onChange={() => toggleWorker(worker.id)}
              />
              {worker.firstName} {worker.lastName}
            </label>
          ))}
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