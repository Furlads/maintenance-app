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
  const [durationMinutes, setDurationMinutes] = useState('60')

  const [visitPattern, setVisitPattern] = useState('one-off')
  const [maintenanceFrequency, setMaintenanceFrequency] = useState('2')
  const [timePreferenceMode, setTimePreferenceMode] = useState('best-fit')
  const [preferredDay, setPreferredDay] = useState('')
  const [preferredTimeBand, setPreferredTimeBand] = useState('Anytime')

  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')
  const [newCustomerAddress, setNewCustomerAddress] = useState('')
  const [newCustomerPostcode, setNewCustomerPostcode] = useState('')
  const [customerLoading, setCustomerLoading] = useState(false)
  const [customerMessage, setCustomerMessage] = useState('')

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
  const isRegularMaintenance =
    jobType === 'Maintenance' && visitPattern === 'regular-maintenance'
  const useSpecificVisitPreference = timePreferenceMode === 'specific'

  function toggleWorker(workerId: number) {
    setAssignedTo((prev) =>
      prev.includes(workerId)
        ? prev.filter((id) => id !== workerId)
        : [...prev, workerId]
    )
  }

  async function handleAddCustomer() {
    setCustomerLoading(true)
    setCustomerMessage('')

    try {
      const name = newCustomerName.trim()

      if (!name) {
        throw new Error('Customer name is required')
      }

      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          phone: newCustomerPhone,
          address: newCustomerAddress,
          postcode: newCustomerPostcode
        })
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to save customer')
      }

      if (!data || typeof data.id !== 'number') {
        throw new Error('Customer was created but no customer was returned')
      }

      setCustomers((prev) => [data, ...prev])
      setCustomerId(String(data.id))
      setUseDifferentAddress(false)
      setJobAddress('')

      setNewCustomerName('')
      setNewCustomerPhone('')
      setNewCustomerAddress('')
      setNewCustomerPostcode('')
      setShowAddCustomer(false)
      setCustomerMessage('Customer added and selected.')
    } catch (error) {
      console.error(error)
      setCustomerMessage(
        error instanceof Error ? error.message : 'Failed to save customer.'
      )
    } finally {
      setCustomerLoading(false)
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const parsedDuration = Number(durationMinutes)

      if (!Number.isFinite(parsedDuration) || parsedDuration <= 0) {
        throw new Error('Expected time must be greater than 0')
      }

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
          assignedTo,
          durationMinutes: parsedDuration,

          visitPattern,
          isRegularMaintenance,
          maintenanceFrequencyWeeks: isRegularMaintenance
            ? Number(maintenanceFrequency)
            : null,
          timePreferenceMode: isRegularMaintenance ? timePreferenceMode : null,
          preferredDay:
            isRegularMaintenance && useSpecificVisitPreference
              ? preferredDay
              : null,
          preferredTimeBand:
            isRegularMaintenance && useSpecificVisitPreference
              ? preferredTimeBand
              : null
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
      setDurationMinutes('60')
      setVisitPattern('one-off')
      setMaintenanceFrequency('2')
      setTimePreferenceMode('best-fit')
      setPreferredDay('')
      setPreferredTimeBand('Anytime')
      setMessage('Job saved successfully.')
    } catch (error) {
      console.error(error)
      setMessage(
        error instanceof Error ? error.message : 'Failed to save job.'
      )
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
          <button
            type="button"
            onClick={() => {
              setShowAddCustomer((prev) => !prev)
              setCustomerMessage('')
            }}
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              border: '1px solid #ccc',
              background: '#fff',
              cursor: 'pointer'
            }}
          >
            {showAddCustomer ? 'Close New Customer' : 'Add New Customer'}
          </button>
        </div>

        {showAddCustomer && (
          <div
            style={{
              marginBottom: 20,
              padding: 16,
              border: '1px solid #ddd',
              borderRadius: 10
            }}
          >
            <h2 style={{ fontSize: 20, marginTop: 0, marginBottom: 12 }}>
              Add New Customer
            </h2>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6 }}>Name</label>
              <input
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
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
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
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
                value={newCustomerAddress}
                onChange={(e) => setNewCustomerAddress(e.target.value)}
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
              <label style={{ display: 'block', marginBottom: 6 }}>Postcode</label>
              <input
                value={newCustomerPostcode}
                onChange={(e) => setNewCustomerPostcode(e.target.value.toUpperCase())}
                style={{
                  width: '100%',
                  padding: 12,
                  border: '1px solid #ccc',
                  borderRadius: 8
                }}
              />
            </div>

            <button
              type="button"
              onClick={handleAddCustomer}
              disabled={customerLoading}
              style={{
                padding: '12px 16px',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer'
              }}
            >
              {customerLoading ? 'Saving Customer...' : 'Save Customer'}
            </button>

            {customerMessage && <p style={{ marginTop: 12 }}>{customerMessage}</p>}
          </div>
        )}

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
            onChange={(e) => {
              const nextType = e.target.value
              setJobType(nextType)

              if (nextType !== 'Maintenance') {
                setVisitPattern('one-off')
              }
            }}
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

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6 }}>
            Expected Time (minutes)
          </label>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {[30, 45, 60, 90, 120].map((minutes) => (
              <button
                key={minutes}
                type="button"
                onClick={() => setDurationMinutes(String(minutes))}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid #ccc',
                  background: durationMinutes === String(minutes) ? '#eee' : '#fff',
                  cursor: 'pointer'
                }}
              >
                {minutes} mins
              </button>
            ))}
          </div>

          <input
            type="number"
            min="1"
            step="1"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
            required
            style={{
              width: '100%',
              padding: 12,
              border: '1px solid #ccc',
              borderRadius: 8
            }}
          />
        </div>

        {jobType === 'Maintenance' && (
          <div
            style={{
              marginBottom: 16,
              padding: 16,
              border: '1px solid #ddd',
              borderRadius: 10
            }}
          >
            <h2 style={{ fontSize: 20, marginTop: 0, marginBottom: 12 }}>
              Visit Pattern
            </h2>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6 }}>
                Is this a one-off or regular maintenance job?
              </label>
              <select
                value={visitPattern}
                onChange={(e) => setVisitPattern(e.target.value)}
                style={{
                  width: '100%',
                  padding: 12,
                  border: '1px solid #ccc',
                  borderRadius: 8
                }}
              >
                <option value="one-off">One-off job</option>
                <option value="regular-maintenance">Regular maintenance</option>
              </select>
            </div>

            {isRegularMaintenance && (
              <>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 6 }}>
                    How regular does it need to be?
                  </label>
                  <select
                    value={maintenanceFrequency}
                    onChange={(e) => setMaintenanceFrequency(e.target.value)}
                    style={{
                      width: '100%',
                      padding: 12,
                      border: '1px solid #ccc',
                      borderRadius: 8
                    }}
                  >
                    <option value="1">Weekly</option>
                    <option value="2">Fortnightly</option>
                    <option value="4">Every 4 weeks</option>
                    <option value="8">Every 8 weeks</option>
                    <option value="12">Every 12 weeks</option>
                  </select>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 6 }}>
                    Visit preference
                  </label>
                  <select
                    value={timePreferenceMode}
                    onChange={(e) => setTimePreferenceMode(e.target.value)}
                    style={{
                      width: '100%',
                      padding: 12,
                      border: '1px solid #ccc',
                      borderRadius: 8
                    }}
                  >
                    <option value="best-fit">Drop into the diary in the best place</option>
                    <option value="specific">Customer wants a specific day / time</option>
                  </select>
                </div>

                {useSpecificVisitPreference && (
                  <>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: 'block', marginBottom: 6 }}>
                        Preferred day
                      </label>
                      <select
                        value={preferredDay}
                        onChange={(e) => setPreferredDay(e.target.value)}
                        style={{
                          width: '100%',
                          padding: 12,
                          border: '1px solid #ccc',
                          borderRadius: 8
                        }}
                      >
                        <option value="">Select preferred day</option>
                        <option value="Monday">Monday</option>
                        <option value="Tuesday">Tuesday</option>
                        <option value="Wednesday">Wednesday</option>
                        <option value="Thursday">Thursday</option>
                        <option value="Friday">Friday</option>
                      </select>
                    </div>

                    <div style={{ marginBottom: 8 }}>
                      <label style={{ display: 'block', marginBottom: 6 }}>
                        Preferred time of day
                      </label>
                      <select
                        value={preferredTimeBand}
                        onChange={(e) => setPreferredTimeBand(e.target.value)}
                        style={{
                          width: '100%',
                          padding: 12,
                          border: '1px solid #ccc',
                          borderRadius: 8
                        }}
                      >
                        <option value="Morning">Morning</option>
                        <option value="Midday">Midday</option>
                        <option value="Afternoon">Afternoon</option>
                        <option value="Anytime">Anytime</option>
                      </select>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

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