'use client'

import Link from 'next/link'
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

function SectionCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-zinc-900">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-zinc-500">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  )
}

function FieldLabel({
  children,
  required = false,
}: {
  children: React.ReactNode
  required?: boolean
}) {
  return (
    <label className="mb-2 block text-sm font-semibold text-zinc-800">
      {children}
      {required ? <span className="ml-1 text-red-500">*</span> : null}
    </label>
  )
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
    const titleFromUrl = params.get('title') || ''
    const addressFromUrl = params.get('address') || ''
    const jobTypeFromUrl = params.get('jobType') || ''

    setCustomerId(customerIdFromUrl)

    if (titleFromUrl) setTitle(titleFromUrl)
    if (jobTypeFromUrl) setJobType(jobTypeFromUrl)
    if (addressFromUrl) {
      setUseDifferentAddress(true)
      setJobAddress(addressFromUrl)
    }

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

      if (!customerId) {
        throw new Error('Please select a customer')
      }

      if (!title.trim()) {
        throw new Error('Job title is required')
      }

      if (!finalAddress.trim()) {
        throw new Error('Address is required')
      }

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
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-4xl px-4 py-5 md:px-6">
        <div className="space-y-5">
          <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
            <div className="bg-zinc-900 px-5 py-5 text-white md:px-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.22em] text-yellow-400">
                    Jobs
                  </div>
                  <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">
                    Add Job
                  </h1>
                  <p className="mt-2 text-sm text-zinc-300 md:text-base">
                    Create a new landscaping job, maintenance visit or quote.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/jobs"
                    className="inline-flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700"
                  >
                    Back to Jobs
                  </Link>
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-200 bg-zinc-50 px-5 py-3 text-sm text-zinc-600 md:px-6">
              Add the customer, job details, workers and timing in one place.
            </div>
          </section>

          <form onSubmit={handleSubmit} className="space-y-5">
            <SectionCard
              title="Customer"
              description="Select an existing customer or add a new one."
            >
              <div className="space-y-4">
                <div>
                  <FieldLabel required>Customer</FieldLabel>
                  <select
                    value={customerId}
                    onChange={(e) => {
                      setCustomerId(e.target.value)
                      setUseDifferentAddress(false)
                      setJobAddress('')
                    }}
                    required
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                  >
                    <option value="">Select customer</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddCustomer((prev) => !prev)
                      setCustomerMessage('')
                    }}
                    className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100"
                  >
                    {showAddCustomer ? 'Close New Customer' : 'Add New Customer'}
                  </button>
                </div>

                {showAddCustomer && (
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <div className="mb-4 text-lg font-bold text-zinc-900">
                      Add New Customer
                    </div>

                    <div className="grid gap-4">
                      <div>
                        <FieldLabel required>Name</FieldLabel>
                        <input
                          value={newCustomerName}
                          onChange={(e) => setNewCustomerName(e.target.value)}
                          className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                        />
                      </div>

                      <div>
                        <FieldLabel>Phone</FieldLabel>
                        <input
                          value={newCustomerPhone}
                          onChange={(e) => setNewCustomerPhone(e.target.value)}
                          className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                        />
                      </div>

                      <div>
                        <FieldLabel>Address</FieldLabel>
                        <textarea
                          value={newCustomerAddress}
                          onChange={(e) => setNewCustomerAddress(e.target.value)}
                          rows={3}
                          className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                        />
                      </div>

                      <div>
                        <FieldLabel>Postcode</FieldLabel>
                        <input
                          value={newCustomerPostcode}
                          onChange={(e) => setNewCustomerPostcode(e.target.value.toUpperCase())}
                          className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                        />
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={handleAddCustomer}
                          disabled={customerLoading}
                          className="rounded-xl bg-zinc-900 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {customerLoading ? 'Saving Customer...' : 'Save Customer'}
                        </button>
                      </div>

                      {customerMessage && (
                        <div
                          className={`rounded-xl px-4 py-3 text-sm font-medium ${
                            customerMessage.toLowerCase().includes('selected') ||
                            customerMessage.toLowerCase().includes('saved')
                              ? 'border border-green-200 bg-green-50 text-green-700'
                              : 'border border-red-200 bg-red-50 text-red-700'
                          }`}
                        >
                          {customerMessage}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedCustomer && (
                  <div>
                    <FieldLabel>Customer Address</FieldLabel>
                    <textarea
                      value={defaultCustomerAddress}
                      readOnly
                      rows={3}
                      className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-3 text-sm text-zinc-700"
                    />
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard
              title="Job Details"
              description="Set the work type, expected time and general details."
            >
              <div className="grid gap-4">
                <div>
                  <FieldLabel required>Job Title</FieldLabel>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <FieldLabel>Job Type</FieldLabel>
                    <select
                      value={jobType}
                      onChange={(e) => {
                        const nextType = e.target.value
                        setJobType(nextType)

                        if (nextType !== 'Maintenance') {
                          setVisitPattern('one-off')
                        }
                      }}
                      className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                    >
                      <option value="Quote">Quote</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Landscaping">Landscaping</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <FieldLabel>Status</FieldLabel>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                    >
                      <option value="Scheduled">Scheduled</option>
                      <option value="Quoted">Quoted</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                </div>

                <div>
                  <FieldLabel required>Expected Time (minutes)</FieldLabel>

                  <div className="mb-3 flex flex-wrap gap-2">
                    {[30, 45, 60, 90, 120].map((minutes) => (
                      <button
                        key={minutes}
                        type="button"
                        onClick={() => setDurationMinutes(String(minutes))}
                        className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                          durationMinutes === String(minutes)
                            ? 'border-zinc-900 bg-zinc-900 text-white'
                            : 'border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100'
                        }`}
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
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                  />
                </div>
              </div>
            </SectionCard>

            {jobType === 'Maintenance' && (
              <SectionCard
                title="Maintenance Visit Pattern"
                description="Choose whether this is a one-off maintenance visit or recurring work."
              >
                <div className="grid gap-4">
                  <div>
                    <FieldLabel>Visit Pattern</FieldLabel>
                    <select
                      value={visitPattern}
                      onChange={(e) => setVisitPattern(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                    >
                      <option value="one-off">One-off job</option>
                      <option value="regular-maintenance">Regular maintenance</option>
                    </select>
                  </div>

                  {isRegularMaintenance && (
                    <>
                      <div>
                        <FieldLabel>How regular does it need to be?</FieldLabel>
                        <select
                          value={maintenanceFrequency}
                          onChange={(e) => setMaintenanceFrequency(e.target.value)}
                          className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                        >
                          <option value="1">Weekly</option>
                          <option value="2">Fortnightly</option>
                          <option value="4">Every 4 weeks</option>
                          <option value="8">Every 8 weeks</option>
                          <option value="12">Every 12 weeks</option>
                        </select>
                      </div>

                      <div>
                        <FieldLabel>Visit preference</FieldLabel>
                        <select
                          value={timePreferenceMode}
                          onChange={(e) => setTimePreferenceMode(e.target.value)}
                          className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                        >
                          <option value="best-fit">Drop into the diary in the best place</option>
                          <option value="specific">Customer wants a specific day / time</option>
                        </select>
                      </div>

                      {useSpecificVisitPreference && (
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <FieldLabel>Preferred day</FieldLabel>
                            <select
                              value={preferredDay}
                              onChange={(e) => setPreferredDay(e.target.value)}
                              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                            >
                              <option value="">Select preferred day</option>
                              <option value="Monday">Monday</option>
                              <option value="Tuesday">Tuesday</option>
                              <option value="Wednesday">Wednesday</option>
                              <option value="Thursday">Thursday</option>
                              <option value="Friday">Friday</option>
                            </select>
                          </div>

                          <div>
                            <FieldLabel>Preferred time of day</FieldLabel>
                            <select
                              value={preferredTimeBand}
                              onChange={(e) => setPreferredTimeBand(e.target.value)}
                              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                            >
                              <option value="Morning">Morning</option>
                              <option value="Midday">Midday</option>
                              <option value="Afternoon">Afternoon</option>
                              <option value="Anytime">Anytime</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </SectionCard>
            )}

            <SectionCard
              title="Address"
              description="Use the customer address or set a different job address."
            >
              <div className="space-y-4">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <label className="flex items-start gap-3 text-sm text-zinc-800">
                    <input
                      type="checkbox"
                      checked={useDifferentAddress}
                      onChange={(e) => setUseDifferentAddress(e.target.checked)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block font-semibold">
                        Job is at a different address
                      </span>
                      <span className="mt-1 block text-zinc-500">
                        Tick this if the work is not being done at the customer's main address.
                      </span>
                    </span>
                  </label>
                </div>

                {useDifferentAddress && (
                  <div>
                    <FieldLabel required>Job Address</FieldLabel>
                    <textarea
                      value={jobAddress}
                      onChange={(e) => setJobAddress(e.target.value)}
                      rows={4}
                      required={useDifferentAddress}
                      className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                    />
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard
              title="Assigned Workers"
              description="Choose which workers should be assigned to this job."
            >
              {workers.length === 0 ? (
                <p className="text-sm text-zinc-500">No active workers found.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {workers.map((worker) => {
                    const checked = assignedTo.includes(worker.id)

                    return (
                      <label
                        key={worker.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-4 text-sm transition ${
                          checked
                            ? 'border-zinc-900 bg-zinc-900 text-white'
                            : 'border-zinc-200 bg-white text-zinc-800 hover:border-zinc-300 hover:bg-zinc-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleWorker(worker.id)}
                          className="h-4 w-4"
                        />
                        <span className="font-semibold">
                          {worker.firstName} {worker.lastName}
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Notes"
              description="Internal notes for the office or team."
            >
              <div>
                <FieldLabel>Notes</FieldLabel>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={5}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                />
              </div>
            </SectionCard>

            {message && (
              <div
                className={`rounded-2xl px-4 py-3 text-sm font-medium shadow-sm ${
                  message.toLowerCase().includes('success')
                    ? 'border border-green-200 bg-green-50 text-green-700'
                    : 'border border-red-200 bg-red-50 text-red-700'
                }`}
              >
                {message}
              </div>
            )}

            <div className="sticky bottom-3 z-10">
              <div className="rounded-2xl border border-zinc-200 bg-white/95 p-3 shadow-lg backdrop-blur">
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <Link
                    href="/jobs"
                    className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100"
                  >
                    Cancel
                  </Link>

                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {loading ? 'Saving...' : 'Save Job'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}