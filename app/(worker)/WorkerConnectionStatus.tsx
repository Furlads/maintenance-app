'use client'

import { useEffect, useState } from 'react'

export default function WorkerConnectionStatus() {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    function syncStatus() {
      setOnline(navigator.onLine)
    }

    syncStatus()
    window.addEventListener('online', syncStatus)
    window.addEventListener('offline', syncStatus)

    return () => {
      window.removeEventListener('online', syncStatus)
      window.removeEventListener('offline', syncStatus)
    }
  }, [])

  if (online) return null

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        top: 82,
        zIndex: 60,
        maxWidth: 620,
        margin: '0 auto',
        padding: '10px 14px',
        borderRadius: 14,
        background: '#fff7d6',
        border: '1px solid #efcf72',
        boxShadow: '0 10px 28px rgba(17,24,39,0.14)',
        color: '#6c4c00',
        fontSize: 13,
        fontWeight: 800,
        lineHeight: 1.35,
      }}
    >
      Offline — today’s cached jobs stay visible. Keep this page open; photos and site updates need a connection before they can be sent.
    </div>
  )
}
