'use client'

import { useEffect, useState } from 'react'

type Worker = {
  id: number
  firstName: string
  lastName: string
}

export default function Page() {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedWorkerId, setSelectedWorkerId] = useState<number | null>(null)

  useEffect(() => {
    async function loadWorkers() {
      try {
        setLoading(true)
        setError('')

        const res = await fetch('/api/workers', { cache: 'no-store' })

        if (!res.ok) {
          throw new Error('Failed to load workers')
        }

        const data = await res.json()
        setWorkers(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error(err)
        setWorkers([])
        setError('Failed to load workers.')
      } finally {
        setLoading(false)
      }
    }

    loadWorkers()
  }, [])

  function selectWorker(worker: Worker) {
    setSelectedWorkerId(worker.id)
    localStorage.setItem('workerId', worker.id.toString())
    localStorage.setItem('workerName', `${worker.firstName} ${worker.lastName}`)
    window.location.href = '/today'
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '24px 16px 40px',
        fontFamily: 'sans-serif',
        background:
          'linear-gradient(180deg, #f4f4f2 0%, #efefe9 55%, #f8f8f5 100%)',
        color: '#1c1c1c'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          margin: '0 auto'
        }}
      >
        <div
          style={{
            textAlign: 'center',
            marginBottom: 24,
            paddingTop: 10
          }}
        >
          <div
            style={{
              marginBottom: 12,
              lineHeight: 1,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'baseline',
              flexWrap: 'wrap',
              gap: 8
            }}
          >
            <span
              style={{
                fontSize: 42,
                fontWeight: 800,
                color: '#d59000',
                letterSpacing: '-0.03em'
              }}
            >
              Furlads
            </span>

            <span
              style={{
                fontSize: 30,
                fontWeight: 700,
                color: '#b97800'
              }}
            >
              &
            </span>

            <span
              style={{
                fontSize: 42,
                fontWeight: 800,
                color: '#1f5a37',
                letterSpacing: '-0.03em'
              }}
            >
              Three Counties
            </span>
          </div>

          <h1
            style={{
              fontSize: 28,
              margin: '0 0 10px 0',
              fontWeight: 800
            }}
          >
            Who&apos;s using the app?
          </h1>

          <p
            style={{
              margin: 0,
              fontSize: 15,
              lineHeight: 1.5,
              color: '#4f4f4f'
            }}
          >
            Tap your name to continue.
          </p>
        </div>

        <div
          style={{
            marginBottom: 20,
            padding: 14,
            borderRadius: 18,
            background: '#ffffff',
            border: '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.05)'
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              marginBottom: 6
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: '#1f5a37',
                display: 'inline-block'
              }}
            />
            <span style={{ fontSize: 14, fontWeight: 700 }}>Mobile-friendly access</span>
          </div>

          <div
            style={{
              fontSize: 14,
              lineHeight: 1.5,
              color: '#5a5a5a'
            }}
          >
            This page is set up for quick worker access on site. We can add PIN,
            Face ID, or fingerprint login next without disturbing the working data.
          </div>
        </div>

        {loading && (
          <div
            style={{
              padding: 18,
              borderRadius: 18,
              background: '#ffffff',
              border: '1px solid rgba(0,0,0,0.08)',
              textAlign: 'center',
              fontSize: 15,
              boxShadow: '0 10px 30px rgba(0,0,0,0.05)'
            }}
          >
            Loading workers...
          </div>
        )}

        {!loading && error && (
          <div
            style={{
              padding: 18,
              borderRadius: 18,
              background: '#fff5f5',
              border: '1px solid #e4b7b7',
              color: '#8a1f1f',
              fontSize: 15
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && workers.length === 0 && (
          <div
            style={{
              padding: 18,
              borderRadius: 18,
              background: '#ffffff',
              border: '1px solid rgba(0,0,0,0.08)',
              textAlign: 'center',
              fontSize: 15,
              boxShadow: '0 10px 30px rgba(0,0,0,0.05)'
            }}
          >
            No workers found.
          </div>
        )}

        {!loading && !error && workers.length > 0 && (
          <div
            style={{
              display: 'grid',
              gap: 14
            }}
          >
            {workers.map((worker, index) => {
              const initials = `${worker.firstName?.[0] || ''}${worker.lastName?.[0] || ''}`

              const isBusy = selectedWorkerId === worker.id
              const useGoldStyle = index % 2 === 0

              return (
                <button
                  key={worker.id}
                  type="button"
                  onClick={() => selectWorker(worker)}
                  disabled={selectedWorkerId !== null}
                  style={{
                    width: '100%',
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                    cursor: selectedWorkerId !== null ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                    opacity: selectedWorkerId !== null && !isBusy ? 0.72 : 1
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '16px 16px',
                      borderRadius: 20,
                      background: '#ffffff',
                      border: '1px solid rgba(0,0,0,0.08)',
                      boxShadow: '0 12px 30px rgba(0,0,0,0.06)'
                    }}
                  >
                    <div
                      style={{
                        width: 54,
                        height: 54,
                        borderRadius: 16,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 18,
                        fontWeight: 800,
                        flexShrink: 0,
                        background: useGoldStyle ? '#f3d58a' : '#d7eadc',
                        color: useGoldStyle ? '#8a5700' : '#1f5a37',
                        border: useGoldStyle
                          ? '1px solid rgba(184,120,0,0.18)'
                          : '1px solid rgba(31,90,55,0.18)'
                      }}
                    >
                      {initials || 'W'}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 19,
                          fontWeight: 800,
                          color: '#181818',
                          marginBottom: 4
                        }}
                      >
                        {worker.firstName} {worker.lastName}
                      </div>

                      <div
                        style={{
                          fontSize: 14,
                          color: '#5f5f5f'
                        }}
                      >
                        Tap to continue
                      </div>
                    </div>

                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: useGoldStyle ? '#b97800' : '#1f5a37',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {isBusy ? 'Opening...' : 'Open'}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}