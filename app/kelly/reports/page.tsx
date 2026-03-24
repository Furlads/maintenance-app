'use client'

import { useEffect, useMemo, useState } from 'react'

type CannotCompleteInfo = {
  reason: string
  details: string
  reportedBy: string
  recordedAt: string
}

type ReportNote = {
  id: number
  note: string
  createdAt: string
  createdByWorkerName: string | null
}

type ReportPhoto = {
  id: number
  imageUrl: string
  label: string | null
  createdAt: string
  uploadedByWorkerName: string | null
}

type ReportItem = {
  id: number
  title: string
  jobType: string
  status: string
  address: string
  visitDate: string | null
  finishedAt: string | null
  createdAt: string
  customer: {
    id: number
    name: string
    phone: string | null
    email: string | null
    address: string | null
    postcode: string | null
  }
  assignedWorkers: string[]
  notes: string | null
  cannotCompleteInfo: CannotCompleteInfo | null
  reportNotes: ReportNote[]
  photos: ReportPhoto[]
}

type ReportsResponse = {
  preset: string
  label: string
  from: string
  toExclusive: string
  totalReports: number
  totalPhotos: number
  totalReportNotes: number
  reports: ReportItem[]
}

type Preset = 'today' | 'week' | 'month' | 'custom'

function formatDateTime(value?: string | null) {
  if (!value) return '—'

  try {
    return new Date(value).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return value
  }
}

function formatDate(value?: string | null) {
  if (!value) return '—'

  try {
    return new Date(value).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return value
  }
}

