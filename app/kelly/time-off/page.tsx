'use client'

import { useEffect, useMemo, useState } from 'react'

type RequestItem = {
  id: number
  requestType: string
  status: string
  startDate: string
  endDate: string
  startTime: string | null
  endTime: string | null
  isFullDay: boolean
  reason: string | null
  requestedByName: string | null
  reviewedByName: string | null
  reviewNotes: string | null
  createdAt: string
  worker: {
    id: number
    firstName: string
    lastName: string
    active: boolean
  }
}

type WorkerItem = {
  id: number
  firstName?: string | null
  lastName?: string | null
  name?: string | null
  active?: boolean
}

type EditForm = {
  workerId: string
  requestType: string
  isFullDay: boolean
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  reason: string
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function requestTypeLabel(value: string) {
  const key = String(value || '').toLowerCase()
  if (key === 'holiday') return 'Holiday'
  if (key === 'day_off') return 'Day off'
  if (key === 'early_finish') return 'Early finish'
  if (key === 'late_start') return 'Late start'
  if (key === 'appointment') return 'Appointment / part-day off'
  if (key === 'sick') return 'Sick / emergency'
  return value || 'Time off'
}

function workerLabel(worker: WorkerItem) {
  const first = String(worker.firstName || '').trim()
  const last = String(worker.lastName || '').trim()
  const full = `${first} ${last}`.trim()

  if (full) return full
  return String(worker.name || `Worker #${worker.id}`)
}

function inputStyle(): React.CSSProperties {
  return {
    width: '100%',
    padding: 12,
    borderRadius: 12,
    border: '1px solid #ccc',
    fontSize: 16,
    minHeight: 48,
    background: '#fff',
  }
}

function dateInputValue(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

export default function KellyTimeOffPage() {
  const [requests, setRequests] = useState<RequestItem[]>([])
  const [workers, setWorkers] = useState<WorkerItem[]>([])
  const [statusFilter, setStatusFilter] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [loadingWorkers, setLoadingWorkers] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [creatingManual, setCreatingManual] = useState(false)
  const [message, setMessage] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)

  const [selectedWorkerId, setSelectedWorkerId] = useState('')
  const [requestType, setRequestType] = useState('holiday')
  const [isFullDay, setIsFullDay] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('16:30')
  const [reason, setReason] = useState('')

  const today = useMemo(() => {
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }, [])

  async function loadRequests(nextStatus = statusFilter) {
    try {
      setLoading(true)
      const res = await fetch(`/api/kelly/time-off?status=${nextStatus}`, {
        cache: 'no-store',
      })
      const data = await res.json()

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Failed to load requests.')
      }

      setRequests(Array.isArray(data.requests) ? data.requests : [])
    } catch (error: any) {
      console.error(error)
      setMessage(String(error?.message || 'Failed to load requests.'))
      setRequests([])
    } finally {
      setLoading(false)
    }
  }

  async function loadWorkers() {
    try {
      setLoadingWorkers(true)
      const res = await fetch('/api/workers', {
        cache: 'no-store',
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to load workers.')
      }

      const list = Array.isArray(data) ? data : Array.isArray(data?.workers) ? data.workers : []
      const activeWorkers = list.filter((item: WorkerItem) => item && item.active !== false)
      setWorkers(activeWorkers)

      if (!selectedWorkerId && activeWorkers.length > 0) {
        setSelectedWorkerId(String(activeWorkers[0].id))
      }
    } catch (error: any) {
      console.error(error)
      setMessage(String(error?.message || 'Failed to load workers.'))
      setWorkers([])
    } finally {
      setLoadingWorkers(false)
    }
  }

  useEffect(() => {
    setStartDate(today)
    setEndDate(today)
  }, [today])

  useEffect(() => {
    loadRequests(statusFilter)
    loadWorkers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  const counts = useMemo(() => {
    return {
      pending: requests.filter((item) => item.status === 'pending').length,
      approved: requests.filter((item) => item.status === 'approved').length,
      declined: requests.filter((item) => item.status === 'declined').length,
    }
  }, [requests])

  async function approveRequest(id: number) {
    const reviewNotes = window.prompt('Approval notes for the worker / diary (optional)', '') ?? ''

    try {
      setBusyId(id)
      setMessage('')

      const res = await fetch(`/api/kelly/time-off/${id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reviewedByName: 'Kelly',
          reviewNotes,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Failed to approve request.')
      }

      const conflictsFound = Number(data?.conflictsFound || 0)
      const actionsTaken = Array.isArray(data?.results) ? data.results.length : 0

      setMessage(`Approved. ${conflictsFound} clash(es) found and ${actionsTaken} automatic action(s) taken.`)
      await loadRequests(statusFilter)
    } catch (error: any) {
      console.error(error)
      setMessage(String(error?.message || 'Failed to approve request.'))
    } finally {
      setBusyId(null)
    }
  }

  async function declineRequest(id: number) {
    const reviewNotes = window.prompt('Why are you declining this request? (optional)', '') ?? ''

    try {
      setBusyId(id)
      setMessage('')

      const res = await fetch(`/api/kelly/time-off/${id}/decline`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reviewedByName: 'Kelly',
          reviewNotes,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Failed to decline request.')
      }

      setMessage('Request declined.')
      await loadRequests(statusFilter)
    } catch (error: any) {
      console.error(error)
      setMessage(String(error?.message || 'Failed to decline request.'))
    } finally {
      setBusyId(null)
    }
  }

  function startEditing(item: RequestItem) {
    setMessage('')
    setEditingId(item.id)
    setEditForm({
      workerId: String(item.worker.id),
      requestType: item.requestType,
      isFullDay: item.isFullDay,
      startDate: dateInputValue(item.startDate),
      endDate: dateInputValue(item.endDate),
      startTime: item.startTime || '09:00',
      endTime: item.endTime || '16:30',
      reason: item.reason || '',
    })
  }

  function cancelEditing() {
    if (busyId !== null) return
    setEditingId(null)
    setEditForm(null)
  }

  function updateEditForm<K extends keyof EditForm>(key: K, value: EditForm[K]) {
    setEditForm((current) => (current ? { ...current, [key]: value } : current))
  }

  async function saveApprovedHoliday(id: number) {
    if (!editForm) return

    if (!editForm.workerId || !editForm.startDate || !editForm.endDate) {
      setMessage('Please choose a worker and date range.')
      return
    }

    if (editForm.endDate < editForm.startDate) {
      setMessage('End date cannot be before start date.')
      return
    }

    if (!editForm.isFullDay && (!editForm.startTime || !editForm.endTime)) {
      setMessage('Please choose the start and end time.')
      return
    }

    try {
      setBusyId(id)
      setMessage('')

      const res = await fetch(`/api/kelly/time-off/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId: Number(editForm.workerId),
          requestType: editForm.requestType,
          isFullDay: editForm.isFullDay,
          startDate: editForm.startDate,
          endDate: editForm.endDate,
          startTime: editForm.isFullDay ? null : editForm.startTime,
          endTime: editForm.isFullDay ? null : editForm.endTime,
          reason: editForm.reason,
          reviewedByName: 'Kelly',
        }),
      })

      const data = await res.json()
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Failed to update the approved holiday.')
      }

      const moved = Array.isArray(data?.impactedJobIds) ? data.impactedJobIds.length : 0
      setMessage(
        moved > 0
          ? `Holiday updated. ${moved} impacted job${moved === 1 ? '' : 's'} returned to scheduling.`
          : 'Holiday updated successfully.'
      )
      setEditingId(null)
      setEditForm(null)
      await loadRequests(statusFilter)
    } catch (error: any) {
      console.error(error)
      setMessage(String(error?.message || 'Failed to update the approved holiday.'))
    } finally {
      setBusyId(null)
    }
  }

  async function deleteApprovedHoliday(item: RequestItem) {
    const workerName = `${item.worker.firstName} ${item.worker.lastName}`.trim()
    const confirmed = window.confirm(
      `Permanently delete this accepted holiday for ${workerName}? This cannot be undone.`
    )

    if (!confirmed) return

    try {
      setBusyId(item.id)
      setMessage('')

      const res = await fetch(`/api/kelly/time-off/${item.id}`, {
        method: 'DELETE',
      })
      const data = await res.json()

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Failed to delete the accepted holiday.')
      }

      if (editingId === item.id) {
        setEditingId(null)
        setEditForm(null)
      }
      setMessage('Holiday deleted from the system.')
      await loadRequests(statusFilter)
    } catch (error: any) {
      console.error(error)
      setMessage(String(error?.message || 'Failed to delete the accepted holiday.'))
    } finally {
      setBusyId(null)
    }
  }

  async function createManualTimeOff() {
    const workerId = Number(selectedWorkerId)

    if (!workerId) {
      setMessage('Please choose a worker.')
      return
    }

    if (!startDate || !endDate) {
      setMessage('Please choose the date range.')
      return
    }

    if (!isFullDay && (!startTime || !endTime)) {
      setMessage('Please choose the start and end time.')
      return
    }

    try {
      setCreatingManual(true)
      setMessage('')

      const res = await fetch('/api/time-off/self', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workerId,
          requestedByName: 'Kelly',
          requestType,
          isFullDay,
          startDate,
          endDate,
          startTime: isFullDay ? null : startTime,
          endTime: isFullDay ? null : endTime,
          reason,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Failed to add time off.')
      }

      const conflictsFound = Number(data?.conflictsFound || 0)
      const actionsTaken = Array.isArray(data?.results) ? data.results.length : 0

      setMessage(`Time off added. ${conflictsFound} clash(es) found and ${actionsTaken} automatic action(s) taken.`)

      setReason('')
      if (requestType === 'holiday' || requestType === 'day_off' || requestType === 'sick') {
        setIsFullDay(true)
      }

      await loadRequests(statusFilter)
    } catch (error: any) {
      console.error(error)
      setMessage(String(error?.message || 'Failed to add time off.'))
    } finally {
      setCreatingManual(false)
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f5f5f5',
        padding: '20px 14px 40px',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div
          style={{
            background: '#111',
            color: '#fff',
            borderRadius: 20,
            padding: 20,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.75, textTransform: 'uppercase', fontWeight: 800 }}>
            Kelly approval
          </div>
          <h1 style={{ margin: '8px 0 4px', fontSize: 32, lineHeight: 1, fontWeight: 900 }}>
            Time Off Requests
          </h1>
          <div style={{ opacity: 0.82 }}>
            Approvals update worker availability automatically, and Kelly can also add time off directly here.
          </div>
        </div>

        <section
          style={{
            background: '#fff',
            border: '1px solid #ddd',
            borderRadius: 18,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 14 }}>
            Add time off for a worker
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            <select
              value={selectedWorkerId}
              onChange={(e) => setSelectedWorkerId(e.target.value)}
              style={inputStyle()}
              disabled={loadingWorkers || creatingManual}
            >
              <option value="">Choose worker</option>
              {workers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {workerLabel(worker)}
                </option>
              ))}
            </select>

            <select
              value={requestType}
              onChange={(e) => {
                const value = e.target.value
                setRequestType(value)

                if (value === 'holiday' || value === 'day_off' || value === 'sick') {
                  setIsFullDay(true)
                }
              }}
              style={inputStyle()}
              disabled={creatingManual}
            >
              <option value="holiday">Holiday</option>
              <option value="day_off">Day off</option>
              <option value="early_finish">Early finish</option>
              <option value="late_start">Late start</option>
              <option value="appointment">Appointment / part-day off</option>
              <option value="sick">Sick / emergency</option>
            </select>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
              <input
                type="checkbox"
                checked={isFullDay}
                onChange={(e) => setIsFullDay(e.target.checked)}
                disabled={creatingManual}
              />
              Full day
            </label>

            <div
              style={{
                display: 'grid',
                gap: 12,
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              }}
            >
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={inputStyle()}
                disabled={creatingManual}
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={inputStyle()}
                disabled={creatingManual}
              />
            </div>

            {!isFullDay && (
              <div
                style={{
                  display: 'grid',
                  gap: 12,
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                }}
              >
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  style={inputStyle()}
                  disabled={creatingManual}
                />
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  style={inputStyle()}
                  disabled={creatingManual}
                />
              </div>
            )}

            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason / note"
              style={{
                minHeight: 110,
                padding: 12,
                borderRadius: 12,
                border: '1px solid #ccc',
                resize: 'vertical',
                fontFamily: 'inherit',
                fontSize: 16,
                background: '#fff',
              }}
              disabled={creatingManual}
            />

            <button
              type="button"
              onClick={createManualTimeOff}
              disabled={creatingManual || loadingWorkers}
              style={{
                minHeight: 50,
                borderRadius: 14,
                border: '1px solid #111',
                background: '#111',
                color: '#fff',
                fontWeight: 800,
                fontSize: 16,
                cursor: creatingManual || loadingWorkers ? 'not-allowed' : 'pointer',
                opacity: creatingManual || loadingWorkers ? 0.7 : 1,
              }}
            >
              {creatingManual ? 'Adding...' : 'Add time off'}
            </button>
          </div>
        </section>

        <section
          style={{
            background: '#fff',
            border: '1px solid #ddd',
            borderRadius: 18,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {['pending', 'approved', 'declined', 'all'].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setStatusFilter(item)}
                style={{
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: statusFilter === item ? '1px solid #111' : '1px solid #ccc',
                  background: statusFilter === item ? '#111' : '#fff',
                  color: statusFilter === item ? '#fff' : '#111',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {item === 'all' ? 'All' : `${item[0].toUpperCase()}${item.slice(1)}`}
              </button>
            ))}

            <div
              style={{
                marginLeft: 'auto',
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  padding: '6px 10px',
                  borderRadius: 999,
                  background: '#fff8e1',
                  border: '1px solid #f0d98c',
                  fontWeight: 800,
                  fontSize: 13,
                }}
              >
                Pending: {counts.pending}
              </span>
              <span
                style={{
                  padding: '6px 10px',
                  borderRadius: 999,
                  background: '#e8f5e9',
                  border: '1px solid #b7dfbb',
                  fontWeight: 800,
                  fontSize: 13,
                }}
              >
                Approved: {counts.approved}
              </span>
              <span
                style={{
                  padding: '6px 10px',
                  borderRadius: 999,
                  background: '#ffebee',
                  border: '1px solid #efc2c8',
                  fontWeight: 800,
                  fontSize: 13,
                }}
              >
                Declined: {counts.declined}
              </span>
            </div>
          </div>

          {message && (
            <div
              style={{
                marginTop: 12,
                color: message.toLowerCase().includes('failed') ? '#b00020' : '#1b5e20',
              }}
            >
              {message}
            </div>
          )}
        </section>

        <section
          style={{
            background: '#fff',
            border: '1px solid #ddd',
            borderRadius: 18,
            padding: 16,
          }}
        >
          {loading ? (
            <div>Loading...</div>
          ) : requests.length === 0 ? (
            <div style={{ color: '#666' }}>No requests in this view.</div>
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              {requests.map((item) => (
                <div
                  key={item.id}
                  style={{
                    border: '1px solid #e3e3e3',
                    borderRadius: 16,
                    padding: 16,
                    background: '#fafafa',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 900 }}>
                        {item.worker.firstName} {item.worker.lastName}
                      </div>
                      <div style={{ marginTop: 4, fontWeight: 700 }}>
                        {requestTypeLabel(item.requestType)}
                      </div>
                      <div style={{ marginTop: 4, color: '#555' }}>
                        {formatDate(item.startDate)}
                        {item.startDate !== item.endDate ? ` → ${formatDate(item.endDate)}` : ''}
                        {!item.isFullDay && item.startTime && item.endTime ? ` • ${item.startTime}-${item.endTime}` : ' • Full day'}
                      </div>
                      {item.requestedByName && (
                        <div style={{ marginTop: 4, color: '#666', fontSize: 14 }}>
                          Requested by: {item.requestedByName}
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        padding: '8px 12px',
                        borderRadius: 999,
                        background:
                          item.status === 'approved'
                            ? '#e8f5e9'
                            : item.status === 'declined'
                              ? '#ffebee'
                              : '#fff8e1',
                        border: '1px solid #ddd',
                        fontWeight: 800,
                        textTransform: 'capitalize',
                        height: 'fit-content',
                      }}
                    >
                      {item.status}
                    </div>
                  </div>

                  {item.reason && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: 12,
                        borderRadius: 12,
                        background: '#fff',
                        border: '1px solid #eee',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {item.reason}
                    </div>
                  )}

                  {(item.reviewedByName || item.reviewNotes) && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: 12,
                        borderRadius: 12,
                        background: '#fff',
                        border: '1px solid #eee',
                        fontSize: 14,
                      }}
                    >
                      {item.reviewedByName && (
                        <div>
                          <strong>Reviewed by:</strong> {item.reviewedByName}
                        </div>
                      )}
                      {item.reviewNotes && (
                        <div style={{ marginTop: 4 }}>
                          <strong>Notes:</strong> {item.reviewNotes}
                        </div>
                      )}
                    </div>
                  )}

                  {item.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
                      <button
                        type="button"
                        onClick={() => approveRequest(item.id)}
                        disabled={busyId === item.id}
                        style={{
                          minHeight: 46,
                          padding: '12px 16px',
                          borderRadius: 12,
                          border: '1px solid #111',
                          background: '#111',
                          color: '#fff',
                          fontWeight: 800,
                          cursor: busyId === item.id ? 'not-allowed' : 'pointer',
                          opacity: busyId === item.id ? 0.7 : 1,
                        }}
                      >
                        {busyId === item.id ? 'Working...' : 'Approve'}
                      </button>

                      <button
                        type="button"
                        onClick={() => declineRequest(item.id)}
                        disabled={busyId === item.id}
                        style={{
                          minHeight: 46,
                          padding: '12px 16px',
                          borderRadius: 12,
                          border: '1px solid #ccc',
                          background: '#fff',
                          color: '#111',
                          fontWeight: 800,
                          cursor: busyId === item.id ? 'not-allowed' : 'pointer',
                          opacity: busyId === item.id ? 0.7 : 1,
                        }}
                      >
                        {busyId === item.id ? 'Working...' : 'Decline'}
                      </button>
                    </div>
                  )}

                  {item.status === 'approved' && editingId !== item.id && (
                    <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => startEditing(item)}
                        disabled={busyId !== null}
                        style={{
                          minHeight: 46,
                          padding: '12px 16px',
                          borderRadius: 12,
                          border: '1px solid #166534',
                          background: '#fff',
                          color: '#166534',
                          fontWeight: 800,
                          cursor: busyId !== null ? 'not-allowed' : 'pointer',
                        }}
                      >
                        Edit accepted holiday
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteApprovedHoliday(item)}
                        disabled={busyId !== null}
                        style={{
                          minHeight: 46,
                          padding: '12px 16px',
                          borderRadius: 12,
                          border: '1px solid #b91c1c',
                          background: '#fff',
                          color: '#b91c1c',
                          fontWeight: 800,
                          cursor: busyId !== null ? 'not-allowed' : 'pointer',
                          opacity: busyId === item.id ? 0.7 : 1,
                        }}
                      >
                        {busyId === item.id ? 'Deleting...' : 'Delete holiday'}
                      </button>
                    </div>
                  )}

                  {item.status === 'approved' && editingId === item.id && editForm && (
                    <div
                      style={{
                        marginTop: 14,
                        padding: 14,
                        borderRadius: 14,
                        border: '1px solid #b7dfbb',
                        background: '#f3fbf4',
                        display: 'grid',
                        gap: 12,
                      }}
                    >
                      <div style={{ fontWeight: 900, fontSize: 18 }}>Edit accepted holiday</div>

                      <select
                        aria-label="Worker"
                        value={editForm.workerId}
                        onChange={(e) => updateEditForm('workerId', e.target.value)}
                        style={inputStyle()}
                        disabled={busyId === item.id}
                      >
                        {workers.map((worker) => (
                          <option key={worker.id} value={worker.id}>{workerLabel(worker)}</option>
                        ))}
                      </select>

                      <select
                        aria-label="Time off type"
                        value={editForm.requestType}
                        onChange={(e) => updateEditForm('requestType', e.target.value)}
                        style={inputStyle()}
                        disabled={busyId === item.id}
                      >
                        <option value="holiday">Holiday</option>
                        <option value="day_off">Day off</option>
                        <option value="early_finish">Early finish</option>
                        <option value="late_start">Late start</option>
                        <option value="appointment">Appointment / part-day off</option>
                        <option value="sick">Sick / emergency</option>
                      </select>

                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                        <input
                          type="checkbox"
                          checked={editForm.isFullDay}
                          onChange={(e) => updateEditForm('isFullDay', e.target.checked)}
                          disabled={busyId === item.id}
                        />
                        Full day
                      </label>

                      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                        <input aria-label="Start date" type="date" value={editForm.startDate} onChange={(e) => updateEditForm('startDate', e.target.value)} style={inputStyle()} disabled={busyId === item.id} />
                        <input aria-label="End date" type="date" value={editForm.endDate} onChange={(e) => updateEditForm('endDate', e.target.value)} style={inputStyle()} disabled={busyId === item.id} />
                      </div>

                      {!editForm.isFullDay && (
                        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                          <input aria-label="Start time" type="time" value={editForm.startTime} onChange={(e) => updateEditForm('startTime', e.target.value)} style={inputStyle()} disabled={busyId === item.id} />
                          <input aria-label="End time" type="time" value={editForm.endTime} onChange={(e) => updateEditForm('endTime', e.target.value)} style={inputStyle()} disabled={busyId === item.id} />
                        </div>
                      )}

                      <textarea
                        aria-label="Reason or note"
                        value={editForm.reason}
                        onChange={(e) => updateEditForm('reason', e.target.value)}
                        placeholder="Reason / note"
                        disabled={busyId === item.id}
                        style={{ ...inputStyle(), minHeight: 90, resize: 'vertical', fontFamily: 'inherit' }}
                      />

                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => saveApprovedHoliday(item.id)}
                          disabled={busyId === item.id}
                          style={{ minHeight: 46, padding: '12px 16px', borderRadius: 12, border: 0, background: '#166534', color: '#fff', fontWeight: 800, cursor: busyId === item.id ? 'not-allowed' : 'pointer' }}
                        >
                          {busyId === item.id ? 'Saving...' : 'Save changes'}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditing}
                          disabled={busyId === item.id}
                          style={{ minHeight: 46, padding: '12px 16px', borderRadius: 12, border: '1px solid #ccc', background: '#fff', color: '#111', fontWeight: 800, cursor: busyId === item.id ? 'not-allowed' : 'pointer' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
