'use client'

import { useEffect, useMemo, useState } from 'react'

type Worker = {
  id: number
  firstName: string
  lastName: string
  active?: boolean
  photoUrl?: string | null
  phone?: string | null
}

function getRedirectPath(accessLevel: string) {
  return accessLevel.toLowerCase() === 'admin' ? '/admin' : '/today'
}

export default function Page() {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const savedWorkerId = localStorage.getItem('workerId')
    const savedWorkerName = localStorage.getItem('workerName')
    const savedWorkerAccessLevel = localStorage.getItem('workerAccessLevel')

    const quickLoginEnabled = localStorage.getItem('quickLoginEnabled') === 'true'
    const quickLoginPhone = localStorage.getItem('quickLoginPhone') || ''

    if (quickLoginEnabled && quickLoginPhone.trim()) {
      window.location.href = `/login?phone=${encodeURIComponent(
        quickLoginPhone.trim()
      )}&autostart=1`
      return
    }

    if (savedWorkerId && savedWorkerName && savedWorkerAccessLevel) {
      window.location.href = getRedirectPath(savedWorkerAccessLevel)
      return
    }

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

  const sortedWorkers = useMemo(() => {
    return [...workers].sort((a, b) => {
      const aName = `${a.firstName || ''} ${a.lastName || ''}`.trim()
      const bName = `${b.firstName || ''} ${b.lastName || ''}`.trim()
      return aName.localeCompare(bName)
    })
  }, [workers])

  function openLoginForWorker(worker: Worker) {
    const workerName = `${worker.firstName || ''} ${worker.lastName || ''}`.trim()

    localStorage.setItem('selectedLoginWorkerId', String(worker.id))
    localStorage.setItem('selectedLoginWorkerName', workerName)

    if (worker.phone && worker.phone.trim()) {
      localStorage.setItem('selectedLoginWorkerPhone', worker.phone.trim())
      window.location.href = `/login?phone=${encodeURIComponent(worker.phone.trim())}`
      return
    }

    localStorage.removeItem('selectedLoginWorkerPhone')
    window.location.href = '/login'
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '24px 16px 40px',
        fontFamily: 'Arial, Helvetica, sans-serif',
        background:
          'linear-gradient(180deg, #f7f5ef 0%, #f2f4ef 48%, #f8f8f6 100%)',
        color: '#111'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 560,
          margin: '0 auto'
        }}
      >
        <div
          style={{
            textAlign: 'center',
            marginBottom: 18,
            paddingTop: 8
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              flexWrap: 'wrap',
              marginBottom: 10
            }}
          >
            <span
              style={{
                fontSize: 36,
                fontWeight: 900,
                letterSpacing: '-0.03em',
                color: '#c69214'
              }}
            >
              Furlads
            </span>

            <span
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: '#7a7a7a'
              }}
            >
              ×
            </span>

            <span
              style={{
                fontSize: 32,
                fontWeight: 900,
                letterSpacing: '-0.03em',
                color: '#245c3b'
              }}
            >
              Three Counties
            </span>
          </div>

          <h1
            style={{
              margin: '0 0 8px 0',
              fontSize: 30,
              lineHeight: 1.08,
              fontWeight: 900,
              letterSpacing: '-0.02em'
            }}
          >
            Who&apos;s using the app?
          </h1>

          <p
            style={{
              margin: 0,
              fontSize: 15,
              lineHeight: 1.5,
              color: '#575757',
              maxWidth: 360,
              marginInline: 'auto'
            }}
          >
            Tap your name to go straight to secure login.
          </p>
        </div>

        {loading && (
          <div
            style={{
              padding: 18,
              borderRadius: 20,
              border: '1px solid rgba(0,0,0,0.08)',
              background: '#fff',
              boxShadow: '0 12px 30px rgba(0,0,0,0.05)',
              textAlign: 'center',
              fontSize: 15,
              fontWeight: 600,
              color: '#555'
            }}
          >
            Loading workers...
          </div>
        )}

        {!loading && error && (
          <div
            style={{
              padding: 16,
              borderRadius: 18,
              border: '1px solid #e2b7b7',
              background: '#fff5f5',
              color: '#8d1f1f',
              lineHeight: 1.45
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && sortedWorkers.length === 0 && (
          <div
            style={{
              padding: 18,
              borderRadius: 20,
              border: '1px solid rgba(0,0,0,0.08)',
              background: '#fff',
              boxShadow: '0 12px 30px rgba(0,0,0,0.05)',
              textAlign: 'center',
              fontSize: 15,
              color: '#555'
            }}
          >
            No workers found.
          </div>
        )}

        {!loading && !error && sortedWorkers.length > 0 && (
          <div
            style={{
              display: 'grid',
              gap: 14
            }}
          >
            {sortedWorkers.map((worker, index) => {
              const initials =
                `${worker.firstName?.[0] || ''}${worker.lastName?.[0] || ''}` || 'W'
              const useGold = index % 2 === 0
              const hasPhoto =
                typeof worker.photoUrl === 'string' && worker.photoUrl.trim().length > 0

              return (
                <button
                  key={worker.id}
                  type="button"
                  onClick={() => openLoginForWorker(worker)}
                  style={{
                    width: '100%',
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                    textAlign: 'left',
                    cursor: 'pointer'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '17px 16px',
                      borderRadius: 22,
                      border: '1px solid rgba(0,0,0,0.10)',
                      background: '#fff',
                      boxShadow: '0 14px 30px rgba(0,0,0,0.06)'
                    }}
                  >
                    {hasPhoto ? (
                      <img
                        src={worker.photoUrl as string}
                        alt={`${worker.firstName} ${worker.lastName}`}
                        style={{
                          width: 58,
                          height: 58,
                          borderRadius: 18,
                          objectFit: 'cover',
                          flexShrink: 0,
                          border: useGold
                            ? '1px solid rgba(198,146,20,0.22)'
                            : '1px solid rgba(36,92,59,0.18)',
                          background: '#f3f3f3'
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 58,
                          height: 58,
                          borderRadius: 18,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          fontSize: 19,
                          fontWeight: 900,
                          background: useGold ? '#f5deb0' : '#d9e9de',
                          color: useGold ? '#8a5a00' : '#245c3b',
                          border: useGold
                            ? '1px solid rgba(198,146,20,0.22)'
                            : '1px solid rgba(36,92,59,0.18)'
                        }}
                      >
                        {initials}
                      </div>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 20,
                          fontWeight: 900,
                          color: '#171717',
                          marginBottom: 4,
                          letterSpacing: '-0.01em'
                        }}
                      >
                        {worker.firstName} {worker.lastName}
                      </div>

                      <div
                        style={{
                          fontSize: 14,
                          color: '#666'
                        }}
                      >
                        Tap to log in
                      </div>
                    </div>

                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 800,
                        color: useGold ? '#b17e07' : '#245c3b'
                      }}
                    >
                      Open
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