function formatStatus(value: string) {
  if (!value) return 'Unknown'

  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function todayDateInputValue() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getWeekStartValue() {
  const now = new Date()
  const clone = new Date(now)
  const day = clone.getDay()
  const offset = day === 0 ? -6 : 1 - day
  clone.setDate(clone.getDate() + offset)

  const year = clone.getFullYear()
  const month = String(clone.getMonth() + 1).padStart(2, '0')
  const date = String(clone.getDate()).padStart(2, '0')
  return `${year}-${month}-${date}`
}

export default function KellyReportsPage() {
  const [preset, setPreset] = useState<Preset>('today')
  const [fromDate, setFromDate] = useState(getWeekStartValue())
  const [toDate, setToDate] = useState(todayDateInputValue())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState<ReportsResponse | null>(null)

  const queryString = useMemo(() => {
    if (preset === 'custom') {
      const params = new URLSearchParams({
        preset: 'custom',
        from: fromDate,
        to: toDate,
      })

      return params.toString()
    }

    return new URLSearchParams({ preset }).toString()
  }, [preset, fromDate, toDate])

  useEffect(() => {
    async function loadReports() {
      setLoading(true)
      setError('')

      try {
        const res = await fetch(`/api/reports?${queryString}`, {
          cache: 'no-store',
        })

        const json = await res.json()

        if (!res.ok) {
          throw new Error(json?.error || 'Failed to load reports')
        }

        setData(json)
      } catch (err) {
        console.error(err)
        setError(err instanceof Error ? err.message : 'Failed to load reports')
        setData(null)
      } finally {
        setLoading(false)
      }
    }

    loadReports()
  }, [queryString])

  const summaryText = data
    ? `${data.totalReports} report${data.totalReports === 1 ? '' : 's'} • ${data.totalReportNotes} note${data.totalReportNotes === 1 ? '' : 's'} • ${data.totalPhotos} photo${data.totalPhotos === 1 ? '' : 's'}`
    : ''

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f5f5f5',
        padding: 12,
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <section
          style={{
            background: 'linear-gradient(135deg, #111 0%, #1e1e1e 100%)',
            color: '#fff',
            borderRadius: 20,
            padding: 18,
            marginBottom: 16,
            boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
            border: '1px solid #222',
          }}
        >
          <div style={{ marginBottom: 12 }}>
            <a
              href="/kelly"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                textDecoration: 'none',
                color: 'rgba(255,255,255,0.78)',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              ← Back to Kelly
            </a>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
              alignItems: 'flex-start',
            }}
          >
            <div style={{ flex: '1 1 320px' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  borderRadius: 999,
                  background: 'rgba(255, 204, 0, 0.14)',
                  color: '#ffcc00',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 0.3,
                  marginBottom: 12,
                }}
              >
                KELLY REPORTS
              </div>

              <h1
                style={{
                  fontSize: 32,
                  lineHeight: 1.1,
                  margin: '0 0 8px 0',
                }}
              >
                End of job reports
              </h1>

              <p
                style={{
                  margin: 0,
                  color: 'rgba(255,255,255,0.78)',
                  fontSize: 15,
                }}
              >
                Pull finished work by day, week, month, or custom range.
              </p>
            </div>

            <div
              style={{
                flex: '0 1 360px',
                minWidth: 280,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16,
                padding: 14,
              }}
            >
              <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 6 }}>
                Current range
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
                {data?.label || 'Loading...'}
              </div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.78)' }}>
                {data
                  ? `${formatDate(data.from)} to ${formatDate(
                      new Date(
                        new Date(data.toExclusive).getTime() - 86400000
                      ).toISOString()
                    )}`
                  : '—'}
              </div>
            </div>
          </div>
        </section>

        <section
          style={{
            background: '#fff',
            border: '1px solid #e7e7e7',
            borderRadius: 18,
            padding: 16,
            marginBottom: 16,
            boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              marginBottom: 14,
            }}
          >
            {(['today', 'week', 'month', 'custom'] as Preset[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setPreset(value)}
                style={{
                  padding: '10px 14px',
                  borderRadius: 999,
                  border:
                    preset === value ? '1px solid #111' : '1px solid #d8d8d8',
                  background: preset === value ? '#ffcc00' : '#fff',
                  color: '#111',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {value === 'today'
                  ? 'Today'
                  : value === 'week'
                    ? 'This Week'
                    : value === 'month'
                      ? 'This Month'
                      : 'Custom'}
              </button>
            ))}
          </div>

          {preset === 'custom' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 12,
                marginBottom: 12,
              }}
            >
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#555' }}>
                  From
                </span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  style={{
                    height: 44,
                    borderRadius: 12,
                    border: '1px solid #d8d8d8',
                    padding: '0 12px',
                    fontSize: 15,
                  }}
                />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#555' }}>
                  To
                </span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  style={{
                    height: 44,
                    borderRadius: 12,
                    border: '1px solid #d8d8d8',
                    padding: '0 12px',
                    fontSize: 15,
                  }}
                />
              </label>
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
            }}
          >
            <div
              style={{
                background: '#fafafa',
                border: '1px solid #efefef',
                borderRadius: 14,
                padding: 14,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#777',
                  marginBottom: 6,
                  textTransform: 'uppercase',
                  letterSpacing: 0.3,
                }}
              >
                Reports
              </div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>
                {data?.totalReports ?? 0}
              </div>
            </div>

            <div
              style={{
                background: '#fafafa',
                border: '1px solid #efefef',
                borderRadius: 14,
                padding: 14,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#777',
                  marginBottom: 6,
                  textTransform: 'uppercase',
                  letterSpacing: 0.3,
                }}
              >
                Report notes
              </div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>
                {data?.totalReportNotes ?? 0}
              </div>
            </div>

            <div
              style={{
                background: '#fafafa',
                border: '1px solid #efefef',
                borderRadius: 14,
                padding: 14,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#777',
                  marginBottom: 6,
                  textTransform: 'uppercase',
                  letterSpacing: 0.3,
                }}
              >
                Photos
              </div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>
                {data?.totalPhotos ?? 0}
              </div>
            </div>
          </div>
        </section>

        <section
          style={{
            background: '#fff',
            border: '1px solid #e7e7e7',
            borderRadius: 18,
            padding: 16,
            boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              alignItems: 'center',
              flexWrap: 'wrap',
              marginBottom: 16,
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: 22 }}>Reports list</h2>
              <div style={{ fontSize: 14, color: '#666', marginTop: 4 }}>
                {summaryText || 'Loading...'}
              </div>
            </div>
          </div>

          {loading && <p style={{ margin: 0 }}>Loading reports...</p>}

          {!loading && error && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 12,
                background: '#fff4f4',
                border: '1px solid #f0c9c9',
                color: '#333',
              }}
            >
              {error}
            </div>
          )}

          {!loading && !error && data && data.reports.length === 0 && (
            <p style={{ margin: 0 }}>No completed job reports found for this range.</p>
          )}

          {!loading &&
            !error &&
            data &&
            data.reports.map((report) => (
              <article
                key={report.id}
                style={{
                  border: '1px solid #e6e6e6',
                  borderRadius: 16,
                  padding: 16,
                  background: '#fafafa',
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    marginBottom: 12,
                  }}
                >
                  <div style={{ flex: '1 1 320px', minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 8,
                        marginBottom: 10,
                      }}
                    >
                      <div
                        style={{
                          padding: '6px 10px',
                          borderRadius: 999,
                          background: '#fff',
                          border: '1px solid #ddd',
                          fontSize: 12,
                          fontWeight: 700,
                          color: '#555',
                        }}
                      >
                        {formatStatus(report.status)}
                      </div>

                      <div
                        style={{
                          padding: '6px 10px',
                          borderRadius: 999,
                          background: '#fff8d9',
                          border: '1px solid #ffe27a',
                          fontSize: 12,
                          fontWeight: 800,
                          color: '#6a5600',
                        }}
                      >
                        {report.jobType || 'Job'}
                      </div>
                    </div>

                    <h3
                      style={{
                        margin: '0 0 6px 0',
                        fontSize: 22,
                        color: '#111',
                        wordBreak: 'break-word',
                      }}
                    >
                      {report.customer.name}
                    </h3>

                    <div style={{ fontSize: 15, color: '#444', marginBottom: 6 }}>
                      <strong>Job:</strong> {report.title}
                    </div>

                    <div style={{ fontSize: 14, color: '#555', whiteSpace: 'pre-line' }}>
                      {report.address || report.customer.address || 'No address saved'}
                    </div>
                  </div>

                  <div
                    style={{
                      flex: '0 1 280px',
                      minWidth: 240,
                      background: '#fff',
                      border: '1px solid #ececec',
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <div style={{ fontSize: 14, marginBottom: 6 }}>
                      <strong>Finished:</strong> {formatDateTime(report.finishedAt)}
                    </div>
                    <div style={{ fontSize: 14, marginBottom: 6 }}>
                      <strong>Visit date:</strong> {formatDate(report.visitDate)}
                    </div>
                    <div style={{ fontSize: 14, marginBottom: 6 }}>
                      <strong>Workers:</strong>{' '}
                      {report.assignedWorkers.length > 0
                        ? report.assignedWorkers.join(', ')
                        : 'Not assigned'}
                    </div>
                    <div style={{ fontSize: 14 }}>
                      <strong>Customer record:</strong>{' '}
                      <a
                        href={`/customers/${report.customer.id}`}
                        style={{
                          color: '#111',
                          fontWeight: 700,
                        }}
                      >
                        View customer
                      </a>
                    </div>
                  </div>
                </div>

                {report.cannotCompleteInfo && (
                  <div
                    style={{
                      marginBottom: 12,
                      padding: 12,
                      borderRadius: 12,
                      border: '1px solid #e09b00',
                      background: '#fff4d6',
                    }}
                  >
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>
                      ⚠ Job could not be completed
                    </div>

                    <div style={{ fontSize: 14, marginBottom: 4 }}>
                      <strong>Reason:</strong>{' '}
                      {report.cannotCompleteInfo.reason || 'Not provided'}
                    </div>

                    {report.cannotCompleteInfo.details && (
                      <div style={{ fontSize: 14, marginBottom: 4 }}>
                        <strong>Details:</strong> {report.cannotCompleteInfo.details}
                      </div>
                    )}

                    {report.cannotCompleteInfo.reportedBy && (
                      <div style={{ fontSize: 14, marginBottom: 4 }}>
                        <strong>Reported by:</strong>{' '}
                        {report.cannotCompleteInfo.reportedBy}
                      </div>
                    )}

                    {report.cannotCompleteInfo.recordedAt && (
                      <div style={{ fontSize: 14 }}>
                        <strong>Recorded at:</strong>{' '}
                        {report.cannotCompleteInfo.recordedAt}
                      </div>
                    )}
                  </div>
                )}

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: 12,
                  }}
                >
                  <section
                    style={{
                      background: '#fff',
                      border: '1px solid #ececec',
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#777',
                        marginBottom: 8,
                        textTransform: 'uppercase',
                        letterSpacing: 0.3,
                      }}
                    >
                      Main job notes
                    </div>

                    <div
                      style={{
                        fontSize: 14,
                        color: '#444',
                        whiteSpace: 'pre-line',
                      }}
                    >
                      {report.notes || 'No main job notes.'}
                    </div>
                  </section>

                  <section
                    style={{
                      background: '#fff',
                      border: '1px solid #ececec',
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#777',
                        marginBottom: 8,
                        textTransform: 'uppercase',
                        letterSpacing: 0.3,
                      }}
                    >
                      End of job report notes
                    </div>

                    {report.reportNotes.length === 0 ? (
                      <div style={{ fontSize: 14, color: '#444' }}>
                        No report notes added.
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gap: 10 }}>
                        {report.reportNotes.map((note) => (
                          <div
                            key={note.id}
                            style={{
                              background: '#fafafa',
                              border: '1px solid #efefef',
                              borderRadius: 10,
                              padding: 10,
                            }}
                          >
                            <div
                              style={{
                                fontSize: 13,
                                color: '#666',
                                marginBottom: 6,
                              }}
                            >
                              {formatDateTime(note.createdAt)}
                              {note.createdByWorkerName
                                ? ` • ${note.createdByWorkerName}`
                                : ''}
                            </div>

                            <div
                              style={{
                                fontSize: 14,
                                color: '#333',
                                whiteSpace: 'pre-line',
                              }}
                            >
                              {note.note || 'No text'}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>

                <section
                  style={{
                    marginTop: 12,
                    background: '#fff',
                    border: '1px solid #ececec',
                    borderRadius: 12,
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#777',
                      marginBottom: 8,
                      textTransform: 'uppercase',
                      letterSpacing: 0.3,
                    }}
                  >
                    Photos
                  </div>

                  {report.photos.length === 0 ? (
                    <div style={{ fontSize: 14, color: '#444' }}>
                      No photos uploaded.
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: 12,
                      }}
                    >
                      {report.photos.map((photo) => (
                        <div
                          key={photo.id}
                          style={{
                            border: '1px solid #efefef',
                            borderRadius: 12,
                            padding: 10,
                            background: '#fafafa',
                          }}
                        >
                          <img
                            src={photo.imageUrl}
                            alt={photo.label || report.title}
                            style={{
                              width: '100%',
                              height: 160,
                              objectFit: 'cover',
                              borderRadius: 10,
                              display: 'block',
                              border: '1px solid #ddd',
                              marginBottom: 8,
                            }}
                          />

                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: '#333',
                              marginBottom: 4,
                            }}
                          >
                            {photo.label || 'Job photo'}
                          </div>

                          <div style={{ fontSize: 12, color: '#666' }}>
                            {formatDateTime(photo.createdAt)}
                          </div>

                          {photo.uploadedByWorkerName && (
                            <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                              Uploaded by {photo.uploadedByWorkerName}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </article>
            ))}
        </section>
      </div>
    </main>
  )
}