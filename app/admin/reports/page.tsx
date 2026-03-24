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

function csvCell(value: unknown) {
  const text = String(value ?? '')
  const escaped = text.replace(/"/g, '""')
  return `"${escaped}"`
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)

  URL.revokeObjectURL(url)
}

function buildCsvFilename(data: ReportsResponse | null) {
  if (!data) return 'job-reports.csv'

  const from = data.from.slice(0, 10)
  const toInclusive = new Date(new Date(data.toExclusive).getTime() - 86400000)
    .toISOString()
    .slice(0, 10)

  return `job-reports-${data.preset}-${from}-to-${toInclusive}.csv`
}

function buildCsv(data: ReportsResponse) {
  const headers = [
    'Job ID',
    'Customer',
    'Job Title',
    'Job Type',
    'Status',
    'Address',
    'Customer Address',
    'Postcode',
    'Customer Phone',
    'Customer Email',
    'Visit Date',
    'Finished At',
    'Assigned Workers',
    'Main Job Notes',
    'Report Notes Count',
    'Report Notes',
    'Photos Count',
    'Photo Labels',
    'Cannot Complete Reason',
    'Cannot Complete Details',
    'Cannot Complete Reported By',
    'Cannot Complete Recorded At',
    'Customer Record URL',
  ]

  const rows = data.reports.map((report) => {
    const reportNotesText = report.reportNotes
      .map((note) => {
        const author = note.createdByWorkerName ? ` (${note.createdByWorkerName})` : ''
        return `${formatDateTime(note.createdAt)}${author}: ${note.note}`
      })
      .join('\n\n')

    const photoLabels = report.photos
      .map((photo) => photo.label || 'Job photo')
      .join(', ')

    return [
      report.id,
      report.customer.name,
      report.title,
      report.jobType,
      report.status,
      report.address,
      report.customer.address || '',
      report.customer.postcode || '',
      report.customer.phone || '',
      report.customer.email || '',
      report.visitDate ? formatDate(report.visitDate) : '',
      report.finishedAt ? formatDateTime(report.finishedAt) : '',
      report.assignedWorkers.join(', '),
      report.notes || '',
      report.reportNotes.length,
      reportNotesText,
      report.photos.length,
      photoLabels,
      report.cannotCompleteInfo?.reason || '',
      report.cannotCompleteInfo?.details || '',
      report.cannotCompleteInfo?.reportedBy || '',
      report.cannotCompleteInfo?.recordedAt || '',
      `/customers/${report.customer.id}`,
    ]
  })

  return [headers, ...rows]
    .map((row) => row.map((value) => csvCell(value)).join(','))
    .join('\n')
}

