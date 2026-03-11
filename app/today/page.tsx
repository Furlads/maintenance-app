'use client'

import { useEffect, useState } from 'react'

export default function TodayPage() {
  const [workerName, setWorkerName] = useState('')

  useEffect(() => {
    const savedName = localStorage.getItem('workerName') || ''
    setWorkerName(savedName)
  }, [])

  function logout() {
    localStorage.removeItem('workerId')
    localStorage.removeItem('workerName')
    window.location.href = '/'
  }

  return (
    <main style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Today</h1>

      <p style={{ fontSize: 18, marginBottom: 24 }}>
        Logged in as: <strong>{workerName || 'Unknown worker'}</strong>
      </p>

      <div
        style={{
          maxWidth: 500,
          padding: 20,
          border: '1px solid #ddd',
          borderRadius: 12,
          marginBottom: 20
        }}
      >
        <h2 style={{ fontSize: 22, marginBottom: 12 }}>Today&apos;s Jobs</h2>
        <p>No jobs yet.</p>
      </div>

      <div
        style={{
          maxWidth: 500,
          padding: 20,
          border: '1px solid #ddd',
          borderRadius: 12,
          marginBottom: 20
        }}
      >
        <h2 style={{ fontSize: 22, marginBottom: 12 }}>Upcoming Jobs</h2>
        <p>No upcoming jobs yet.</p>
      </div>

      <button
        onClick={logout}
        style={{
          padding: 14,
          minWidth: 180,
          fontSize: 16,
          borderRadius: 10,
          border: '1px solid #ccc',
          background: '#000',
          color: '#fff'
        }}
      >
        Log Out
      </button>
    </main>
  )
}