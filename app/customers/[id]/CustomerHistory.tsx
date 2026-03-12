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

            {item.type === 'note' && (
              <div style={{ fontSize: 14 }}>
                {item.note}
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
                {item.notes && <div style={{ marginTop: 4 }}>{item.notes}</div>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}