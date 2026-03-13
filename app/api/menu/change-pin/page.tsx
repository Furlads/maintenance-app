'use client'

import { useState } from 'react'

export default function ChangePinPage() {
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleChangePin() {
    setError('')
    setMessage('')

    const workerId = localStorage.getItem('workerId')

    if (!workerId) {
      setError('Worker not logged in.')
      return
    }

    if (!currentPin || !newPin || !confirmPin) {
      setError('Please fill in all fields.')
      return
    }

    if (newPin !== confirmPin) {
      setError('New PINs do not match.')
      return
    }

    if (newPin.length < 4) {
      setError('PIN must be at least 4 digits.')
      return
    }

    setSaving(true)

    try {
      const res = await fetch('/api/auth/change-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId: Number(workerId),
          currentPin,
          newPin
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to change PIN')
      }

      setMessage('PIN updated successfully.')
      setCurrentPin('')
      setNewPin('')
      setConfirmPin('')
    } catch (err: any) {
      setError(err.message || 'Failed to change PIN')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main style={{ padding: 20, maxWidth: 500, fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: 28, marginBottom: 20 }}>Change PIN</h1>

      {error && (
        <div style={{ color: '#b00020', marginBottom: 12 }}>{error}</div>
      )}

      {message && (
        <div style={{ color: 'green', marginBottom: 12 }}>{message}</div>
      )}

      <input
        type="password"
        placeholder="Current PIN"
        value={currentPin}
        onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
        style={{
          width: '100%',
          padding: 12,
          marginBottom: 12,
          borderRadius: 8,
          border: '1px solid #ccc'
        }}
      />

      <input
        type="password"
        placeholder="New PIN"
        value={newPin}
        onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
        style={{
          width: '100%',
          padding: 12,
          marginBottom: 12,
          borderRadius: 8,
          border: '1px solid #ccc'
        }}
      />

      <input
        type="password"
        placeholder="Confirm New PIN"
        value={confirmPin}
        onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
        style={{
          width: '100%',
          padding: 12,
          marginBottom: 20,
          borderRadius: 8,
          border: '1px solid #ccc'
        }}
      />

      <button
        onClick={handleChangePin}
        disabled={saving}
        style={{
          padding: '12px 16px',
          borderRadius: 8,
          border: '1px solid #111',
          background: '#111',
          color: '#fff',
          cursor: saving ? 'not-allowed' : 'pointer'
        }}
      >
        {saving ? 'Saving...' : 'Update PIN'}
      </button>
    </main>
  )
}