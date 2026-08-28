'use client'

import { useState } from 'react'

const font = "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

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
    if (!workerId) return setError('Worker not logged in.')
    if (!currentPin || !newPin || !confirmPin) return setError('Please fill in all fields.')
    if (newPin !== confirmPin) return setError('New PINs do not match.')
    if (newPin.length < 4) return setError('PIN must be at least 4 digits.')

    setSaving(true)
    try {
      const res = await fetch('/api/auth/change-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerId: Number(workerId), currentPin, newPin }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Failed to change PIN')

      setMessage('PIN updated successfully.')
      setCurrentPin('')
      setNewPin('')
      setConfirmPin('')
    } catch (err: any) {
      setError(err?.message || 'Failed to change PIN')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', minHeight: 52, padding: '12px 14px', borderRadius: 14,
    border: '1px solid #d1d5db', background: '#fff', fontSize: 16,
  }

  return (
    <main style={{ minHeight: '100dvh', background: '#f3f4f6', padding: 16, fontFamily: font }}>
      <section style={{ maxWidth: 560, margin: '0 auto', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 22, padding: 20, boxShadow: '0 10px 26px rgba(24,24,27,.055)' }}>
        <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 800, color: '#64748b' }}>Personal</div>
        <h1 style={{ margin: '6px 0 18px', fontSize: 32, lineHeight: 1, fontWeight: 900, letterSpacing: '-.03em' }}>Change PIN</h1>

        <div style={{ display: 'grid', gap: 12 }}>
          <input aria-label="Current PIN" inputMode="numeric" autoComplete="current-password" type="password" placeholder="Current PIN" value={currentPin} onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))} style={inputStyle} />
          <input aria-label="New PIN" inputMode="numeric" autoComplete="new-password" type="password" placeholder="New PIN" value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))} style={inputStyle} />
          <input aria-label="Confirm new PIN" inputMode="numeric" autoComplete="new-password" type="password" placeholder="Confirm new PIN" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))} style={inputStyle} />

          {error && <div style={{ padding: '11px 13px', borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontWeight: 700 }}>{error}</div>}
          {message && <div style={{ padding: '11px 13px', borderRadius: 12, background: '#ecfdf3', border: '1px solid #bbf7d0', color: '#166534', fontWeight: 700 }}>✓ {message}</div>}

          <button type="button" onClick={handleChangePin} disabled={saving} style={{ minHeight: 52, borderRadius: 14, border: '1px solid #111827', background: '#111827', color: '#fff', fontSize: 16, fontWeight: 900, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .65 : 1 }}>
            {saving ? 'Saving...' : 'Update PIN'}
          </button>
        </div>
      </section>
    </main>
  )
}
