'use client'

import { useEffect, useMemo, useState } from 'react'

type Worker = {
  id: number
  firstName: string
  lastName: string
  active?: boolean
}

function getRedirectPath(accessLevel: string) {
  return accessLevel.toLowerCase() === 'admin' ? '/admin' : '/today'
}

export default function Page() {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null)
  const [pin, setPin] = useState('')
  const [pinBusy, setPinBusy] = useState(false)
  const [pinError, setPinError] = useState('')

  useEffect(() => {
    const savedWorkerId = localStorage.getItem('workerId')
    const savedWorkerName = localStorage.getItem('workerName')
    const savedWorkerAccessLevel = localStorage.getItem('workerAccessLevel')

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

  function openPinForWorker(worker: Worker) {
    setSelectedWorker(worker)
    setPin('')
    setPinError('')
  }

  function closePin() {
    setSelectedWorker(null)
    setPin('')
    setPinError('')
    setPinBusy(false)
  }

  async function handlePinLogin() {
    if (!selectedWorker) return

    const cleanPin = pin.trim()

    if (!cleanPin) {
      setPinError('Enter your PIN.')
      return
    }

    setPinBusy(true)
    setPinError('')

    try {
      const res = await fetch('/api/auth/pin-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          workerId: selectedWorker.id,
          pin: cleanPin
        })
      })

      const data = await res.json().catch(() => null)

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'PIN not accepted.')
      }

      const workerName =
        typeof data?.worker?.name === 'string' && data.worker.name.trim()
          ? data.worker.name.trim()
          : `${selectedWorker.firstName} ${selectedWorker.lastName}`.trim()

      const accessLevel =
        typeof data?.worker?.accessLevel === 'string' && data.worker.accessLevel.trim()
          ? data.worker.accessLevel.trim()
          : 'worker'

      localStorage.setItem('workerId', String(selectedWorker.id))
      localStorage.setItem('workerName', workerName)
      localStorage.setItem('workerAccessLevel', accessLevel)

      window.location.href = getRedirectPath(accessLevel)
    } catch (err: any) {
      console.error(err)
      setPinError(String(err?.message || 'PIN not accepted.'))
    } finally {
      setPinBusy(false)
    }
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
            marginBottom: 22,
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
              marginBottom: 12
            }}
          >
            <span
              style={{
                fontSize: 34,
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
                color: '#767676'
              }}
            >
              ×
            </span>

            <span
              style={{
                fontSize: 30,
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
              lineHeight: 1.1,
              fontWeight: 900
            }}
          >
            Who&apos;s using the app?
          </h1>

          <p
            style={{
              margin: 0,
              fontSize: 15,
              lineHeight: 1.5,
              color: '#575757'
            }}
          >
            Tap your name, then enter your PIN.
          </p>
        </div>

        <div
          style={{
            marginBottom: 18,
            padding: 14,
            borderRadius: 18,
            border: '1px solid rgba(0,0,0,0.08)',
            background: '#ffffff',
            boxShadow: '0 10px 30px rgba(0,0,0,0.05)'
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              marginBottom: 6
            }}
          >
            Test login
          </div>

          <div
            style={{
              fontSize: 14,
              color: '#5e5e5e',
              lineHeight: 1.5
            }}
          >
            While you&apos;re testing, everyone can use PIN <strong>1234</strong>.
          </div>
        </div>

        {loading && (
          <div
            style={{
              padding: 18,
              borderRadius: 18,
              border: '1px solid rgba(0,0,0,0.08)',
              background: '#fff',
              boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
              textAlign: 'center'
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
              color: '#8d1f1f'
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && sortedWorkers.length === 0 && (
          <div
            style={{
              padding: 18,
              borderRadius: 18,
              border: '1px solid rgba(0,0,0,0.08)',
              background: '#fff',
              boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
              textAlign: 'center'
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
              const initials = `${worker.firstName?.[0] || ''}${worker.lastName?.[0] || ''}` || 'W'
              const useGold = index % 2 === 0

              return (
                <button
                  key={worker.id}
                  type="button"
                  onClick={() => openPinForWorker(worker)}
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
                      padding: '16px',
                      borderRadius: 22,
                      border: '1px solid rgba(0,0,0,0.08)',
                      background: '#fff',
                      boxShadow: '0 12px 30px rgba(0,0,0,0.06)'
                    }}
                  >
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

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 20,
                          fontWeight: 900,
                          color: '#171717',
                          marginBottom: 4
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
                        Tap to continue
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

      {selectedWorker && (
        <div
          onClick={closePin}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.48)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: 12,
            zIndex: 1000
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 520,
              borderRadius: 22,
              background: '#fff',
              border: '1px solid rgba(0,0,0,0.08)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.22)',
              padding: 18
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'start',
                gap: 12,
                marginBottom: 14
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 900,
                    marginBottom: 6
                  }}
                >
                  Enter PIN
                </div>

                <div
                  style={{
                    fontSize: 14,
                    color: '#5f5f5f',
                    lineHeight: 1.5
                  }}
                >
                  {selectedWorker.firstName} {selectedWorker.lastName}
                </div>
              </div>

              <button
                type="button"
                onClick={closePin}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  border: '1px solid #ddd',
                  background: '#fff',
                  cursor: 'pointer',
                  fontSize: 20,
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>

            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoFocus
              value={pin}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '')
                setPin(value)
                setPinError('')
              }}
              placeholder="Enter PIN"
              style={{
                width: '100%',
                padding: '16px 14px',
                borderRadius: 14,
                border: '1px solid #d5d5d5',
                fontSize: 24,
                letterSpacing: '0.35em',
                textAlign: 'center',
                outline: 'none',
                marginBottom: 10
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !pinBusy) {
                  event.preventDefault()
                  handlePinLogin()
                }
              }}
            />

            {pinError && (
              <div
                style={{
                  marginBottom: 10,
                  fontSize: 14,
                  color: '#b00020'
                }}
              >
                {pinError}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                gap: 10,
                flexWrap: 'wrap'
              }}
            >
              <button
                type="button"
                onClick={handlePinLogin}
                disabled={pinBusy || pin.trim().length === 0}
                style={{
                  flex: 1,
                  minWidth: 180,
                  padding: '14px 16px',
                  borderRadius: 14,
                  border: '1px solid #111',
                  background: '#111',
                  color: '#fff',
                  fontWeight: 800,
                  cursor:
                    pinBusy || pin.trim().length === 0 ? 'not-allowed' : 'pointer',
                  opacity: pinBusy || pin.trim().length === 0 ? 0.7 : 1
                }}
              >
                {pinBusy ? 'Checking...' : 'Continue'}
              </button>

              <button
                type="button"
                onClick={closePin}
                disabled={pinBusy}
                style={{
                  padding: '14px 16px',
                  borderRadius: 14,
                  border: '1px solid #ccc',
                  background: '#fff',
                  cursor: pinBusy ? 'not-allowed' : 'pointer',
                  opacity: pinBusy ? 0.7 : 1
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}