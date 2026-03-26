'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
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

type SavedJobResponse = {
  id?: number
  title?: string
  address?: string | null
  status?: string | null
  jobType?: string | null
  visitDate?: string | null
  startTime?: string | null
  durationMinutes?: number | null
  customer?: {
    id?: number
    name?: string | null
    postcode?: string | null
  } | null
  assignments?: Array<{
    worker?: {
      id?: number
      firstName?: string | null
      lastName?: string | null
    } | null
  }>
}

type SaveSummary = {
  title: string
  customerName: string
  assignedWorkerNames: string[]
  durationMinutes: number
  scheduled: boolean
  visitDate: string | null
  startTime: string | null
  locationLabel: string
}

type MaintenanceFrequencyValue =
  | 'weekly'
  | 'fortnightly'
  | 'every_3_weeks'
  | 'monthly'

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

function isTrevWorker(worker: Worker) {
  const first = worker.firstName.trim().toLowerCase()
  const last = worker.lastName.trim().toLowerCase()

  const firstMatches = first === 'trevor' || first === 'trev'
  const lastMatches = last.includes('fudger')

  return firstMatches && lastMatches
}

function fullWorkerName(worker: Worker) {
  return `${worker.firstName} ${worker.lastName}`.trim()
}

function formatDateForDisplay(value: string | null) {
  if (!value) return 'No date'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function formatDurationLabel(minutes: number) {
  if (minutes === 390) return 'Full day'
  if (minutes < 60) return `${minutes} mins`

  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (mins === 0) {
    return `${hours} hour${hours === 1 ? '' : 's'}`
  }

  return `${hours}h ${mins}m`
}

function getMaintenanceFrequencyWeeks(value: MaintenanceFrequencyValue) {
  if (value === 'weekly') return 1
  if (value === 'fortnightly') return 2
  if (value === 'every_3_weeks') return 3
  if (value === 'monthly') return null
  return null
}

function SaveConfirmationModal({
  summary,
  onClearForm,
  onGoToJobs,
}: {
  summary: SaveSummary
  onClearForm: () => void
  onGoToJobs: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 px-4 py-6">
      <div className="w-full max-w-xl rounded-3xl border border-zinc-200 bg-white shadow-2xl">
        <div className="border-b border-zinc-200 px-5 py-5 sm:px-6">
          <div className="text-xs font-black uppercase tracking-[0.22em] text-yellow-500">
            Job Saved
          </div>
          <h2 className="mt-1 text-2xl font-bold text-zinc-900">
            {summary.scheduled ? 'Job scheduled into the diary' : 'Job saved into Unscheduled'}
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            Check the details below, then either clear the form for the next job or go back to Jobs.
          </p>
        </div>

        <div className="space-y-4 px-5 py-5 sm:px-6">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="break-words text-sm font-bold text-zinc-900">{summary.customerName}</div>
            <div className="mt-1 break-words text-sm text-zinc-700">{summary.title}</div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Status
              </div>
              <div className="mt-2 text-sm font-bold text-zinc-900">
                {summary.scheduled ? 'Scheduled' : 'Unscheduled'}
              </div>
              <div className="mt-1 break-words text-sm text-zinc-600">{summary.locationLabel}</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Expected time
              </div>
              <div className="mt-2 text-sm font-bold text-zinc-900">
                {formatDurationLabel(summary.durationMinutes)}
              </div>
              <div className="mt-1 text-sm text-zinc-600">{summary.durationMinutes} minutes</div>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Assigned workers
            </div>
            <div className="mt-2 break-words text-sm font-bold text-zinc-900">
              {summary.assignedWorkerNames.length > 0
                ? summary.assignedWorkerNames.join(', ')
                : 'No workers assigned'}
            </div>
          </div>

          {summary.scheduled ? (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
              <div className="font-bold text-green-900">Placed into the diary</div>
              <div className="mt-1">
                {formatDateForDisplay(summary.visitDate)}
                {summary.startTime ? ` at ${summary.startTime}` : ''}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <div className="font-bold text-amber-900">Waiting to be scheduled</div>
              <div className="mt-1">
                This job has been saved into the unscheduled queue for Kelly to place later.
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-zinc-200 px-5 py-5 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={onClearForm}
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100"
          >
            Confirm and clear form
          </button>
          <button
            type="button"
            onClick={onGoToJobs}
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-zinc-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-black"
          >
            Confirm and go to Jobs
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AddJobPage() {
  const router = useRouter()

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

  const [visitDate, setVisitDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [allowQuoteTimeOverride, setAllowQuoteTimeOverride] = useState(false)

  const [visitPattern, setVisitPattern] = useState('one-off')
  const [maintenanceFrequency, setMaintenanceFrequency] =
    useState<MaintenanceFrequencyValue>('fortnightly')
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
  const [saveSummary, setSaveSummary] = useState<SaveSummary | null>(null)

  const durationOptions = useMemo(() => {
    if (jobType === 'Maintenance') {
      return [30, 45, 60, 90, 120, 180, 240, 300, 390]
    }

    return [30, 45, 60, 90, 120]
  }, [jobType])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const customerIdFromUrl = params.get('customerId') || ''
    const titleFromUrl = params.get('title') || ''
    const addressFromUrl = params.get('address') || ''
    const jobTypeFromUrl = params.get('jobType') || ''
    const visitDateFromUrl = params.get('visitDate') || ''
    const startTimeFromUrl = params.get('startTime') || ''

    setCustomerId(customerIdFromUrl)

    if (titleFromUrl) setTitle(titleFromUrl)
    if (jobTypeFromUrl) setJobType(jobTypeFromUrl)
    if (visitDateFromUrl) setVisitDate(visitDateFromUrl)
    if (startTimeFromUrl) setStartTime(startTimeFromUrl)

    if (addressFromUrl) {
      setUseDifferentAddress(true)
      setJobAddress(addressFromUrl)
    }

    async function loadData() {
      try {
        const [customerRes, workerRes] = await Promise.all([
          fetch('/api/customers'),
          fetch('/api/workers'),
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

  const selectedWorkers = useMemo(() => {
    return workers.filter((worker) => assignedTo.includes(worker.id))
  }, [workers, assignedTo])

  const trevAssigned = useMemo(() => {
    return selectedWorkers.some((worker) => isTrevWorker(worker))
  }, [selectedWorkers])

  const isTrevQuoteJob = jobType === 'Quote' && trevAssigned

  const finalAddress = useDifferentAddress ? jobAddress : defaultCustomerAddress
  const isRegularMaintenance =
    jobType === 'Maintenance' && visitPattern === 'regular-maintenance'
  const useSpecificVisitPreference = timePreferenceMode === 'specific'

  useEffect(() => {
    if (!isTrevQuoteJob) {
      setAllowQuoteTimeOverride(false)
    }
  }, [isTrevQuoteJob])

  useEffect(() => {
    if (isTrevQuoteJob && !allowQuoteTimeOverride) {
      setStartTime('')
    }
  }, [isTrevQuoteJob, allowQuoteTimeOverride])

  function resetForm() {
    setTitle('')
    setNotes('')
    setStatus('Scheduled')
    setJobType('Quote')
    setUseDifferentAddress(false)
    setJobAddress('')
    setAssignedTo([])
    setDurationMinutes('60')
    setVisitDate('')
    setStartTime('')
    setAllowQuoteTimeOverride(false)
    setVisitPattern('one-off')
    setMaintenanceFrequency('fortnightly')
    setTimePreferenceMode('best-fit')
    setPreferredDay('')
    setPreferredTimeBand('Anytime')
    setMessage('')
    setSaveSummary(null)
  }

  function buildSaveSummary(
    responseData: SavedJobResponse | null,
    parsedDuration: number
  ): SaveSummary {
    const responseAssignments = Array.isArray(responseData?.assignments)
      ? responseData?.assignments ?? []
      : []

    const responseWorkerNames = responseAssignments
      .map((assignment) => {
        const first = assignment.worker?.firstName?.trim() || ''
        const last = assignment.worker?.lastName?.trim() || ''
        return `${first} ${last}`.trim()
      })
      .filter(Boolean)

    const fallbackWorkerNames = selectedWorkers.map(fullWorkerName)

    const assignedWorkerNames =
      responseWorkerNames.length > 0 ? responseWorkerNames : fallbackWorkerNames

    const scheduledVisitDate = responseData?.visitDate ?? (visitDate || null)
    const scheduledStartTime =
      responseData?.startTime ??
      (isTrevQuoteJob && !allowQuoteTimeOverride ? null : startTime || null)

    const scheduled = Boolean(scheduledVisitDate || scheduledStartTime)

    const customerName =
      responseData?.customer?.name?.trim() ||
      selectedCustomer?.name ||
      'Customer'

    let locationLabel = 'Saved into Unscheduled'

    if (scheduled) {
      const dateLabel = scheduledVisitDate
        ? formatDateForDisplay(scheduledVisitDate)
        : 'Scheduled date'
      const timeLabel = scheduledStartTime ? ` at ${scheduledStartTime}` : ''
      locationLabel = `${dateLabel}${timeLabel}`
    }

    return {
      title: responseData?.title?.trim() || title.trim(),
      customerName,
      assignedWorkerNames,
      durationMinutes:
        typeof responseData?.durationMinutes === 'number' &&
        responseData.durationMinutes > 0
          ? responseData.durationMinutes
          : parsedDuration,
      scheduled,
      visitDate: scheduledVisitDate,
      startTime: scheduledStartTime,
      locationLabel,
    }
  }

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
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          phone: newCustomerPhone,
          address: newCustomerAddress,
          postcode: newCustomerPostcode,
        }),
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

      if (assignedTo.length === 0) {
        throw new Error('Please assign at least one worker')
      }

      if (isTrevQuoteJob && !visitDate) {
        throw new Error('Trev quote visits must have a visit date')
      }

      if (isTrevQuoteJob && allowQuoteTimeOverride && !startTime) {
        throw new Error('Please choose a manual time override for this Trev quote visit')
      }

      const maintenanceFrequencyWeeks = isRegularMaintenance
        ? getMaintenanceFrequencyWeeks(maintenanceFrequency)
        : null

      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
          visitDate: visitDate || null,
          startTime:
            isTrevQuoteJob && !allowQuoteTimeOverride
              ? null
              : startTime || null,
          allowQuoteTimeOverride: isTrevQuoteJob ? allowQuoteTimeOverride : false,

          visitPattern,
          isRegularMaintenance,
          maintenanceFrequency: isRegularMaintenance ? maintenanceFrequency : null,
          maintenanceFrequencyUnit: isRegularMaintenance
            ? maintenanceFrequency === 'monthly'
              ? 'monthly'
              : 'weeks'
            : null,
          maintenanceFrequencyWeeks,
          timePreferenceMode: isRegularMaintenance ? timePreferenceMode : null,
          preferredDay:
            isRegularMaintenance && useSpecificVisitPreference
              ? preferredDay
              : null,
          preferredTimeBand:
            isRegularMaintenance && useSpecificVisitPreference
              ? preferredTimeBand
              : null,
        }),
      })

      const data: SavedJobResponse | null = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data && 'error' in data ? String((data as any).error) : 'Failed to save job')
      }

      const summary = buildSaveSummary(data, parsedDuration)
      setSaveSummary(summary)
      setMessage('')
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
                    Add Job
                  </h1>
                  <p className="mt-2 text-sm text-zinc-300 md:text-base">
                    Create a new landscaping job, maintenance visit or quote.
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
              Add the customer, job details, workers and timing in one place.
            </div>
          </section>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
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

                {selectedCustomer ? (
                  <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-green-700">
                      Selected customer
                    </div>
                    <div className="mt-2 font-bold text-zinc-900">{selectedCustomer.name}</div>
                    <div className="mt-1 whitespace-pre-line text-sm text-zinc-700">
                      {defaultCustomerAddress || 'No saved address'}
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddCustomer((prev) => !prev)
                      setCustomerMessage('')
                    }}
                    className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100"
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
                          className="min-h-[48px] w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                        />
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <FieldLabel>Phone</FieldLabel>
                          <input
                            value={newCustomerPhone}
                            onChange={(e) => setNewCustomerPhone(e.target.value)}
                            className="min-h-[48px] w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                          />
                        </div>

                        <div>
                          <FieldLabel>Postcode</FieldLabel>
                          <input
                            value={newCustomerPostcode}
                            onChange={(e) => setNewCustomerPostcode(e.target.value.toUpperCase())}
                            className="min-h-[48px] w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                          />
                        </div>
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

                      <div className="flex flex-col gap-3 sm:flex-row">
                        <button
                          type="button"
                          onClick={handleAddCustomer}
                          disabled={customerLoading}
                          className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-zinc-900 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-70"
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

                {!selectedCustomer && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    Pick a customer first so the address and job setup flow can auto-fill properly.
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
                    className="min-h-[48px] w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
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

                        if (nextType !== 'Quote') {
                          setAllowQuoteTimeOverride(false)
                        }

                        if (nextType !== 'Maintenance' && durationMinutes === '390') {
                          setDurationMinutes('60')
                        }
                      }}
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
                      <option value="Scheduled">Scheduled</option>
                      <option value="Quoted">Quoted</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                </div>

                <div>
                  <FieldLabel required>Expected Time (minutes)</FieldLabel>

                  <div className="mb-3 flex flex-wrap gap-2">
                    {durationOptions.map((minutes) => (
                      <button
                        key={minutes}
                        type="button"
                        onClick={() => setDurationMinutes(String(minutes))}
                        className={`min-h-[44px] rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                          durationMinutes === String(minutes)
                            ? 'border-zinc-900 bg-zinc-900 text-white'
                            : 'border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100'
                        }`}
                      >
                        {minutes === 390 ? 'Full day' : `${minutes} mins`}
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
                    className="min-h-[48px] w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                  />

                  {jobType === 'Maintenance' && (
                    <p className="mt-2 text-sm text-zinc-500">
                      Maintenance can now be short visits or longer blocks, including full-day work.
                    </p>
                  )}
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Scheduling"
              description="Set a visit date and time if you want this job added straight into the diary."
            >
              <div className="grid gap-4">
                {isTrevQuoteJob && (
                  <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-zinc-800">
                    <div className="font-bold text-zinc-900">Trev quote visit rules</div>
                    <div className="mt-1 space-y-1 text-zinc-700">
                      <p>• Trev can only have 3 quote visits per day.</p>
                      <p>• Default quote slots are 11:00, 12:00 and 13:00.</p>
                      <p>• If you leave manual override off, the system will pick the next free slot automatically.</p>
                    </div>
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <FieldLabel required={isTrevQuoteJob}>Visit Date</FieldLabel>
                    <input
                      type="date"
                      value={visitDate}
                      onChange={(e) => setVisitDate(e.target.value)}
                      required={isTrevQuoteJob}
                      className="min-h-[48px] w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                    />
                  </div>

                  <div>
                    <FieldLabel>
                      {isTrevQuoteJob && !allowQuoteTimeOverride
                        ? 'Start Time (automatic)'
                        : 'Start Time'}
                    </FieldLabel>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        disabled={isTrevQuoteJob && !allowQuoteTimeOverride}
                        className={`min-h-[48px] w-full rounded-xl border px-3 py-3 text-sm outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 ${
                          isTrevQuoteJob && !allowQuoteTimeOverride
                            ? 'border-zinc-200 bg-zinc-100 text-zinc-400'
                            : 'border-zinc-300 bg-white text-zinc-900'
                        }`}
                      />

                      <button
                        type="button"
                        onClick={() => setStartTime('')}
                        disabled={
                          (isTrevQuoteJob && !allowQuoteTimeOverride) || !startTime
                        }
                        className="shrink-0 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </div>

                {isTrevQuoteJob ? (
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <label className="flex items-start gap-3 text-sm text-zinc-800">
                      <input
                        type="checkbox"
                        checked={allowQuoteTimeOverride}
                        onChange={(e) => setAllowQuoteTimeOverride(e.target.checked)}
                        className="mt-1"
                      />
                      <span>
                        <span className="block font-semibold">
                          Manually choose a different quote time
                        </span>
                        <span className="mt-1 block text-zinc-500">
                          Only tick this if you need to override the normal 11:00 / 12:00 / 13:00 Trev quote slots.
                        </span>
                      </span>
                    </label>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">
                    Leave date and time blank if this job should stay unscheduled for now.
                  </p>
                )}
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
                      className="min-h-[48px] w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
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
                          onChange={(e) =>
                            setMaintenanceFrequency(
                              e.target.value as MaintenanceFrequencyValue
                            )
                          }
                          className="min-h-[48px] w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                        >
                          <option value="weekly">Weekly</option>
                          <option value="fortnightly">Fortnightly</option>
                          <option value="every_3_weeks">Every 3 Weeks</option>
                          <option value="monthly">Monthly</option>
                        </select>
                        <p className="mt-2 text-sm text-zinc-500">
                          Monthly is treated separately from 4 weeks so the auto-scheduler can keep visits aligned properly across long and short months.
                        </p>
                      </div>

                      <div>
                        <FieldLabel>Visit preference</FieldLabel>
                        <select
                          value={timePreferenceMode}
                          onChange={(e) => setTimePreferenceMode(e.target.value)}
                          className="min-h-[48px] w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                        >
                          <option value="best-fit">Drop into the diary in the best place</option>
                          <option value="specific">Customer wants a specific day / time</option>
                        </select>
                      </div>

                      {useSpecificVisitPreference && (
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <FieldLabel>Preferred day</FieldLabel>
                            <select
                              value={preferredDay}
                              onChange={(e) => setPreferredDay(e.target.value)}
                              className="min-h-[48px] w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
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
                              className="min-h-[48px] w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
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
              description="Choose which workers should be assigned to this job. At least one worker is required."
            >
              {workers.length === 0 ? (
                <p className="text-sm text-zinc-500">No active workers found.</p>
              ) : (
                <>
                  <div className="grid gap-3">
                    {workers.map((worker) => {
                      const checked = assignedTo.includes(worker.id)

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
                          <span className="font-semibold">
                            {worker.firstName} {worker.lastName}
                          </span>
                        </label>
                      )
                    })}
                  </div>

                  {assignedTo.length === 0 && (
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
                    href="/jobs"
                    className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100"
                  >
                    Cancel
                  </Link>

                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-zinc-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {loading ? 'Saving...' : 'Save Job'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>

      {saveSummary ? (
        <SaveConfirmationModal
          summary={saveSummary}
          onClearForm={() => {
            resetForm()
          }}
          onGoToJobs={() => {
            router.push('/jobs')
          }}
        />
      ) : null}
    </main>
  )
}