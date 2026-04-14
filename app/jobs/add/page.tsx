'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type Customer = {
  id: number
  name: string
  phone: string | null
  email: string | null
  address: string | null
  postcode: string | null
  notes: string | null
}

type Worker = {
  id: number
  firstName: string
  lastName: string
  active?: boolean
}

type JobResponse = {
  id: number
}

type MaintenanceFrequency =
  | 'weekly'
  | 'fortnightly'
  | 'every_3_weeks'
  | 'monthly'
  | ''

type TimePreferenceMode = 'best-fit' | 'specific'

type PreferredDay =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | ''

type PreferredTimeBand = 'Morning' | 'Midday' | 'Afternoon' | 'Anytime'

function todayLocalDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function toNumber(value: string | null) {
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function fullName(worker: Worker) {
  return `${worker.firstName || ''} ${worker.lastName || ''}`.trim() || `Worker ${worker.id}`
}

function splitWorkerName(name: string) {
  const trimmed = clean(name)

  if (!trimmed) {
    return {
      firstName: '',
      lastName: '',
    }
  }

  const parts = trimmed.split(/\s+/).filter(Boolean)

  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: '',
    }
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  }
}

function normaliseWorker(raw: any): Worker | null {
  if (!raw || typeof raw !== 'object') return null

  const id = Number(raw.id)
  if (!Number.isFinite(id) || id <= 0) return null

  const firstNameRaw = clean(raw.firstName)
  const lastNameRaw = clean(raw.lastName)
  const combinedName = clean(raw.name)

  let firstName = firstNameRaw
  let lastName = lastNameRaw

  if (!firstName && !lastName && combinedName) {
    const split = splitWorkerName(combinedName)
    firstName = split.firstName
    lastName = split.lastName
  }

  return {
    id,
    firstName,
    lastName,
    active: typeof raw.active === 'boolean' ? raw.active : true,
  }
}

function isMaintenanceJobType(jobType: string) {
  return clean(jobType).toLowerCase() === 'maintenance'
}

function getMaintenanceWeeks(frequency: MaintenanceFrequency) {
  if (frequency === 'weekly') return 1
  if (frequency === 'fortnightly') return 2
  if (frequency === 'every_3_weeks') return 3
  return null
}

