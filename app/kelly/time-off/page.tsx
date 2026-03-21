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

export default function KellyTimeOffPage() {
  const [requests, setRequests] = useState<RequestItem[]>([])
  const [statusFilter, setStatusFilter] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [message, setMessage] = useState('')

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

  useEffect(() => {
    loadRequests(statusFilter)
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

      const moved = Array.isArray(data.impactedJobIds) ? data.impactedJobIds.length : 0
      const scheduled = Number(data?.schedulerResult?.scheduled || 0)

      setMessage(`Approved. ${moved} impacted job(s) were cleared and ${scheduled} unscheduled job(s) were re-placed automatically.`)
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
            Approvals here update worker availability and trigger a schedule reshuffle automatically.
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
          </div>

          {message && (
            <div style={{ marginTop: 12, color: message.toLowerCase().includes('failed') ? '#b00020' : '#1b5e20' }}>
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
                      {item.reviewedByName && <div><strong>Reviewed by:</strong> {item.reviewedByName}</div>}
                      {item.reviewNotes && <div style={{ marginTop: 4 }}><strong>Notes:</strong> {item.reviewNotes}</div>}
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
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}