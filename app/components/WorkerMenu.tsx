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

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  function clearWorkerSession() {
    localStorage.removeItem('workerId')
    localStorage.removeItem('workerName')
    localStorage.removeItem('workerAccessLevel')
  }

  function handleLogout() {
    clearWorkerSession()
    window.location.href = '/'
  }

  function handleSwitchWorker() {
    clearWorkerSession()
    window.location.href = '/'
  }

  const linkStyle: React.CSSProperties = {
    display: 'block',
    padding: '12px 0',
    textDecoration: 'none',
    color: '#111',
    fontSize: 17,
    borderBottom: '1px solid #eee'
  }

  return (
    <div
      ref={menuRef}
      style={{
        position: 'relative'
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Open menu"
        style={{
          width: 54,
          height: 54,
          borderRadius: 12,
          border: '1px solid #d8d8d8',
          background: '#fff',
          fontSize: 28,
          lineHeight: 1,
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
        }}
      >
        ☰
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 64,
            right: 0,
            width: 270,
            maxWidth: 'calc(100vw - 32px)',
            background: '#fff',
            border: '1px solid #ddd',
            borderRadius: 16,
            boxShadow: '0 14px 34px rgba(0,0,0,0.12)',
            padding: 16,
            zIndex: 200
          }}
        >
          <div
            style={{
              marginBottom: 12,
              paddingBottom: 12,
              borderBottom: '1px solid #eee'
            }}
          >
            <div
              style={{
                fontSize: 14,
                color: '#666',
                marginBottom: 4
              }}
            >
              Logged in as
            </div>

            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: '#111'
              }}
            >
              {workerName || 'Worker'}
            </div>
          </div>

          <a href="/today" style={linkStyle} onClick={() => setOpen(false)}>
            Today
          </a>

          <a href="/customers" style={linkStyle} onClick={() => setOpen(false)}>
            Customers
          </a>

          <a href="/jobs" style={linkStyle} onClick={() => setOpen(false)}>
            Jobs
          </a>

          <a href="/menu/change-pin" style={linkStyle} onClick={() => setOpen(false)}>
            Change PIN
          </a>

          <button
            type="button"
            onClick={handleSwitchWorker}
            style={{
              display: 'block',
              width: '100%',
              padding: '12px 0',
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid #eee',
              textAlign: 'left',
              color: '#111',
              fontSize: 17,
              cursor: 'pointer'
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
              padding: '12px 0 0 0',
              background: 'transparent',
              border: 'none',
              textAlign: 'left',
              color: '#111',
              fontSize: 17,
              cursor: 'pointer'
            }}
          >
            Logout
          </button>
        </div>
      )}
    </div>
  )
}