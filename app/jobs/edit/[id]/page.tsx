'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'

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

type JobAssignment = {
  id: number
  workerId: number
}

type Job = {
  id: number
  customerId: number
  title: string
  address: string
  notes: string | null
  status: string
  jobType: string
  visitDate?: string | null
  startTime?: string | null
  durationMinutes?: number | null
  assignments: JobAssignment[]
}

function toDateInputValue(value?: string | null) {
  if (!value) return ''

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return ''

  return date.toISOString().slice(0, 10)
}

export default function EditJobPage() {
  const params = useParams()
  const router = useRouter()
  const id = Number(params.id)

  const [customers, setCustomers] = useState<Customer[]>([])
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [customerId, setCustomerId] = useState('')
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('scheduled')
  const [jobType, setJobType] = useState('Quote')
  const [assignedTo, setAssignedTo] = useState<number[]>([])
  const [useDifferentAddress, setUseDifferentAddress] = useState(false)
  const [jobAddress, setJobAddress] = useState('')
  const [durationMinutes, setDurationMinutes] = useState('60')
  const [visitDate, setVisitDate] = useState('')
  const [startTime, setStartTime] = useState('')

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        setMessage('')

        const [jobRes, customerRes, workerRes] = await Promise.all([
          fetch(`/api/jobs/${id}`, { cache: 'no-store' }),
          fetch('/api/customers', { cache: 'no-store' }),
          fetch('/api/workers', { cache: 'no-store' })
        ])

        if (!jobRes.ok) {
          throw new Error('Failed to load job')
        }

        const jobData: Job = await jobRes.json()
        const customerData = await customerRes.json()
        const workerData = await workerRes.json()

        setCustomers(Array.isArray(customerData) ? customerData : [])
        setWorkers(
          Array.isArray(workerData)
            ? workerData.filter((worker) => worker.active)
            : []
        )

        setCustomerId(String(jobData.customerId))
        setTitle(jobData.title || '')
        setNotes(jobData.notes || '')
        setStatus(jobData.status || 'scheduled')
        setJobType(jobData.jobType || 'Quote')
        setAssignedTo(
          Array.isArray(jobData.assignments)
            ? jobData.assignments.map((assignment) => assignment.workerId)
            : []
        )
        setDurationMinutes(
          jobData.durationMinutes ? String(jobData.durationMinutes) : '60'
        )
        setVisitDate(toDateInputValue(jobData.visitDate))
        setStartTime(jobData.startTime || '')

        const customerList = Array.isArray(customerData) ? customerData : []
        const selectedCustomer =
          customerList.find(
            (customer: Customer) => String(customer.id) === String(jobData.customerId)
          ) || null

        const customerAddress = [
          selectedCustomer?.address || '',
          selectedCustomer?.postcode || ''
        ]
          .filter(Boolean)
          .join('\n')

        if (customerAddress && jobData.address.trim() !== customerAddress.trim()) {
          setUseDifferentAddress(true)
          setJobAddress(jobData.address || '')
        } else {
          setUseDifferentAddress(false)
          setJobAddress('')
        }
      } catch (error) {
        console.error(error)
        setMessage('Failed to load job.')
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      loadData()
    }
  }, [id])

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
    setSaving(true)
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

      const res = await fetch(`/api/jobs/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customerId: Number(customerId),
          title: title.trim(),
          address: finalAddress.trim(),
          notes,
          status,
          jobType,
          assignedTo,
          durationMinutes: parsedDuration,
          visitDate: visitDate || null,
          startTime: startTime || null
        })
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to update job')
      }

      router.push(`/jobs/${id}`)
      router.refresh()
    } catch (error) {
      console.error(error)
      setMessage(
        error instanceof Error ? error.message : 'Failed to update job.'
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-5">
        <p className="text-sm text-zinc-600">Loading job…</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-5">
      <div className="space-y-5">
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.22em] text-zinc-500">
                Jobs
              </div>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-900">
                Edit Job
              </h1>
              <p className="mt-1 text-sm text-zinc-600">
                Update the job details, timing and assigned workers.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href={`/jobs/${id}`}
                className="inline-flex rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-800"
              >
                Cancel
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-800">
                Customer
              </label>
              <select
                value={customerId}
                onChange={(e) => {
                  setCustomerId(e.target.value)
                  setUseDifferentAddress(false)
                  setJobAddress('')
                }}
                required
                className="w-full rounded-xl border border-zinc-300 px-3 py-3 text-sm"
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
              <label className="mb-2 block text-sm font-medium text-zinc-800">
                Job Title
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full rounded-xl border border-zinc-300 px-3 py-3 text-sm"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-800">
                Job Type
              </label>
              <select
                value={jobType}
                onChange={(e) => setJobType(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 px-3 py-3 text-sm"
              >
                <option value="Quote">Quote</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Landscaping">Landscaping</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-800">
                Expected Time (minutes)
              </label>

              <div className="mb-3 flex flex-wrap gap-2">
                {[30, 45, 60, 90, 120].map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => setDurationMinutes(String(minutes))}
                    className={`rounded-xl border px-3 py-2 text-sm ${
                      durationMinutes === String(minutes)
                        ? 'border-zinc-900 bg-zinc-900 text-white'
                        : 'border-zinc-300 bg-white text-zinc-800'
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
                className="w-full rounded-xl border border-zinc-300 px-3 py-3 text-sm"
              />
            </div>

            {selectedCustomer && (
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-800">
                  Customer Address
                </label>
                <textarea
                  value={defaultCustomerAddress}
                  readOnly
                  rows={3}
                  className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-3 text-sm"
                />
              </div>
            )}

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-800">
                <input
                  type="checkbox"
                  checked={useDifferentAddress}
                  onChange={(e) => setUseDifferentAddress(e.target.checked)}
                />
                Job is at a different address
              </label>
            </div>

            {useDifferentAddress && (
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-800">
                  Job Address
                </label>
                <textarea
                  value={jobAddress}
                  onChange={(e) => setJobAddress(e.target.value)}
                  rows={3}
                  required={useDifferentAddress}
                  className="w-full rounded-xl border border-zinc-300 px-3 py-3 text-sm"
                />
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-800">
                  Visit Date
                </label>
                <input
                  type="date"
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 px-3 py-3 text-sm"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-800">
                  Start Time
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 px-3 py-3 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-800">
                Assigned To
              </label>

              {workers.length === 0 && (
                <p className="text-sm text-zinc-500">No active workers found.</p>
              )}

              <div className="space-y-2">
                {workers.map((worker) => (
                  <label
                    key={worker.id}
                    className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-3 text-sm text-zinc-800"
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
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-800">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-zinc-300 px-3 py-3 text-sm"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-800">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 px-3 py-3 text-sm"
              >
                <option value="scheduled">Scheduled</option>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="paused">Paused</option>
                <option value="done">Done</option>
                <option value="quoted">Quoted</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            {message && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {message}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>

              <Link
                href={`/jobs/${id}`}
                className="inline-flex rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-800"
              >
                Cancel
              </Link>
            </div>
          </form>
        </section>
      </div>
    </main>
  )
}
