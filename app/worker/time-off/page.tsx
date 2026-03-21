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
  reviewedByName: string | null
  reviewNotes: string | null
  createdAt: string
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
  if (key === 'appointment') return 'Appointment'
  if (key === 'sick') return 'Sick / emergency'
  return value || 'Time off'
}

export default function WorkerTimeOffPage() {
  const [workerId, setWorkerId] = useState<number | null>(null)
  const [workerName, setWorkerName] = useState('')
  const [requestType, setRequestType] = useState('holiday')
  const [isFullDay, setIsFullDay] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [startTime, setStartTime] = useState('13:00')
  const [endTime, setEndTime] = useState('16:30')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [requests, setRequests] = useState<RequestItem[]>([])
  const [loading, setLoading] = useState(true)

  const today = useMemo(() => {
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }, [])

  async function loadRequests(currentWorkerId: number) {
    try {
      setLoading(true)
      const res = await fetch(`/api/time-off/my-requests?workerId=${currentWorkerId}`, {
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
    const savedWorkerId = localStorage.getItem('workerId')
    const savedWorkerName = localStorage.getItem('workerName')

    if (savedWorkerId) {
      const parsed = Number(savedWorkerId)
      if (Number.isInteger(parsed) && parsed > 0) {
        setWorkerId(parsed)
        loadRequests(parsed)
      }
    }

    if (savedWorkerName) {
      setWorkerName(savedWorkerName)
    }

    setStartDate(today)
    setEndDate(today)
  }, [today])

  async function handleSubmit() {
    if (!workerId) {
      setMessage('No worker is logged in on this device.')
      return
    }

    if (!startDate || !endDate) {
      setMessage('Please choose your dates.')
      return
    }

    setBusy(true)
    setMessage('')

    try {
      const res = await fetch('/api/time-off/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workerId,
          requestedByName: workerName,
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
        throw new Error(data?.error || 'Failed to send request.')
      }

      setMessage('Request sent to Kelly for approval.')
      setReason('')

      if (requestType === 'holiday' || requestType === 'day_off' || requestType === 'sick') {
        setIsFullDay(true)
      }

      await loadRequests(workerId)
    } catch (error: any) {
      console.error(error)
      setMessage(String(error?.message || 'Failed to send request.'))
    } finally {
      setBusy(false)
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
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
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
            Worker requests
          </div>
          <h1 style={{ margin: '8px 0 4px', fontSize: 32, lineHeight: 1, fontWeight: 900 }}>
            Time Off
          </h1>
          <div style={{ opacity: 0.82 }}>
            Logged in as {workerName || 'Worker'}
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
            New request
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            <select
              value={requestType}
              onChange={(e) => {
                const value = e.target.value
                setRequestType(value)
                if (value === 'holiday' || value === 'day_off' || value === 'sick') {
                  setIsFullDay(true)
                }
              }}
              style={{ padding: 12, borderRadius: 12, border: '1px solid #ccc' }}
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
              />
              Full day
            </label>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ padding: 12, borderRadius: 12, border: '1px solid #ccc' }}
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ padding: 12, borderRadius: 12, border: '1px solid #ccc' }}
              />
            </div>

            {!isFullDay && (
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  style={{ padding: 12, borderRadius: 12, border: '1px solid #ccc' }}
                />
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  style={{ padding: 12, borderRadius: 12, border: '1px solid #ccc' }}
                />
              </div>
            )}

            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason / notes for Kelly"
              style={{
                minHeight: 110,
                padding: 12,
                borderRadius: 12,
                border: '1px solid #ccc',
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />

            {message && (
              <div style={{ fontSize: 14, color: message.toLowerCase().includes('failed') ? '#b00020' : '#1b5e20' }}>
                {message}
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={busy}
              style={{
                minHeight: 50,
                borderRadius: 14,
                border: '1px solid #111',
                background: '#111',
                color: '#fff',
                fontWeight: 800,
                cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy ? 0.7 : 1,
              }}
            >
              {busy ? 'Sending...' : 'Send to Kelly'}
            </button>
          </div>
        </section>

        <section
          style={{
            background: '#fff',
            border: '1px solid #ddd',
            borderRadius: 18,
            padding: 16,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 14 }}>
            My requests
          </div>

          {loading ? (
            <div>Loading...</div>
          ) : requests.length === 0 ? (
            <div style={{ color: '#666' }}>No requests sent yet.</div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {requests.map((item) => (
                <div
                  key={item.id}
                  style={{
                    border: '1px solid #e3e3e3',
                    borderRadius: 14,
                    padding: 14,
                    background: '#fafafa',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 17 }}>
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
                      }}
                    >
                      {item.status}
                    </div>
                  </div>

                  {item.reason && (
                    <div style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>{item.reason}</div>
                  )}

                  {(item.reviewedByName || item.reviewNotes) && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: 10,
                        borderRadius: 10,
                        background: '#fff',
                        border: '1px solid #eee',
                        fontSize: 14,
                      }}
                    >
                      {item.reviewedByName && <div><strong>Reviewed by:</strong> {item.reviewedByName}</div>}
                      {item.reviewNotes && <div style={{ marginTop: 4 }}><strong>Notes:</strong> {item.reviewNotes}</div>}
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