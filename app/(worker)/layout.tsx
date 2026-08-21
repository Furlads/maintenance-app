'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import WorkerConnectionStatus from './WorkerConnectionStatus'

export const dynamic = 'force-dynamic'

type WorkerLayoutProps = {
  children: React.ReactNode
}

type WorkerIconName = 'today' | 'visits' | 'chas' | 'timeoff'

const workerNavItems: Array<{
  href: string
  label: string
  icon: WorkerIconName
}> = [
  { href: '/today', label: 'Today', icon: 'today' },
  { href: '/my-visits', label: 'Visits', icon: 'visits' },
  { href: '/chas', label: 'CHAS', icon: 'chas' },
  { href: '/worker', label: 'Time Off', icon: 'timeoff' },
]

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function WorkerNavIcon({ name }: { name: WorkerIconName }) {
  const commonProps = {
    width: 21,
    height: 21,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  if (name === 'today') {
    return (
      <svg {...commonProps}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18" />
        <path d="M8 14h3v3H8z" />
      </svg>
    )
  }

  if (name === 'visits') {
    return (
      <svg {...commonProps}>
        <path d="M12 21s7-5.2 7-12a7 7 0 1 0-14 0c0 6.8 7 12 7 12Z" />
        <circle cx="12" cy="9" r="2.5" />
      </svg>
    )
  }

  if (name === 'chas') {
    return (
      <svg {...commonProps}>
        <path d="M4 5h16v11H8l-4 4V5Z" />
        <path d="M8 10h.01M12 10h.01M16 10h.01" />
      </svg>
    )
  }

  return (
    <svg {...commonProps}>
      <path d="M5 4h14v16H5z" />
      <path d="M8 2v4M16 2v4M5 9h14" />
      <path d="M9 13h6M9 17h4" />
    </svg>
  )
}

export default function WorkerLayout({ children }: WorkerLayoutProps) {
  const pathname = usePathname()

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#f8fafc',
        color: '#111827',
      }}
    >
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <div
          style={{
            maxWidth: 720,
            margin: '0 auto',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#6b7280',
                marginBottom: 2,
              }}
            >
              Worker
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 800,
                lineHeight: 1.1,
                color: '#111827',
                wordBreak: 'break-word',
              }}
            >
              Furlads Work App
            </div>
          </div>

          <Link
            href="/today"
            style={{
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 44,
              padding: '0 14px',
              borderRadius: 12,
              background: '#111827',
              color: '#ffffff',
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
          >
            Today
          </Link>
        </div>
      </header>

      <WorkerConnectionStatus />

      <main
        style={{
          minWidth: 0,
          padding: '16px 16px 106px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 720,
            margin: '0 auto',
            minWidth: 0,
          }}
        >
          {children}
        </div>
      </main>

      <nav
        aria-label="Worker navigation"
        style={{
          position: 'fixed',
          left: 10,
          right: 10,
          bottom: 'calc(8px + env(safe-area-inset-bottom))',
          zIndex: 50,
          maxWidth: 620,
          margin: '0 auto',
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: '1px solid #e5e7eb',
          borderRadius: 20,
          boxShadow: '0 12px 34px rgba(17,24,39,0.14)',
          padding: 6,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: 3,
          }}
        >
          {workerNavItems.map((item) => {
            const active = isActivePath(pathname, item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  minWidth: 0,
                  minHeight: 58,
                  borderRadius: 15,
                  textDecoration: 'none',
                  color: active ? '#ffffff' : '#4b5563',
                  background: active ? '#111827' : 'transparent',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  padding: '5px 2px',
                  fontSize: 11,
                  fontWeight: 750,
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                  boxShadow: active ? '0 8px 18px rgba(17,24,39,0.16)' : 'none',
                }}
              >
                <WorkerNavIcon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
