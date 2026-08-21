'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

export const dynamic = 'force-dynamic'

type AdminLayoutProps = {
  children: React.ReactNode
}

type IconName = 'calendar' | 'inbox' | 'quotes' | 'jobs' | 'more'

const adminNavItems = [
  { href: '/admin/schedule', label: 'Schedule' },
  { href: '/admin/inbox', label: 'Inbox' },
  { href: '/admin/quotes', label: 'Quotes' },
  { href: '/admin/maintenance-opportunities', label: 'Opportunities' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/customers', label: 'Customers' },
  { href: '/workers', label: 'Workers' },
  { href: '/kelly/notes-summary', label: 'Notes Summary' },
]

const mobilePrimaryNavItems: Array<{
  href: string
  label: string
  icon: IconName
}> = [
  { href: '/admin/schedule', label: 'Schedule', icon: 'calendar' },
  { href: '/admin/inbox', label: 'Inbox', icon: 'inbox' },
  { href: '/admin/quotes', label: 'Quotes', icon: 'quotes' },
  { href: '/jobs', label: 'Jobs', icon: 'jobs' },
]

const mobileMoreNavItems = [
  { href: '/admin/maintenance-opportunities', label: 'Opportunities' },
  { href: '/customers', label: 'Customers' },
  { href: '/workers', label: 'Workers' },
  { href: '/kelly/notes-summary', label: 'Notes Summary' },
]

function isActivePath(pathname: string, href: string) {
  if (href === '/admin/schedule') {
    return pathname === '/admin' || pathname === '/admin/schedule'
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavIcon({ name }: { name: IconName }) {
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

  if (name === 'calendar') {
    return (
      <svg {...commonProps}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18" />
      </svg>
    )
  }

  if (name === 'inbox') {
    return (
      <svg {...commonProps}>
        <path d="M4 4h16v13a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V4Z" />
        <path d="M4 14h4l2 3h4l2-3h4" />
      </svg>
    )
  }

  if (name === 'quotes') {
    return (
      <svg {...commonProps}>
        <path d="M6 3h9l3 3v15H6z" />
        <path d="M14 3v4h4M9 12h6M9 16h4" />
      </svg>
    )
  }

  if (name === 'jobs') {
    return (
      <svg {...commonProps}>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" />
      </svg>
    )
  }

  return (
    <svg {...commonProps}>
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const moreActive = mobileMoreNavItems.some((item) => isActivePath(pathname, item.href))

  useEffect(() => {
    setMoreOpen(false)
  }, [pathname])

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
            maxWidth: 1400,
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
              Admin
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
              Furlads Control Centre
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
            Worker View
          </Link>
        </div>
      </header>

      <div
        className="admin-layout-shell"
        style={{
          maxWidth: 1400,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1fr',
        }}
      >
        <aside
          className="admin-sidebar"
          style={{
            display: 'none',
            borderRight: '1px solid #e5e7eb',
            background: '#ffffff',
          }}
        >
          <div
            style={{
              padding: 20,
              position: 'sticky',
              top: 73,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: '#6b7280',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 14,
              }}
            >
              Admin Navigation
            </div>

            <nav
              aria-label="Admin navigation"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {adminNavItems.map((item) => {
                const active = isActivePath(pathname, item.href)

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      minHeight: 48,
                      padding: '0 14px',
                      borderRadius: 14,
                      background: active ? '#111827' : '#f9fafb',
                      color: active ? '#ffffff' : '#111827',
                      textDecoration: 'none',
                      fontSize: 15,
                      fontWeight: 700,
                      border: active ? '1px solid #111827' : '1px solid #e5e7eb',
                      boxShadow: active ? '0 8px 18px rgba(17,24,39,0.16)' : 'none',
                    }}
                  >
                    <span
                      style={{
                        minWidth: 0,
                        overflowWrap: 'break-word',
                        wordBreak: 'break-word',
                      }}
                    >
                      {item.label}
                    </span>
                  </Link>
                )
              })}
            </nav>
          </div>
        </aside>

        <main
          className="admin-main"
          style={{
            minWidth: 0,
            padding: '16px 16px 108px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 1200,
              margin: '0 auto',
              minWidth: 0,
            }}
          >
            {children}
          </div>
        </main>
      </div>

      {moreOpen ? (
        <button
          type="button"
          aria-label="Close more navigation"
          className="admin-mobile-nav-backdrop"
          onClick={() => setMoreOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 48,
            border: 0,
            padding: 0,
            background: 'rgba(17,24,39,0.18)',
          }}
        />
      ) : null}

      <nav
        aria-label="Admin mobile navigation"
        className="admin-mobile-nav"
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
        {moreOpen ? (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 'calc(100% + 10px)',
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: 18,
              padding: 8,
              boxShadow: '0 18px 40px rgba(17,24,39,0.18)',
            }}
          >
            <div
              style={{
                padding: '8px 10px 6px',
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#6b7280',
              }}
            >
              More
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 6,
              }}
            >
              {mobileMoreNavItems.map((item) => {
                const active = isActivePath(pathname, item.href)

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{
                      minWidth: 0,
                      minHeight: 48,
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 13px',
                      borderRadius: 13,
                      textDecoration: 'none',
                      background: active ? '#111827' : '#f8fafc',
                      color: active ? '#ffffff' : '#111827',
                      border: active ? '1px solid #111827' : '1px solid #e5e7eb',
                      fontSize: 14,
                      fontWeight: 750,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        ) : null}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
            gap: 3,
          }}
        >
          {mobilePrimaryNavItems.map((item) => {
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
                <NavIcon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            )
          })}

          <button
            type="button"
            aria-expanded={moreOpen}
            aria-label="More admin navigation"
            onClick={() => setMoreOpen((open) => !open)}
            style={{
              minWidth: 0,
              minHeight: 58,
              borderRadius: 15,
              border: 0,
              cursor: 'pointer',
              color: moreOpen || moreActive ? '#ffffff' : '#4b5563',
              background: moreOpen || moreActive ? '#111827' : 'transparent',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              padding: '5px 2px',
              font: 'inherit',
              fontSize: 11,
              fontWeight: 750,
              lineHeight: 1,
              whiteSpace: 'nowrap',
              boxShadow: moreOpen || moreActive ? '0 8px 18px rgba(17,24,39,0.16)' : 'none',
            }}
          >
            <NavIcon name="more" />
            <span>More</span>
          </button>
        </div>
      </nav>

      <style jsx>{`
        @media (min-width: 1024px) {
          .admin-layout-shell {
            grid-template-columns: 260px minmax(0, 1fr) !important;
          }

          .admin-sidebar {
            display: block !important;
          }

          .admin-mobile-nav,
          .admin-mobile-nav-backdrop {
            display: none !important;
          }

          .admin-main {
            padding: 24px 24px 32px !important;
          }
        }
      `}</style>
    </div>
  )
}
