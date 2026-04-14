'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
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

type WorkerApiItem = {
  id?: number | string
  firstName?: string | null
  lastName?: string | null
  name?: string | null
  active?: boolean | null
}

type JobApiResponse = {
  id: number
  title: string | null
  address: string | null
  notes: string | null
  status: string | null
  jobType: string | null
  visitDate: string | null
  startTime: string | null
  durationMinutes: number | null
  customer?: {
    id?: number
    name?: string | null
    address?: string | null
    postcode?: string | null
  } | null
  assignments?: Array<{
    workerId?: number
    worker?: {
      id?: number
      firstName?: string | null
      lastName?: string | null
      active?: boolean | null
    } | null
  }>
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
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
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

function normaliseWorkers(workerData: unknown): Worker[] {
  const rawWorkers: WorkerApiItem[] = Array.isArray(workerData)
    ? workerData
    : workerData &&
        typeof workerData === 'object' &&
        Array.isArray((workerData as { workers?: WorkerApiItem[] }).workers)
      ? (workerData as { workers: WorkerApiItem[] }).workers
      : []

  return rawWorkers
    .filter((worker): worker is WorkerApiItem => !!worker)
    .map((worker) => {
      const numericId =
        typeof worker.id === 'number'
          ? worker.id
          : typeof worker.id === 'string'
            ? Number(worker.id)
            : NaN

      const fallbackName =
        typeof worker.name === 'string' ? worker.name.trim() : ''

      const fallbackParts = fallbackName ? fallbackName.split(/\s+/) : []

      const firstName =
        typeof worker.firstName === 'string' && worker.firstName.trim()
          ? worker.firstName.trim()
          : fallbackParts[0] || ''

      const lastName =
        typeof worker.lastName === 'string' && worker.lastName.trim()
          ? worker.lastName.trim()
          : fallbackParts.slice(1).join(' ')

      return {
        id: numericId,
        firstName,
        lastName,
        active: typeof worker.active === 'boolean' ? worker.active : true,
      }
    })
    .filter(
      (worker) =>
        Number.isFinite(worker.id) &&
        worker.id > 0 &&
        worker.active &&
        (worker.firstName.trim() || worker.lastName.trim())
    )
}

function fullWorkerName(worker: Worker) {
  return `${worker.firstName} ${worker.lastName}`.trim()
}

function toDateInputValue(value: string | null | undefined) {
  if (!value) return ''

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export default function EditJobPage() {
  const router = useRouter()
  const params = useParams()

  const rawId = params?.id
  const jobId =
    typeof rawId === 'string'
      ? Number(rawId)
      : Array.isArray(rawId)
        ? Number(rawId[0])
        : NaN

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [customers, setCustomers] = useState<Customer[]>([])
  const [workers, setWorkers] = useState<Worker[]>([])

  const [customerId, setCustomerId] = useState('')
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('todo')
  const [jobType, setJobType] = useState('Quote')
  const [assignedWorkerIds, setAssignedWorkerIds] = useState<number[]>([])
  const [useDifferentAddress, setUseDifferentAddress] = useState(false)
  const [jobAddress, setJobAddress] = useState('')
  const [durationMinutes, setDurationMinutes] = useState('60')
  const [visitDate, setVisitDate] = useState('')
  const [startTime, setStartTime] = useState('')

  const selectedCustomer = useMemo(() => {
    return customers.find((customer) => String(customer.id) === customerId) || null
  }, [customers, customerId])

  const defaultCustomerAddress = useMemo(() => {
    if (!selectedCustomer) return ''
    const parts = [selectedCustomer.address, selectedCustomer.postcode].filter(Boolean)
    return parts.join('\n')
  }, [selectedCustomer])

  const finalAddress = useDifferentAddress ? jobAddress : defaultCustomerAddress

  useEffect(() => {
    async function loadData() {
      if (!Number.isFinite(jobId) || jobId <= 0) {
        setMessage('Invalid job id.')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setMessage('')

        const [jobRes, customerRes, workerRes] = await Promise.all([
          fetch(`/api/jobs/${jobId}`, { cache: 'no-store' }),
          fetch('/api/customers', { cache: 'no-store' }),
          fetch('/api/workers', { cache: 'no-store' }),
        ])

        const jobData: JobApiResponse | null = await jobRes.json().catch(() => null)
        const customerData = await customerRes.json().catch(() => [])
        const workerData = await workerRes.json().catch(() => [])

        if (!jobRes.ok || !jobData) {
          throw new Error('Failed to load job')
        }

        const loadedCustomers = Array.isArray(customerData)
          ? customerData
          : customerData &&
              typeof customerData === 'object' &&
              Array.isArray((customerData as { customers?: Customer[] }).customers)
            ? (customerData as { customers: Customer[] }).customers
            : []

        const loadedWorkers = normaliseWorkers(workerData)

        setCustomers(loadedCustomers)
        setWorkers(loadedWorkers)

        const loadedCustomerId =
          typeof jobData.customer?.id === 'number' ? String(jobData.customer.id) : ''

        const customerMatch = loadedCustomers.find(
          (customer) => String(customer.id) === loadedCustomerId
        )

        const customerAddress = customerMatch
          ? [customerMatch.address, customerMatch.postcode].filter(Boolean).join('\n')
          : [jobData.customer?.address, jobData.customer?.postcode].filter(Boolean).join('\n')

        const savedAddress = jobData.address?.trim() || ''
        const sameAsCustomerAddress =
          savedAddress !== '' &&
          customerAddress !== '' &&
          savedAddress === customerAddress

        setCustomerId(loadedCustomerId)
        setTitle(jobData.title?.trim() || '')
        setNotes(jobData.notes || '')
        setStatus(jobData.status || 'todo')
        setJobType(jobData.jobType || 'Quote')
        setDurationMinutes(
          typeof jobData.durationMinutes === 'number' && jobData.durationMinutes > 0
            ? String(jobData.durationMinutes)
            : '60'
        )
        setVisitDate(toDateInputValue(jobData.visitDate))
        setStartTime(jobData.startTime || '')
        setAssignedWorkerIds(
          Array.isArray(jobData.assignments)
            ? jobData.assignments
                .map((assignment) =>
                  typeof assignment.workerId === 'number'
                    ? assignment.workerId
                    : typeof assignment.worker?.id === 'number'
                      ? assignment.worker.id
                      : null
                )
                .filter((id): id is number => id !== null)
            : []
        )

        if (!savedAddress || sameAsCustomerAddress) {
          setUseDifferentAddress(false)
          setJobAddress('')
        } else {
          setUseDifferentAddress(true)
          setJobAddress(savedAddress)
        }
      } catch (error) {
        console.error(error)
        setMessage(error instanceof Error ? error.message : 'Failed to load job.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [jobId])

  function toggleWorker(workerId: number) {
    setAssignedWorkerIds((prev) =>
      prev.includes(workerId)
        ? prev.filter((id) => id !== workerId)
        : [...prev, workerId]
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setMessage('')

    try {
      const parsedDuration = Number(durationMinutes)

      if (!Number.isFinite(jobId) || jobId <= 0) {
        throw new Error('Invalid job id.')
      }

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

      if (assignedWorkerIds.length === 0) {
        throw new Error('Please assign at least one worker')
      }

      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: Number(customerId),
          title: title.trim(),
          address: finalAddress.trim(),
          notes,
          status,
          jobType,
          assignedWorkerIds,
          durationMinutes: parsedDuration,
          visitDate: visitDate || null,
          startTime: startTime || null,
        }),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to update job')
      }

      router.push(`/jobs/${jobId}`)
      router.refresh()
    } catch (error) {
      console.error(error)
      setMessage(error instanceof Error ? error.message : 'Failed to update job.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-50">
        <div className="mx-auto max-w-4xl px-4 py-4 md:px-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-zinc-600">Loading job...</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-4xl px-4 py-4 md:px-6">
        <div className="space-y-4 sm:space-y-5">
          <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
            <div className="bg-zinc-900 px-4 py-5 text-white md:px-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.22em] text-yellow-400">
                    Jobs
                  </div>
                  <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">
                    Edit Job
                  </h1>
                  <p className="mt-2 text-sm text-zinc-300 md:text-base">
                    Update the existing job details, workers and diary information.
                  </p>
                </div>

                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
                  <Link
                    href="/jobs"
                    className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700"
                  >
                    Back to Jobs
                  </Link>
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 md:px-6">
              Edit the current job instead of creating a new one.
            </div>
          </section>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            <SectionCard
              title="Customer"
              description="Choose the customer linked to this job."
            >
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
                  className="min-h-[48px] w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                >
                  <option value="">Select customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>
            </SectionCard>

            <SectionCard
              title="Job Details"
              description="Update the work details and expected time."
            >
              <div className="grid gap-4">
                <div>
                  <FieldLabel required>Job Title</FieldLabel>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="min-h-[48px] w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <FieldLabel>Job Type</FieldLabel>
                    <select
                      value={jobType}
                      onChange={(e) => setJobType(e.target.value)}
                      className="min-h-[48px] w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
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
                      className="min-h-[48px] w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                    >
                      <option value="unscheduled">Unscheduled</option>
                      <option value="todo">To do</option>
                      <option value="in_progress">In progress</option>
                      <option value="paused">Paused</option>
                      <option value="done">Done</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="archived">Archived</option>
                      <option value="quoted">Quoted</option>
                    </select>
                  </div>
                </div>

                <div>
                  <FieldLabel required>Expected Time (minutes)</FieldLabel>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    required
                    className="min-h-[48px] w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                  />
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Scheduling"
              description="Set or change the diary date and start time."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <FieldLabel>Visit Date</FieldLabel>
                  <input
                    type="date"
                    value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
                    className="min-h-[48px] w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                  />
                </div>

                <div>
                  <FieldLabel>Start Time</FieldLabel>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="min-h-[48px] w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                  />
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Address"
              description="Use the customer address or override it with a different job address."
            >
              <div className="space-y-4">
                {!useDifferentAddress && selectedCustomer ? (
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Using customer address
                    </div>
                    <div className="mt-2 whitespace-pre-line text-sm text-zinc-700">
                      {defaultCustomerAddress || 'No saved address'}
                    </div>
                  </div>
                ) : null}

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
                        Tick this if the work is not being done at the customer’s main address.
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
              description="Choose which workers are assigned to this job."
            >
              {workers.length === 0 ? (
                <p className="text-sm text-zinc-500">No active workers found.</p>
              ) : (
                <>
                  <div className="grid gap-3">
                    {workers.map((worker) => {
                      const checked = assignedWorkerIds.includes(worker.id)

                      return (
                        <label
                          key={worker.id}
                          className={`flex min-h-[56px] cursor-pointer items-center gap-3 rounded-2xl border px-4 py-4 text-sm transition sm:min-h-[60px] ${
                            checked
                              ? 'border-zinc-900 bg-zinc-900 text-white'
                              : 'border-zinc-200 bg-white text-zinc-800 hover:border-zinc-300 hover:bg-zinc-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleWorker(worker.id)}
                            className="h-4 w-4 shrink-0"
                          />
                          <span className="font-semibold">{fullWorkerName(worker)}</span>
                        </label>
                      )
                    })}
                  </div>

                  {assignedWorkerIds.length === 0 && (
                    <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                      Please select at least one worker before saving this job.
                    </div>
                  )}
                </>
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
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 shadow-sm">
                {message}
              </div>
            )}

            <div className="sticky bottom-3 z-10">
              <div className="rounded-2xl border border-zinc-200 bg-white/95 p-3 shadow-lg backdrop-blur">
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <Link
                    href={`/jobs/${jobId}`}
                    className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100"
                  >
                    Cancel
                  </Link>

                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-zinc-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
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