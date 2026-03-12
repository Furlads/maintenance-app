'use client'

import { useEffect, useState } from 'react'

type HistoryItem = {
  id: string
  type: 'job' | 'note' | 'photo'
  createdAt: string
  title: string
  jobId: number
  jobTitle: string
  status?: string
  notes?: string | null
  note?: string
  imageUrl?: string
  label?: string | null
  createdByWorkerName?: string | null
  uploadedByWorkerName?: string | null
}

type CannotCompleteInfo = {
  reason: string
  details: string
  reportedBy: string
  recordedAt: string
}

function extractCannotCompleteInfoFromText(value?: string | null): CannotCompleteInfo | null {
  if (!value) return null

  const lines = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const matchingLine = [...lines]
    .reverse()
    .find((line) => line.toLowerCase().startsWith('job could not be completed:'))

  if (!matchingLine) return null

  const parts = matchingLine.split(' | ').map((part) => part.trim())

  const reasonPart =
    parts.find((part) =>
      part.toLowerCase().startsWith('job could not be completed:')
    ) || ''

  const detailsPart =
    parts.find((part) => part.toLowerCase().startsWith('details:')) || ''

  const reportedByPart =
    parts.find((part) => part.toLowerCase().startsWith('reported by:')) || ''

  const recordedAtPart =
    parts.find((part) => part.toLowerCase().startsWith('recorded at:')) || ''

  return {
    reason: reasonPart.replace(/^job could not be completed:\s*/i, '').trim(),
    details: detailsPart.replace(/^details:\s*/i, '').trim(),
    reportedBy: reportedByPart.replace(/^reported by:\s*/i, '').trim(),
    recordedAt: recordedAtPart.replace(/^recorded at:\s*/i, '').trim()
  }
}

function stripCannotCompleteLines(value?: string | null) {
  if (!value) return ''

  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(
      (line) =>
        line &&
        !line.toLowerCase().startsWith('job could not be completed:')
    )
    .join('\n')
}

export default function CustomerHistory({ customerId }: { customerId: number }) {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/customers/${customerId}/history`, {
          cache: 'no-store'
        })

        const data = await res.json()

        if (data?.history && Array.isArray(data.history)) {
          setHistory(data.history)
        } else {
          setHistory([])
        }
      } catch (error) {
        console.error(error)
        setHistory([])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [customerId])

  if (loading) {
    return <p>Loading history...</p>
  }

  if (history.length === 0) {
    return <p>No customer history yet.</p>
  }

  return (
    <div style={{ marginTop: 30 }}>
      <h2 style={{ marginBottom: 15 }}>Customer History</h2>

      {history.map((item) => {
        const date = new Date(item.createdAt)

        const dateText = date.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        })

        const timeText = date.toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit'
        })

        const sourceText =
          item.type === 'job'
            ? item.notes
            : item.type === 'note'
              ? item.note
              : null

        const cannotCompleteInfo = extractCannotCompleteInfoFromText(sourceText)
        const cleanedJobNotes =
          item.type === 'job' ? stripCannotCompleteLines(item.notes) : ''
        const cleanedNoteText =
          item.type === 'note' ? stripCannotCompleteLines(item.note) : ''

        return (
          <div
            key={item.id}
            style={{
              border: '1px solid #ddd',
              borderRadius: 10,
              padding: 14,
              marginBottom: 10,
              background: '#fafafa'
            }}
          >
            <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 4 }}>
              {dateText} • {timeText}
            </div>

            <div style={{ fontWeight: 600, marginBottom: 4 }}>{item.title}</div>

            <div style={{ fontSize: 14, marginBottom: 4 }}>
              Job: {item.jobTitle}
            </div>

            {cannotCompleteInfo && (
              <div
                style={{
                  marginTop: 8,
                  marginBottom: 8,
                  padding: 12,
                  borderRadius: 8,
                  border: '1px solid #e09b00',
                  background: '#fff4d6'
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 6 }}>
                  ⚠ Job could not be completed
                </div>

                <div style={{ fontSize: 14, marginBottom: 4 }}>
                  <strong>Reason:</strong>{' '}
                  {cannotCompleteInfo.reason || 'Not provided'}
                </div>

                {cannotCompleteInfo.details && (
                  <div style={{ fontSize: 14, marginBottom: 4 }}>
                    <strong>Details:</strong> {cannotCompleteInfo.details}
                  </div>
                )}

                {cannotCompleteInfo.reportedBy && (
                  <div style={{ fontSize: 14, marginBottom: 4 }}>
                    <strong>Reported by:</strong> {cannotCompleteInfo.reportedBy}
                  </div>
                )}

                {cannotCompleteInfo.recordedAt && (
                  <div style={{ fontSize: 14 }}>
                    <strong>Recorded at:</strong> {cannotCompleteInfo.recordedAt}
                  </div>
                )}
              </div>
            )}

            {item.type === 'note' && (
              <div style={{ fontSize: 14 }}>
                {cleanedNoteText}
                {item.createdByWorkerName && (
                  <div style={{ marginTop: 4, fontSize: 12, opacity: 0.7 }}>
                    Added by {item.createdByWorkerName}
                  </div>
                )}
              </div>
            )}

            {item.type === 'photo' && item.imageUrl && (
              <div style={{ marginTop: 6 }}>
                {item.label && (
                  <div style={{ fontSize: 14, marginBottom: 6 }}>{item.label}</div>
                )}

                <img
                  src={item.imageUrl}
                  alt={item.label || item.jobTitle}
                  style={{
                    maxWidth: 200,
                    borderRadius: 6,
                    display: 'block'
                  }}
                />

                {item.uploadedByWorkerName && (
                  <div style={{ marginTop: 4, fontSize: 12, opacity: 0.7 }}>
                    Uploaded by {item.uploadedByWorkerName}
                  </div>
                )}
              </div>
            )}

            {item.type === 'job' && (
              <div style={{ fontSize: 14 }}>
                <div>Status: {item.status || 'Unknown'}</div>
                {cleanedJobNotes && (
                  <div style={{ marginTop: 4, whiteSpace: 'pre-line' }}>
                    {cleanedJobNotes}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}