export default function AddJobPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const [customers, setCustomers] = useState<Customer[]>([])
  const [workers, setWorkers] = useState<Worker[]>([])

  const [customerId, setCustomerId] = useState<number | ''>('')
  const [title, setTitle] = useState('')
  const [jobType, setJobType] = useState('Quote')
  const [address, setAddress] = useState('')
  const [postcode, setPostcode] = useState('')
  const [notes, setNotes] = useState('')
  const [visitDate, setVisitDate] = useState(todayLocalDate())
  const [startTime, setStartTime] = useState('')
  const [durationMinutes, setDurationMinutes] = useState('60')
  const [assignedWorkerIds, setAssignedWorkerIds] = useState<number[]>([])
  const [allowQuoteTimeOverride, setAllowQuoteTimeOverride] = useState(false)

  const [isRegularMaintenance, setIsRegularMaintenance] = useState(false)
  const [maintenanceFrequency, setMaintenanceFrequency] =
    useState<MaintenanceFrequency>('')
  const [timePreferenceMode, setTimePreferenceMode] =
    useState<TimePreferenceMode>('best-fit')
  const [preferredDay, setPreferredDay] = useState<PreferredDay>('')
  const [preferredTimeBand, setPreferredTimeBand] =
    useState<PreferredTimeBand>('Anytime')

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setError('')

        const params = new URLSearchParams(window.location.search)

        const queryCustomerId = toNumber(params.get('customerId'))
        const queryTitle = clean(params.get('title'))
        const queryAddress = clean(params.get('address'))
        const queryPostcode = clean(params.get('postcode'))
        const queryJobType = clean(params.get('jobType'))

        const [customersRes, workersRes] = await Promise.all([
          fetch('/api/customers', { cache: 'no-store' }),
          fetch('/api/workers', { cache: 'no-store' }),
        ])

        if (!customersRes.ok) {
          throw new Error('Failed to load customers')
        }

        if (!workersRes.ok) {
          throw new Error('Failed to load workers')
        }

        const customersData = await customersRes.json().catch(() => [])
        const workersData = await workersRes.json().catch(() => [])

        if (cancelled) return

        const loadedCustomers = Array.isArray(customersData)
          ? customersData
          : Array.isArray(customersData?.items)
            ? customersData.items
            : Array.isArray(customersData?.customers)
              ? customersData.customers
              : []

        const rawWorkers = Array.isArray(workersData)
          ? workersData
          : Array.isArray(workersData?.items)
            ? workersData.items
            : Array.isArray(workersData?.workers)
              ? workersData.workers
              : []

        const loadedWorkers = rawWorkers
          .map(normaliseWorker)
          .filter((worker: Worker | null): worker is Worker => worker !== null)

        setCustomers(loadedCustomers)
        setWorkers(loadedWorkers)

        if (queryCustomerId) {
          setCustomerId(queryCustomerId)

          const matchingCustomer = loadedCustomers.find(
            (customer: Customer) => customer.id === queryCustomerId
          )

          if (matchingCustomer) {
            setAddress(queryAddress || matchingCustomer.address || '')
            setPostcode(queryPostcode || matchingCustomer.postcode || '')
            setTitle(queryTitle || matchingCustomer.name || '')
          } else {
            setAddress(queryAddress)
            setPostcode(queryPostcode)
            setTitle(queryTitle)
          }
        } else {
          setAddress(queryAddress)
          setPostcode(queryPostcode)
          setTitle(queryTitle)
        }

        if (queryJobType) {
          setJobType(queryJobType)
        }
      } catch (err) {
        console.error(err)
        if (!cancelled) {
          setError('Failed to load add job page.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isMaintenanceJobType(jobType)) {
      setIsRegularMaintenance(false)
      setMaintenanceFrequency('')
      setTimePreferenceMode('best-fit')
      setPreferredDay('')
      setPreferredTimeBand('Anytime')
    }
  }, [jobType])

  const selectedCustomer = useMemo(() => {
    if (!customerId) return null
    return customers.find((customer) => customer.id === customerId) || null
  }, [customerId, customers])

  function handleCustomerChange(nextCustomerId: number | '') {
    setCustomerId(nextCustomerId)

    if (!nextCustomerId) {
      return
    }

    const customer = customers.find((item) => item.id === nextCustomerId)

    if (!customer) return

    if (!address) {
      setAddress(customer.address || '')
    }

    if (!postcode) {
      setPostcode(customer.postcode || '')
    }

    if (!title) {
      setTitle(customer.name || '')
    }
  }

  function toggleWorker(workerId: number) {
    setAssignedWorkerIds((current) =>
      current.includes(workerId)
        ? current.filter((id) => id !== workerId)
        : [...current, workerId]
    )
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setSaving(true)
      setError('')
      setSuccessMessage('')

      if (!customerId) {
        setError('Please select a customer.')
        return
      }

      if (
        isMaintenanceJobType(jobType) &&
        isRegularMaintenance &&
        !maintenanceFrequency
      ) {
        setError('Please choose a maintenance frequency for regular maintenance.')
        return
      }

      if (
        isMaintenanceJobType(jobType) &&
        isRegularMaintenance &&
        timePreferenceMode === 'specific' &&
        !preferredTimeBand
      ) {
        setError('Please choose a preferred time band.')
        return
      }

      const payload: Record<string, unknown> = {
        customerId,
        title: title.trim() || selectedCustomer?.name || 'New Job',
        jobType: jobType.trim() || 'Quote',
        address: address.trim(),
        notes: notes.trim(),
        assignedWorkerIds,
        allowQuoteTimeOverride,
      }

      if (postcode.trim()) {
        payload.postcode = postcode.trim()
      }

      if (visitDate.trim()) {
        payload.visitDate = visitDate
      }

      if (startTime.trim()) {
        payload.startTime = startTime
      }

      if (durationMinutes.trim()) {
        const parsedDuration = Number(durationMinutes)
        if (Number.isFinite(parsedDuration) && parsedDuration > 0) {
          payload.durationMinutes = Math.round(parsedDuration)
        }
      }

      if (isMaintenanceJobType(jobType)) {
        payload.isRegularMaintenance = isRegularMaintenance

        if (isRegularMaintenance) {
          payload.visitPattern = 'regular-maintenance'
          payload.maintenanceFrequency = maintenanceFrequency
          payload.maintenanceFrequencyUnit =
            maintenanceFrequency === 'monthly' ? 'monthly' : 'weeks'

          const maintenanceWeeks = getMaintenanceWeeks(maintenanceFrequency)
          if (maintenanceWeeks) {
            payload.maintenanceFrequencyWeeks = maintenanceWeeks
          }

          payload.timePreferenceMode = timePreferenceMode

          if (timePreferenceMode === 'specific') {
            if (preferredDay) {
              payload.preferredDay = preferredDay
            }
            payload.preferredTimeBand = preferredTimeBand || 'Anytime'
          }
        }
      }

      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to create job')
      }

      const createdJob = data as JobResponse
      setSuccessMessage('Job created successfully.')

      if (createdJob?.id) {
        router.push(`/jobs/${createdJob.id}`)
        router.refresh()
        return
      }

      router.push('/today')
      router.refresh()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Failed to create job')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-50">
        <div className="mx-auto max-w-4xl px-4 py-5 md:px-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-zinc-600">Loading add job page...</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-4xl px-4 py-5 md:px-6">
        <div className="space-y-5">
          <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
            <div className="bg-zinc-900 px-5 py-5 text-white md:px-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.22em] text-yellow-400">
                    Jobs
                  </div>
                  <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">
                    Add Job
                  </h1>
                  <p className="mt-2 text-sm text-zinc-300 md:text-base">
                    Create a new quote, maintenance visit, or install job.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/today"
                    className="inline-flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700"
                  >
                    Back to Today
                  </Link>
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-200 bg-zinc-50 p-4 md:p-5">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                    Selected customer
                  </div>
                  <div className="mt-2 text-sm font-medium text-zinc-900">
                    {selectedCustomer?.name || 'Not selected'}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                    Job type
                  </div>
                  <div className="mt-2 text-sm font-medium text-zinc-900">
                    {jobType || 'Quote'}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                    Assigned workers
                  </div>
                  <div className="mt-2 text-sm font-medium text-zinc-900">
                    {assignedWorkerIds.length > 0 ? assignedWorkerIds.length : 'None'}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700 shadow-sm">
              {successMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-zinc-900">Customer</h2>

              <div className="grid gap-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-800">
                    Customer
                  </label>
                  <select
                    value={customerId}
                    onChange={(e) =>
                      handleCustomerChange(e.target.value ? Number(e.target.value) : '')
                    }
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                  >
                    <option value="">Select a customer</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-zinc-900">Job details</h2>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-800">
                    Title
                  </label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Job title"
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-800">
                    Job type
                  </label>
                  <select
                    value={jobType}
                    onChange={(e) => setJobType(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                  >
                    <option value="Quote">Quote</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Landscaping">Landscaping</option>
                    <option value="Prep">Prep</option>
                    <option value="General">General</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-zinc-800">
                    Address
                  </label>
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Job address"
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-800">
                    Postcode
                  </label>
                  <input
                    value={postcode}
                    onChange={(e) => setPostcode(e.target.value)}
                    placeholder="Postcode"
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-800">
                    Duration (minutes)
                  </label>
                  <input
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    inputMode="numeric"
                    placeholder="60"
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-800">
                    Visit date
                  </label>
                  <input
                    type="date"
                    value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-800">
                    Start time
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-zinc-800">
                    Notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any job notes"
                    className="min-h-[110px] w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                  />
                </div>

                {jobType.toLowerCase() === 'quote' && (
                  <div className="md:col-span-2">
                    <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                      <input
                        type="checkbox"
                        checked={allowQuoteTimeOverride}
                        onChange={(e) => setAllowQuoteTimeOverride(e.target.checked)}
                        className="h-4 w-4"
                      />
                      <div>
                        <div className="text-sm font-semibold text-zinc-900">
                          Allow quote time override
                        </div>
                        <div className="text-xs text-zinc-500">
                          Use this only if you want a non-standard Trev quote time.
                        </div>
                      </div>
                    </label>
                  </div>
                )}
              </div>
            </section>

            {isMaintenanceJobType(jobType) && (
              <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-zinc-900">
                  Regular Maintenance
                </h2>

                <div className="space-y-4">
                  <label className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <input
                      type="checkbox"
                      checked={isRegularMaintenance}
                      onChange={(e) => setIsRegularMaintenance(e.target.checked)}
                      className="mt-1 h-4 w-4"
                    />
                    <div>
                      <div className="text-sm font-semibold text-zinc-900">
                        This is a regular maintenance job
                      </div>
                      <div className="text-xs text-zinc-500">
                        Turn this on for recurring garden maintenance rather than a one-off visit.
                      </div>
                    </div>
                  </label>

                  {isRegularMaintenance && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-zinc-800">
                          Frequency
                        </label>
                        <select
                          value={maintenanceFrequency}
                          onChange={(e) =>
                            setMaintenanceFrequency(
                              e.target.value as MaintenanceFrequency
                            )
                          }
                          className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                        >
                          <option value="">Select frequency</option>
                          <option value="weekly">Weekly</option>
                          <option value="fortnightly">Fortnightly</option>
                          <option value="every_3_weeks">Every 3 weeks</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-semibold text-zinc-800">
                          Time preference
                        </label>
                        <select
                          value={timePreferenceMode}
                          onChange={(e) =>
                            setTimePreferenceMode(
                              e.target.value as TimePreferenceMode
                            )
                          }
                          className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                        >
                          <option value="best-fit">Best fit</option>
                          <option value="specific">Specific preference</option>
                        </select>
                      </div>

                      {timePreferenceMode === 'specific' && (
                        <>
                          <div>
                            <label className="mb-2 block text-sm font-semibold text-zinc-800">
                              Preferred day
                            </label>
                            <select
                              value={preferredDay}
                              onChange={(e) =>
                                setPreferredDay(e.target.value as PreferredDay)
                              }
                              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                            >
                              <option value="">No preference</option>
                              <option value="Monday">Monday</option>
                              <option value="Tuesday">Tuesday</option>
                              <option value="Wednesday">Wednesday</option>
                              <option value="Thursday">Thursday</option>
                              <option value="Friday">Friday</option>
                            </select>
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-semibold text-zinc-800">
                              Preferred time band
                            </label>
                            <select
                              value={preferredTimeBand}
                              onChange={(e) =>
                                setPreferredTimeBand(
                                  e.target.value as PreferredTimeBand
                                )
                              }
                              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                            >
                              <option value="Morning">Morning</option>
                              <option value="Midday">Midday</option>
                              <option value="Afternoon">Afternoon</option>
                              <option value="Anytime">Anytime</option>
                            </select>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </section>
            )}

            <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-zinc-900">Assign workers</h2>

              {workers.length === 0 ? (
                <p className="text-sm text-zinc-500">No workers found.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {workers.map((worker) => (
                    <label
                      key={worker.id}
                      className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
                    >
                      <input
                        type="checkbox"
                        checked={assignedWorkerIds.includes(worker.id)}
                        onChange={() => toggleWorker(worker.id)}
                        className="h-4 w-4"
                      />
                      <div>
                        <div className="text-sm font-semibold text-zinc-900">
                          {fullName(worker)}
                        </div>
                        <div className="text-xs text-zinc-500">
                          Worker #{worker.id}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </section>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Creating...' : 'Create Job'}
              </button>

              <Link
                href="/today"
                className="rounded-xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-800"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}