export default function AdminReportsPage() {
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

  function handleExportPdf() {
    window.print()
  }

  function handleExportCsv() {
    if (!data) return

    const csv = buildCsv(data)
    const filename = buildCsvFilename(data)
    downloadTextFile(filename, csv, 'text/csv;charset=utf-8;')
  }

  const summaryText = data
    ? `${data.totalReports} report${data.totalReports === 1 ? '' : 's'} • ${data.totalReportNotes} note${data.totalReportNotes === 1 ? '' : 's'} • ${data.totalPhotos} photo${data.totalPhotos === 1 ? '' : 's'}`
    : ''

  return (
    <main className="min-h-screen bg-zinc-50 p-4 print:bg-white print:p-0 sm:p-6">
      <style jsx global>{`
        @page {
          size: A4;
          margin: 12mm;
        }

        @media print {
          nav,
          header,
          footer {
            display: none !important;
          }

          .print-hide {
            display: none !important;
          }

          .print-break-inside-avoid {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          body {
            background: white !important;
          }
        }
      `}</style>

      <div className="mx-auto max-w-7xl space-y-4 print:max-w-none print:space-y-3">
        <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-800 p-5 text-white shadow-sm print:rounded-none print:border print:bg-white print:p-4 print:text-black print:shadow-none">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-zinc-300 print:text-zinc-500">
                Reports
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                End of job reports
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300 print:text-zinc-600">
                Pull completed job reports by today, this week, this month, or a custom
                date range.
              </p>
            </div>

            <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/10 p-4 print:max-w-none print:border-zinc-200 print:bg-zinc-50">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-300 print:text-zinc-500">
                Current range
              </div>
              <div className="mt-2 text-xl font-bold">{data?.label || 'Loading...'}</div>
              <div className="mt-1 text-sm text-zinc-300 print:text-zinc-600">
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

        <section className="print-hide rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap gap-2">
            {(['today', 'week', 'month', 'custom'] as Preset[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setPreset(value)}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                  preset === value
                    ? 'bg-zinc-900 text-white'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                {value === 'today'
                  ? 'Today'
                  : value === 'week'
                    ? 'This week'
                    : value === 'month'
                      ? 'This month'
                      : 'Custom'}
              </button>
            ))}
          </div>

          {preset === 'custom' && (
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-zinc-700">From</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="h-11 rounded-xl border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-500"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-zinc-700">To</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="h-11 rounded-xl border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-500"
                />
              </label>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">
                Reports
              </div>
              <div className="mt-2 text-3xl font-bold tracking-tight text-zinc-900">
                {data?.totalReports ?? 0}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">
                Report notes
              </div>
              <div className="mt-2 text-3xl font-bold tracking-tight text-zinc-900">
                {data?.totalReportNotes ?? 0}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">
                Photos
              </div>
              <div className="mt-2 text-3xl font-bold tracking-tight text-zinc-900">
                {data?.totalPhotos ?? 0}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm print:rounded-none print:border print:p-3 print:shadow-none">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-zinc-900">Reports list</h2>
              <p className="text-sm text-zinc-500">{summaryText || 'Loading...'}</p>
            </div>

            <div className="print-hide flex flex-wrap gap-2">
              <a
                href="/admin"
                className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100"
              >
                Back to admin dashboard
              </a>

              <button
                type="button"
                onClick={handleExportPdf}
                className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100"
              >
                Export PDF
              </button>

              <button
                type="button"
                onClick={handleExportCsv}
                disabled={!data || data.reports.length === 0}
                className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  !data || data.reports.length === 0
                    ? 'cursor-not-allowed border border-zinc-200 bg-zinc-100 text-zinc-400'
                    : 'border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100'
                }`}
              >
                Export CSV
              </button>
            </div>
          </div>

          {loading && <p className="text-sm text-zinc-600">Loading reports...</p>}

          {!loading && error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {!loading && !error && data && data.reports.length === 0 && (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-sm text-zinc-600">
              No completed job reports found for this range.
            </div>
          )}

          {!loading && !error && data && (
            <div className="space-y-4">
              {data.reports.map((report) => (
                <article
                  key={report.id}
                  className="print-break-inside-avoid rounded-3xl border border-zinc-200 bg-zinc-50 p-4"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-zinc-900 px-2.5 py-1 text-[11px] font-semibold text-white print:border print:border-zinc-300 print:bg-white print:text-zinc-900">
                          {formatStatus(report.status)}
                        </span>
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200 print:border print:border-zinc-300 print:bg-white print:text-zinc-900 print:ring-0">
                          {report.jobType || 'Job'}
                        </span>
                      </div>

                      <h3 className="mt-3 text-xl font-bold text-zinc-900">
                        {report.customer.name}
                      </h3>

                      <p className="mt-1 text-sm text-zinc-600">
                        <span className="font-semibold text-zinc-800">Job:</span> {report.title}
                      </p>

                      <p className="mt-1 whitespace-pre-line text-sm text-zinc-500">
                        {report.address || report.customer.address || 'No address saved'}
                      </p>
                    </div>

                    <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-4">
                      <div className="space-y-2 text-sm text-zinc-700">
                        <div>
                          <span className="font-semibold">Finished:</span>{' '}
                          {formatDateTime(report.finishedAt)}
                        </div>
                        <div>
                          <span className="font-semibold">Visit date:</span>{' '}
                          {formatDate(report.visitDate)}
                        </div>
                        <div>
                          <span className="font-semibold">Workers:</span>{' '}
                          {report.assignedWorkers.length > 0
                            ? report.assignedWorkers.join(', ')
                            : 'Not assigned'}
                        </div>
                        <div>
                          <span className="font-semibold">Customer record:</span>{' '}
                          <a
                            href={`/customers/${report.customer.id}`}
                            className="font-semibold text-zinc-900 underline underline-offset-2"
                          >
                            View customer
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>

                  {report.cannotCompleteInfo && (
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 print:border-zinc-300 print:bg-white">
                      <div className="font-bold text-amber-900 print:text-zinc-900">
                        Job could not be completed
                      </div>
                      <div className="mt-2 space-y-1 text-sm text-amber-900 print:text-zinc-700">
                        <div>
                          <span className="font-semibold">Reason:</span>{' '}
                          {report.cannotCompleteInfo.reason || 'Not provided'}
                        </div>

                        {report.cannotCompleteInfo.details && (
                          <div>
                            <span className="font-semibold">Details:</span>{' '}
                            {report.cannotCompleteInfo.details}
                          </div>
                        )}

                        {report.cannotCompleteInfo.reportedBy && (
                          <div>
                            <span className="font-semibold">Reported by:</span>{' '}
                            {report.cannotCompleteInfo.reportedBy}
                          </div>
                        )}

                        {report.cannotCompleteInfo.recordedAt && (
                          <div>
                            <span className="font-semibold">Recorded at:</span>{' '}
                            {report.cannotCompleteInfo.recordedAt}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    <section className="rounded-2xl border border-zinc-200 bg-white p-4">
                      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">
                        Main job notes
                      </div>
                      <div className="mt-3 whitespace-pre-line text-sm text-zinc-700">
                        {report.notes || 'No main job notes.'}
                      </div>
                    </section>

                    <section className="rounded-2xl border border-zinc-200 bg-white p-4">
                      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">
                        End of job report notes
                      </div>

                      {report.reportNotes.length === 0 ? (
                        <div className="mt-3 text-sm text-zinc-700">
                          No report notes added.
                        </div>
                      ) : (
                        <div className="mt-3 space-y-3">
                          {report.reportNotes.map((note) => (
                            <div
                              key={note.id}
                              className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3"
                            >
                              <div className="text-xs text-zinc-500">
                                {formatDateTime(note.createdAt)}
                                {note.createdByWorkerName
                                  ? ` • ${note.createdByWorkerName}`
                                  : ''}
                              </div>

                              <div className="mt-2 whitespace-pre-line text-sm text-zinc-700">
                                {note.note || 'No text'}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  </div>

                  <section className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">
                      Photos
                    </div>

                    {report.photos.length === 0 ? (
                      <div className="mt-3 text-sm text-zinc-700">No photos uploaded.</div>
                    ) : (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {report.photos.map((photo) => (
                          <div
                            key={photo.id}
                            className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3"
                          >
                            <img
                              src={photo.imageUrl}
                              alt={photo.label || report.title}
                              className="h-44 w-full rounded-xl border border-zinc-200 object-cover print:h-32"
                            />

                            <div className="mt-3 text-sm font-semibold text-zinc-900">
                              {photo.label || 'Job photo'}
                            </div>

                            <div className="mt-1 text-xs text-zinc-500">
                              {formatDateTime(photo.createdAt)}
                            </div>

                            {photo.uploadedByWorkerName && (
                              <div className="mt-1 text-xs text-zinc-500">
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
            </div>
          )}
        </section>
      </div>
    </main>
  )
}