'use client'

import { useEffect, useRef, useState } from 'react'

export default function WorkerMenu() {
  const [open, setOpen] = useState(false)
  const [workerName, setWorkerName] = useState('')
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const savedWorkerName = localStorage.getItem('workerName') || ''
    setWorkerName(savedWorkerName)
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!menuRef.current) return
      if (!menuRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  function handleSwitchWorker() {
    localStorage.removeItem('workerId')
    localStorage.removeItem('workerName')
    window.location.href = '/'
  }

  function handleLogout() {
    localStorage.removeItem('workerId')
    localStorage.removeItem('workerName')
    window.location.href = '/'
  }

  return (
    <div
      ref={menuRef}
      style={{
        position: 'relative',
        display: 'inline-block'
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Open worker menu"
        style={{
          padding: '10px 14px',
          borderRadius: 8,
          border: '1px solid #ccc',
          background: '#fff',
          cursor: 'pointer',
          fontSize: 20,
          lineHeight: 1
        }}
      >
        ☰
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 8,
            minWidth: 220,
            background: '#fff',
            border: '1px solid #ddd',
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            padding: 10,
            zIndex: 1000
          }}
        >
          <div
            style={{
              padding: '8px 10px',
              borderBottom: '1px solid #eee',
              marginBottom: 8
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.7 }}>Logged in as</div>
            <div style={{ fontWeight: 600 }}>{workerName || 'Unknown worker'}</div>
          </div>

          <a
            href="/today"
            style={{
              display: 'block',
              padding: '10px 12px',
              borderRadius: 8,
              textDecoration: 'none',
              color: 'inherit'
            }}
          >
            Today
          </a>

          <a
            href="/customers"
            style={{
              display: 'block',
              padding: '10px 12px',
              borderRadius: 8,
              textDecoration: 'none',
              color: 'inherit'
            }}
          >
            Customers
          </a>

          <a
            href="/jobs"
            style={{
              display: 'block',
              padding: '10px 12px',
              borderRadius: 8,
              textDecoration: 'none',
              color: 'inherit'
            }}
          >
            Jobs
          </a>

          <button
            type="button"
            onClick={handleSwitchWorker}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '10px 12px',
              borderRadius: 8,
              border: 'none',
              background: '#fff',
              cursor: 'pointer',
              font: 'inherit'
            }}
          >
            Switch worker
          </button>

          <button
            type="button"
            onClick={handleLogout}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '10px 12px',
              borderRadius: 8,
              border: 'none',
              background: '#fff',
              cursor: 'pointer',
              font: 'inherit'
            }}
          >
            Logout
          </button>
        </div>
      )}
    </div>
  )
}