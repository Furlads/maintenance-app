'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function TodayAdminShortcut() {
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const response = await fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' })
        const data = await response.json().catch(() => null)
        if (!cancelled) setIsAdmin(Boolean(response.ok && data?.isAdmin))
      } catch {
        if (!cancelled) setIsAdmin(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  if (!isAdmin) return null

  return (
    <Link
      href="/admin"
      aria-label="Open admin control centre"
      style={{
        position: 'fixed',
        top: 'calc(10px + env(safe-area-inset-top))',
        right: 10,
        zIndex: 90,
        minHeight: 42,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 15px',
        borderRadius: 14,
        background: '#111827',
        color: '#ffffff',
        textDecoration: 'none',
        fontSize: 13,
        fontWeight: 900,
        boxShadow: '0 10px 26px rgba(0,0,0,.22)',
      }}
    >
      Admin
    </Link>
  )
}
