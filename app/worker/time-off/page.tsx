'use client'

import Link from 'next/link'
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

function statusStyles(status: string) {
  const value = String(status || '').toLowerCase()

  if (value === 'approved') {
    return {
      background: '#ecfdf3',
      border: '1px solid #bbf7d0',
      color: '#166534',
    }
  }

  if (value === 'declined') {
    return {
      background: '#fef2f2',
      border: '1px solid #fecaca',
      color: '#991b1b',
    }
  }

  return {
    background: '#fffbeb',
    border: '1px solid #fde68a',
    color: '#92400e',
  }
}

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: 20,
  padding: 16,
  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 48,
  padding: '12px 14px',
  borderRadius: 14,
  border: '1px solid #d1d5db',
  background: '#ffffff',
  fontSize: 16,
  outline: 'none',
  boxSizing: 'border-box',
}

const quickLinkStyle: React.CSSProperties = {
  minHeight: 56,
  borderRadius: 16,
  border: '1px solid #e5e7eb',
  background: '#f9fafb',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  textDecoration: 'none',
  color: '#111827',
  fontSize: 14,
  fontWeight: 800,
  padding: '10px 12px',
  minWidth: 0,
  wordBreak: 'break-word',
  overflowWrap: 'break-word',
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

      if (
        requestType === 'holiday' ||
        requestType === 'day_off' ||
        requestType === 'sick'
      ) {
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
        minHeight: '100dvh',
        background: '#f3f4f6',
        padding: '16px 0 120px',
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 720,
          margin: '0 auto',
          padding: '0 16px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            background: '#111827',
            color: '#ffffff',
            borderRadius: 24,
            padding: 20,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontSize: 12,
              opacity: 0.78,
              textTransform: 'uppercase',
              fontWeight: 800,
              letterSpacing: '0.08em',
            }}
          >
            Worker requests
          </div>

          <h1
            style={{
              margin: '8px 0 6px',
              fontSize: 30,
              lineHeight: 1.05,
              fontWeight: 900,
              wordBreak: 'break-word',
            }}
          >
            Time Off
          </h1>

          <div
            style={{
              opacity: 0.86,
              fontSize: 15,
              lineHeight: 1.4,
              wordBreak: 'break-word',
            }}
          >
            Logged in as {workerName || 'Worker'}
          </div>

          <div
            style={{
              marginTop: 16,
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 10,
            }}
          >
            <Link href="/today" style={quickLinkStyle}>
              Today
            </Link>
            <Link href="/my-visits" style={quickLinkStyle}>
              My Visits
            </Link>
            <Link href="/chas" style={quickLinkStyle}>
              CHAS
            </Link>
          </div>
        </div>

        <section style={{ ...cardStyle, marginBottom: 16 }}>
          <div
            style={{
              fontWeight: 900,
              fontSize: 22,
              marginBottom: 14,
              color: '#111827',
            }}
          >
            New request
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <label
                htmlFor="requestType"
                style={{
                  display: 'block',
                  fontSize: 14,
                  fontWeight: 800,
                  color: '#374151',
                  marginBottom: 6,
                }}
              >
                Request type
              </label>
              <select
                id="requestType"
                value={requestType}
                onChange={(e) => {
                  const value = e.target.value
                  setRequestType(value)

                  if (
                    value === 'holiday' ||
                    value === 'day_off' ||
                    value === 'sick'
                  ) {
                    setIsFullDay(true)
                  }
                }}
                style={inputStyle}
              >
                <option value="holiday">Holiday</option>
                <option value="day_off">Day off</option>
                <option value="early_finish">Early finish</option>
                <option value="late_start">Late start</option>
                <option value="appointment">Appointment / part-day off</option>
                <option value="sick">Sick / emergency</option>
              </select>
            </div>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontWeight: 800,
                color: '#111827',
                background: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: 14,
                padding: '12px 14px',
              }}
            >
              <input
                type="checkbox"
                checked={isFullDay}
                onChange={(e) => setIsFullDay(e.target.checked)}
                style={{ width: 18, height: 18, flexShrink: 0 }}
              />
              <span style={{ minWidth: 0 }}>Full day</span>
            </label>

            <div
              style={{
                display: 'grid',
                gap: 12,
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              }}
            >
              <div>
                <label
                  htmlFor="startDate"
                  style={{
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 800,
                    color: '#374151',
                    marginBottom: 6,
                  }}
                >
                  Start date
                </label>
                <input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label
                  htmlFor="endDate"
                  style={{
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 800,
                    color: '#374151',
                    marginBottom: 6,
                  }}
                >
                  End date
                </label>
                <input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            {!isFullDay && (
              <div
                style={{
                  display: 'grid',
                  gap: 12,
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                }}
              >
                <div>
                  <label
                    htmlFor="startTime"
                    style={{
                      display: 'block',
                      fontSize: 14,
                      fontWeight: 800,
                      color: '#374151',
                      marginBottom: 6,
                    }}
                  >
                    Start time
                  </label>
                  <input
                    id="startTime"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label
                    htmlFor="endTime"
                    style={{
                      display: 'block',
                      fontSize: 14,
                      fontWeight: 800,
                      color: '#374151',
                      marginBottom: 6,
                    }}
                  >
                    End time
                  </label>
                  <input
                    id="endTime"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="reason"
                style={{
                  display: 'block',
                  fontSize: 14,
                  fontWeight: 800,
                  color: '#374151',
                  marginBottom: 6,
                }}
              >
                Reason / notes for Kelly
              </label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Add any useful notes here"
                style={{
                  ...inputStyle,
                  minHeight: 120,
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {message && (() => {
              const lowerMessage = message.toLowerCase()
              const isErrorMessage =
                lowerMessage.includes('failed') ||
                lowerMessage.includes('error') ||
                lowerMessage.includes('invalid') ||
                lowerMessage.includes('missing') ||
                lowerMessage.includes('not found') ||
                lowerMessage.includes('did not match')

              return (
                <div
                  style={{
                    borderRadius: 14,
                    padding: '12px 14px',
                    fontSize: 14,
                    fontWeight: 700,
                    background: isErrorMessage ? '#fef2f2' : '#ecfdf3',
                    border: isErrorMessage ? '1px solid #fecaca' : '1px solid #bbf7d0',
                    color: isErrorMessage ? '#991b1b' : '#166534',
                    wordBreak: 'break-word',
                  }}
                >
                  {message}
                </div>
              )
            })()}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={busy}
              style={{
                minHeight: 52,
                borderRadius: 16,
                border: '1px solid #111827',
                background: '#111827',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: 16,
                cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy ? 0.7 : 1,
              }}
            >
              {busy ? 'Sending...' : 'Send to Kelly'}
            </button>
          </div>
        </section>

        <section style={cardStyle}>
          <div
            style={{
              fontWeight: 900,
              fontSize: 22,
              marginBottom: 14,
              color: '#111827',
            }}
          >
            My requests
          </div>

          {loading ? (
            <div
              style={{
                color: '#4b5563',
                fontWeight: 600,
              }}
            >
              Loading...
            </div>
          ) : requests.length === 0 ? (
            <div
              style={{
                color: '#6b7280',
                background: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: 16,
                padding: 16,
              }}
            >
              No requests sent yet.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {requests.map((item) => {
                const badgeStyle = statusStyles(item.status)

                return (
                  <div
                    key={item.id}
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 18,
                      padding: 14,
                      background: '#f9fafb',
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: 12,
                          flexWrap: 'wrap',
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 900,
                              fontSize: 17,
                              color: '#111827',
                              wordBreak: 'break-word',
                            }}
                          >
                            {requestTypeLabel(item.requestType)}
                          </div>

                          <div
                            style={{
                              marginTop: 6,
                              color: '#4b5563',
                              lineHeight: 1.45,
                              wordBreak: 'break-word',
                            }}
                          >
                            {formatDate(item.startDate)}
                            {item.startDate !== item.endDate
                              ? ` → ${formatDate(item.endDate)}`
                              : ''}
                            {!item.isFullDay && item.startTime && item.endTime
                              ? ` • ${item.startTime}-${item.endTime}`
                              : ' • Full day'}
                          </div>
                        </div>

                        <div
                          style={{
                            ...badgeStyle,
                            padding: '8px 12px',
                            borderRadius: 999,
                            fontWeight: 900,
                            textTransform: 'capitalize',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.status}
                        </div>
                      </div>

                      {item.reason && (
                        <div
                          style={{
                            whiteSpace: 'pre-wrap',
                            color: '#111827',
                            lineHeight: 1.45,
                            wordBreak: 'break-word',
                          }}
                        >
                          {item.reason}
                        </div>
                      )}

                      {(item.reviewedByName || item.reviewNotes) && (
                        <div
                          style={{
                            padding: 12,
                            borderRadius: 14,
                            background: '#ffffff',
                            border: '1px solid #e5e7eb',
                            fontSize: 14,
                            color: '#374151',
                          }}
                        >
                          {item.reviewedByName && (
                            <div style={{ wordBreak: 'break-word' }}>
                              <strong>Reviewed by:</strong> {item.reviewedByName}
                            </div>
                          )}

                          {item.reviewNotes && (
                            <div
                              style={{
                                marginTop: item.reviewedByName ? 6 : 0,
                                wordBreak: 'break-word',
                                whiteSpace: 'pre-wrap',
                              }}
                            >
                              <strong>Notes:</strong> {item.reviewNotes}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}