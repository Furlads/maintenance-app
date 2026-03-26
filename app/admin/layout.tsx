'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export const dynamic = 'force-dynamic'

type AdminLayoutProps = {
  children: React.ReactNode
}

const adminNavItems = [
  { href: '/admin/schedule', label: 'Schedule' },
  { href: '/admin/inbox', label: 'Inbox' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/customers', label: 'Customers' },
  { href: '/workers', label: 'Workers' },
]

function isActivePath(pathname: string, href: string) {
  if (href === '/admin/schedule') {
    return pathname === '/admin' || pathname === '/admin/schedule'
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function AdminLayout({ children }: AdminLayoutProps) {
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
            padding: '16px 16px 96px',
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

      <nav
        aria-label="Admin mobile navigation"
        className="admin-mobile-nav"
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 50,
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderTop: '1px solid #e5e7eb',
          padding: '10px 8px calc(10px + env(safe-area-inset-bottom))',
        }}
      >
        <div
          style={{
            maxWidth: 720,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
            gap: 8,
          }}
        >
          {adminNavItems.map((item) => {
            const active = isActivePath(pathname, item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  minWidth: 0,
                  minHeight: 52,
                  borderRadius: 14,
                  textDecoration: 'none',
                  color: active ? '#ffffff' : '#111827',
                  background: active ? '#111827' : '#f9fafb',
                  border: active ? '1px solid #111827' : '1px solid #e5e7eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  padding: '8px 6px',
                  fontSize: 12,
                  fontWeight: 800,
                  lineHeight: 1.15,
                  overflowWrap: 'break-word',
                  wordBreak: 'break-word',
                  boxShadow: active ? '0 8px 18px rgba(17,24,39,0.16)' : 'none',
                }}
              >
                {item.label}
              </Link>
            )
          })}
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

          .admin-mobile-nav {
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