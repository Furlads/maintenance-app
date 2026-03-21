'use client'

import { useEffect, useMemo, useState } from 'react'

type Worker = {
  id: number
  firstName: string
  lastName: string
  active?: boolean
  photoUrl?: string | null
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
      <div style={{ width: '100%', maxWidth: 560, margin: '0 auto' }}>
        
        {/* 🔐 NEW: Secure login button */}
        <div style={{ marginBottom: 16 }}>
          <button
            onClick={() => (window.location.href = '/login')}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: 14,
              border: 'none',
              background: '#111',
              color: '#fff',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            Use Secure Login (Face ID / Password)
          </button>
        </div>

        {/* Existing UI untouched below */}

        <div style={{ textAlign: 'center', marginBottom: 18, paddingTop: 8 }}>
          <div style={{ display: 'inline-flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <span style={{ fontSize: 36, fontWeight: 900, color: '#c69214' }}>Furlads</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#7a7a7a' }}>×</span>
            <span style={{ fontSize: 32, fontWeight: 900, color: '#245c3b' }}>
              Three Counties
            </span>
          </div>

          <h1 style={{ margin: '0 0 8px 0', fontSize: 30, fontWeight: 900 }}>
            Who's using the app?
          </h1>

          <p style={{ margin: 0, fontSize: 15, color: '#575757' }}>
            Tap your name to continue.
          </p>
        </div>

        {/* 🔥 TESTING BOX REMOVED COMPLETELY */}

        {/* EVERYTHING BELOW UNCHANGED */}

        {loading && <div>Loading workers...</div>}

        {!loading && error && <div>{error}</div>}

        {!loading && !error && sortedWorkers.length > 0 && (
          <div style={{ display: 'grid', gap: 14 }}>
            {sortedWorkers.map((worker, index) => {
              const initials =
                `${worker.firstName?.[0] || ''}${worker.lastName?.[0] || ''}` || 'W'

              return (
                <button
                  key={worker.id}
                  onClick={() => openPinForWorker(worker)}
                  style={{ padding: 16, borderRadius: 12 }}
                >
                  {worker.firstName} {worker.lastName}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {selectedWorker && (
        <div>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />
          <button onClick={handlePinLogin}>Continue</button>
        </div>
      )}
    </main>
  )
}