'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function BottomNav() {
  const pathname = usePathname()

  const linkStyle = (path: string) => ({
    flex: 1,
    padding: '14px 0',
    textAlign: 'center' as const,
    textDecoration: 'none',
    fontWeight: pathname === path ? 'bold' : 'normal',
    borderTop: pathname === path ? '3px solid black' : '3px solid transparent'
  })

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        background: '#fff',
        borderTop: '1px solid #ddd'
      }}
    >
      <Link href="/today" style={linkStyle('/today')}>
        Today
      </Link>

      <Link href="/jobs" style={linkStyle('/jobs')}>
        Jobs
      </Link>

      <Link href="/customers" style={linkStyle('/customers')}>
        Customers
      </Link>
    </nav>
  )
}