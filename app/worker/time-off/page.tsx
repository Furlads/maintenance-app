'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

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

type RequestType = 'holiday' | 'day_off' | 'early_finish' | 'late_start' | 'appointment' | 'sick'

const WORK_DAY_START = '08:00'
const WORK_DAY_END = '16:30'
const pageFont = "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

function todayIsoDate() {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function dateInputValue(value: string) {
  const clean = String(value || '').trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(clean) ? clean : todayIsoDate()
}

function formatDate(value: string) {
  const iso = dateInputValue(value)
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function requestTypeLabel(value: string) {
  if (value === 'holiday') return 'Holiday'
  if (value === 'day_off') return 'Day off'
  if (value === 'early_finish') return 'Early finish'
  if (value === 'late_start') return 'Late start'
  if (value === 'appointment') return 'Appointment'
  if (value === 'sick') return 'Sick / emergency'
  return 'Time off'
}

function isRangeType(type: RequestType) {
  return type === 'holiday'
}

function isSingleDayFullDay(type: RequestType) {
  return type === 'day_off' || type === 'sick'
}

function isPartDay(type: RequestType) {
  return type === 'early_finish' || type === 'late_start' || type === 'appointment'
}

function isWeekend(iso: string) {
  const day = new Date(`${iso}T00:00:00.000Z`).getUTCDay()
  return day === 0 || day === 6
}

function daysBetween(fromIso: string, toIso: string) {
  const from = new Date(`${fromIso}T00:00:00.000Z`).getTime()
  const to = new Date(`${toIso}T00:00:00.000Z`).getTime()
  return Math.round((to - from) / 86400000)
}

function workingDaysBetween(startIso: string, endIso: string) {
  const start = new Date(`${startIso}T00:00:00.000Z`)
  const end = new Date(`${endIso}T00:00:00.000Z`)
  let count = 0
  for (let current = new Date(start); current <= end; current.setUTCDate(current.getUTCDate() + 1)) {
    const day = current.getUTCDay()
    if (day !== 0 && day !== 6) count += 1
  }
  return count
}

function statusStyle(status: string) {
  const value = String(status || '').toLowerCase()
  if (value === 'approved') return { background: '#ecfdf3', border: '#bbf7d0', color: '#166534' }
  if (value === 'declined') return { background: '#fef2f2', border: '#fecaca', color: '#991b1b' }
  if (value === 'cancelled') return { background: '#f3f4f6', border: '#d1d5db', color: '#4b5563' }
  return { background: '#fffbeb', border: '#fde68a', color: '#92400e' }
}

const inputStyle: React.CSSProperties = {
  width: '100%', minHeight: 52, padding: '12px 14px', borderRadius: 14,
  border: '1px solid #d1d5db', background: '#fff', color: '#111827',
  fontFamily: pageFont, fontSize: 16, fontWeight: 500, lineHeight: 1.25,
  outline: 'none', boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block', marginBottom: 6, color: '#374151', fontFamily: pageFont,
  fontSize: 14, fontWeight: 800, lineHeight: 1.3,
}

const cardStyle: React.CSSProperties = {
  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 22,
  padding: 18, boxShadow: '0 1px 2px rgba(0,0,0,.04)',
}

const quickLinkStyle: React.CSSProperties = {
  minHeight: 58, borderRadius: 16, border: '1px solid #dfe3e8', background: '#f9fafb',
  color: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center',
  textAlign: 'center', textDecoration: 'none', fontFamily: pageFont, fontSize: 14,
  fontWeight: 850, lineHeight: 1.1, padding: '10px 8px', minWidth: 0, whiteSpace: 'nowrap',
}

export default function WorkerTimeOffPage() {
  const today = useMemo(() => todayIsoDate(), [])
  const requestListRef = useRef<HTMLElement | null>(null)
  const [workerId, setWorkerId] = useState<number | null>(null)
  const [workerName, setWorkerName] = useState('')
  const [requestType, setRequestType] = useState<RequestType>('holiday')
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [startTime, setStartTime] = useState('13:00')
  const [endTime, setEndTime] = useState(WORK_DAY_END)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [sentSuccess, setSentSuccess] = useState(false)
  const [requests, setRequests] = useState<RequestItem[]>([])
  const [editingRequestId, setEditingRequestId] = useState<number | null>(null)

  const isFullDay = !isPartDay(requestType)
  const finalEndDate = isRangeType(requestType) ? endDate : startDate
  const workdayCount = workingDaysBetween(startDate, finalEndDate)
  const noticeDays = daysBetween(today, startDate)
  const weekendSelected = isWeekend(startDate) || (isRangeType(requestType) && isWeekend(endDate))
  const shortNotice = requestType !== 'sick' && noticeDays >= 0 && noticeDays < 3

  const summary = useMemo(() => {
    if (requestType === 'holiday') {
      return `${workdayCount} working day${workdayCount === 1 ? '' : 's'} requested: ${formatDate(startDate)}${startDate !== endDate ? ` to ${formatDate(endDate)}` : ''}`
    }
    if (requestType === 'early_finish') return `Finish at ${startTime} on ${formatDate(startDate)}`
    if (requestType === 'late_start') return `Start at ${endTime} on ${formatDate(startDate)}`
    if (requestType === 'appointment') return `Away ${startTime}–${endTime} on ${formatDate(startDate)}`
    return `${requestTypeLabel(requestType)} on ${formatDate(startDate)}`
  }, [requestType, startDate, endDate, startTime, endTime, workdayCount])

  async function loadRequests(id: number) {
    try {
      setLoading(true)
      const res = await fetch(`/api/time-off/my-requests?workerId=${id}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to load requests.')
      setRequests(Array.isArray(data.requests) ? data.requests : [])
    } catch (error: any) {
      setMessage(String(error?.message || 'Failed to load requests.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const savedWorkerId = Number(localStorage.getItem('workerId'))
    const savedWorkerName = localStorage.getItem('workerName') || ''
    setWorkerName(savedWorkerName)
    if (Number.isInteger(savedWorkerId) && savedWorkerId > 0) {
      setWorkerId(savedWorkerId)
      loadRequests(savedWorkerId)
    } else setLoading(false)
  }, [])

  function applyPreset(type: RequestType, date = startDate) {
    setRequestType(type)
    setEndDate(date)
    setSentSuccess(false)
    if (type === 'early_finish') { setStartTime('13:00'); setEndTime(WORK_DAY_END) }
    else if (type === 'late_start') { setStartTime(WORK_DAY_START); setEndTime('10:00') }
    else if (type === 'appointment') { setStartTime('09:00'); setEndTime('10:00') }
  }

  function resetForm() {
    setEditingRequestId(null)
    setRequestType('holiday')
    setStartDate(today)
    setEndDate(today)
    setStartTime('13:00')
    setEndTime(WORK_DAY_END)
    setReason('')
  }

  function onStartDateChange(value: string) {
    setStartDate(value)
    setSentSuccess(false)
    if (!isRangeType(requestType) || endDate < value) setEndDate(value)
  }

  async function handleSubmit() {
    if (!workerId) return setMessage('No worker is logged in on this device.')
    if (finalEndDate < startDate) return setMessage('End date cannot be before start date.')
    if (!isFullDay && (!startTime || !endTime || endTime <= startTime)) return setMessage('Please check the times for this request.')

    setBusy(true)
    setMessage('')
    setSentSuccess(false)

    try {
      const isEditing = editingRequestId !== null
      const res = await fetch(isEditing ? `/api/time-off/${editingRequestId}` : '/api/time-off/request', {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerId, requestedByName: workerName, requestType, isFullDay, startDate, endDate: finalEndDate, startTime: isFullDay ? null : startTime, endTime: isFullDay ? null : endTime, reason }),
      })
      const data = await res.json()
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to save request.')

      setSentSuccess(true)
      setMessage(isEditing ? 'Request updated successfully.' : 'Sent to Kelly for approval.')
      resetForm()
      await loadRequests(workerId)
      setTimeout(() => requestListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
    } catch (error: any) {
      setMessage(String(error?.message || 'Failed to save request.'))
    } finally {
      setBusy(false)
    }
  }

  function startEditing(item: RequestItem) {
    const type = item.requestType as RequestType
    setEditingRequestId(item.id)
    setRequestType(type)
    setStartDate(dateInputValue(item.startDate))
    setEndDate(dateInputValue(item.endDate))
    setStartTime(item.startTime || (type === 'late_start' ? WORK_DAY_START : '13:00'))
    setEndTime(item.endTime || (type === 'late_start' ? '10:00' : WORK_DAY_END))
    setReason(item.reason || '')
    setSentSuccess(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function cancelRequest(id: number) {
    if (!workerId || !window.confirm('Cancel this request?')) return
    try {
      const res = await fetch(`/api/time-off/${id}?workerId=${workerId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to cancel request.')
      setMessage('Request cancelled.')
      setSentSuccess(false)
      await loadRequests(workerId)
    } catch (error: any) {
      setMessage(String(error?.message || 'Failed to cancel request.'))
    }
  }

  const timeHelp = requestType === 'early_finish'
    ? 'Choose the time you want to finish. The request runs from then until the normal end of the day.'
    : requestType === 'late_start'
      ? 'Choose the time you expect to arrive. The request covers the start of the day until then.'
      : 'Choose the time you will be away and the time you expect to be back.'

  return (
    <main style={{ minHeight: '100dvh', background: '#f3f4f6', padding: '16px 0 120px', fontFamily: pageFont, color: '#111827' }}>
      <div style={{ width: '100%', maxWidth: 720, margin: '0 auto', padding: '0 16px', boxSizing: 'border-box' }}>
        <header style={{ background: '#111827', borderRadius: 24, padding: 20, marginBottom: 16 }}>
          <div style={{ color: '#cbd5e1', fontSize: 12, lineHeight: 1.2, textTransform: 'uppercase', fontWeight: 850, letterSpacing: '.08em' }}>Worker requests</div>
          <h1 style={{ margin: '8px 0 6px', color: '#fff', fontFamily: pageFont, fontSize: 'clamp(30px, 9vw, 42px)', lineHeight: 1, fontWeight: 900, letterSpacing: '-.035em' }}>Time Off</h1>
          <div style={{ color: '#e5e7eb', fontSize: 16, lineHeight: 1.4, fontWeight: 500 }}>Logged in as {workerName || 'Worker'}</div>
          <nav style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
            <Link href="/today" style={quickLinkStyle}>Today</Link>
            <Link href="/my-visits" style={quickLinkStyle}>My Visits</Link>
            <Link href="/chas" style={quickLinkStyle}>Chas</Link>
          </nav>
        </header>

        <section style={{ ...cardStyle, marginBottom: 16 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 24, lineHeight: 1.15, fontWeight: 900, letterSpacing: '-.02em' }}>{editingRequestId ? 'Edit request' : 'New request'}</h2>
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <label htmlFor="requestType" style={labelStyle}>Request type</label>
              <select id="requestType" value={requestType} onChange={(e) => applyPreset(e.target.value as RequestType)} style={inputStyle}>
                <option value="holiday">Holiday</option>
                <option value="day_off">Day off</option>
                <option value="early_finish">Early finish</option>
                <option value="late_start">Late start</option>
                <option value="appointment">Appointment / part-day off</option>
                <option value="sick">Sick / emergency</option>
              </select>
            </div>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: isRangeType(requestType) ? 'repeat(auto-fit, minmax(180px, 1fr))' : '1fr' }}>
              <div>
                <label htmlFor="startDate" style={labelStyle}>{isRangeType(requestType) ? 'Start date' : 'Date'}</label>
                <input id="startDate" type="date" value={startDate} onChange={(e) => onStartDateChange(e.target.value)} style={inputStyle} />
              </div>
              {isRangeType(requestType) && <div><label htmlFor="endDate" style={labelStyle}>End date</label><input id="endDate" type="date" min={startDate} value={endDate} onChange={(e) => { setEndDate(e.target.value); setSentSuccess(false) }} style={inputStyle} /></div>}
            </div>

            {isPartDay(requestType) && (
              <div style={{ padding: 14, borderRadius: 16, border: '1px solid #e5e7eb', background: '#f8fafc' }}>
                <div style={{ marginBottom: 12, color: '#64748b', fontSize: 13, lineHeight: 1.4, fontWeight: 650 }}>{timeHelp}</div>
                {requestType === 'early_finish' ? (
                  <div><label htmlFor="finishTime" style={labelStyle}>Finish work at</label><input id="finishTime" type="time" value={startTime} max={WORK_DAY_END} onChange={(e) => { setStartTime(e.target.value); setEndTime(WORK_DAY_END) }} style={inputStyle} /></div>
                ) : requestType === 'late_start' ? (
                  <div><label htmlFor="arrivalTime" style={labelStyle}>Start work at</label><input id="arrivalTime" type="time" value={endTime} min={WORK_DAY_START} onChange={(e) => { setStartTime(WORK_DAY_START); setEndTime(e.target.value) }} style={inputStyle} /></div>
                ) : (
                  <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                    <div><label htmlFor="startTime" style={labelStyle}>Away from</label><input id="startTime" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={inputStyle} /></div>
                    <div><label htmlFor="endTime" style={labelStyle}>Back at</label><input id="endTime" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={inputStyle} /></div>
                  </div>
                )}
              </div>
            )}

            {(isSingleDayFullDay(requestType) || isRangeType(requestType)) && <div style={{ padding: '11px 13px', borderRadius: 14, background: '#f8fafc', border: '1px solid #e5e7eb', color: '#475569', fontSize: 13, lineHeight: 1.4, fontWeight: 650 }}>{requestType === 'holiday' ? `Holiday is treated as full days. ${workdayCount} working day${workdayCount === 1 ? '' : 's'} selected.` : 'This request is automatically treated as a full day.'}</div>}

            {weekendSelected && <div style={{ padding: '12px 14px', borderRadius: 14, background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', fontSize: 14, lineHeight: 1.4, fontWeight: 750 }}>⚠️ One of the selected dates falls on a weekend. Check that this is intentional before sending.</div>}
            {shortNotice && <div style={{ padding: '12px 14px', borderRadius: 14, background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', fontSize: 14, lineHeight: 1.4, fontWeight: 750 }}>⚠️ Short-notice request. Please speak to Kelly as well so jobs can be planned properly.</div>}

            <div style={{ padding: 14, borderRadius: 16, background: '#eef2ff', border: '1px solid #c7d2fe' }}>
              <div style={{ color: '#4338ca', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 5 }}>Check before sending</div>
              <div style={{ color: '#1e1b4b', fontSize: 16, lineHeight: 1.4, fontWeight: 800 }}>{summary}</div>
            </div>

            <div><label htmlFor="reason" style={labelStyle}>Reason / notes for Kelly</label><textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Add any useful notes here" style={{ ...inputStyle, minHeight: 120, resize: 'vertical' }} /></div>

            {message && <div style={{ borderRadius: 14, padding: '12px 14px', background: sentSuccess ? '#ecfdf3' : '#f8fafc', border: sentSuccess ? '1px solid #bbf7d0' : '1px solid #dbe3ec', color: sentSuccess ? '#166534' : '#334155', fontSize: 14, lineHeight: 1.4, fontWeight: 800 }}>{sentSuccess ? '✓ ' : ''}{message}</div>}

            <button type="button" onClick={handleSubmit} disabled={busy} style={{ minHeight: 54, borderRadius: 16, border: '1px solid #111827', background: '#111827', color: '#fff', fontFamily: pageFont, fontSize: 16, fontWeight: 900, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? .65 : 1 }}>{busy ? 'Saving...' : editingRequestId ? 'Update request' : 'Send to Kelly'}</button>
            {editingRequestId && <button type="button" onClick={resetForm} disabled={busy} style={{ minHeight: 50, borderRadius: 16, border: '1px solid #d1d5db', background: '#fff', color: '#111827', fontFamily: pageFont, fontSize: 16, fontWeight: 850 }}>Cancel editing</button>}
          </div>
        </section>

        <section ref={requestListRef} style={cardStyle}>
          <h2 style={{ margin: '0 0 14px', fontSize: 24, lineHeight: 1.15, fontWeight: 900, letterSpacing: '-.02em' }}>My requests</h2>
          {loading ? <div style={{ color: '#64748b', fontWeight: 650 }}>Loading...</div> : requests.length === 0 ? <div style={{ padding: 16, borderRadius: 16, background: '#f8fafc', border: '1px solid #e5e7eb', color: '#64748b' }}>No requests sent yet.</div> : (
            <div style={{ display: 'grid', gap: 12 }}>
              {requests.map((item) => {
                const pending = String(item.status).toLowerCase() === 'pending'
                const badge = statusStyle(item.status)
                return (
                  <article key={item.id} style={{ padding: 14, borderRadius: 18, background: '#f8fafc', border: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 17, lineHeight: 1.25, fontWeight: 900 }}>{requestTypeLabel(item.requestType)}</div>
                        <div style={{ marginTop: 5, color: '#64748b', fontSize: 14, lineHeight: 1.45, fontWeight: 600 }}>{formatDate(item.startDate)}{item.startDate !== item.endDate ? ` → ${formatDate(item.endDate)}` : ''}{!item.isFullDay && item.startTime && item.endTime ? ` • ${item.startTime}–${item.endTime}` : ' • Full day'}</div>
                      </div>
                      <div style={{ padding: '7px 11px', borderRadius: 999, background: badge.background, border: `1px solid ${badge.border}`, color: badge.color, fontSize: 13, lineHeight: 1, fontWeight: 850, textTransform: 'capitalize' }}>{item.status}</div>
                    </div>
                    {item.reason && <div style={{ marginTop: 10, whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.45 }}>{item.reason}</div>}
                    {(item.reviewedByName || item.reviewNotes) && <div style={{ marginTop: 10, padding: 11, borderRadius: 12, background: '#fff', border: '1px solid #e5e7eb', color: '#475569', fontSize: 13, lineHeight: 1.45 }}>{item.reviewedByName && <div><strong>Reviewed by:</strong> {item.reviewedByName}</div>}{item.reviewNotes && <div><strong>Notes:</strong> {item.reviewNotes}</div>}</div>}
                    {pending && <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}><button type="button" onClick={() => startEditing(item)} style={{ minHeight: 42, padding: '0 16px', borderRadius: 12, border: '1px solid #111827', background: '#fff', fontFamily: pageFont, fontWeight: 800 }}>Edit</button><button type="button" onClick={() => cancelRequest(item.id)} style={{ minHeight: 42, padding: '0 16px', borderRadius: 12, border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', fontFamily: pageFont, fontWeight: 800 }}>Cancel</button></div>}
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
