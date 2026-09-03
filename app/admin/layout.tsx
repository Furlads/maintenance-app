'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

export const dynamic = 'force-dynamic'

type AdminLayoutProps = { children: React.ReactNode }
type IconName = 'calendar' | 'inbox' | 'quotes' | 'jobs' | 'more'

const adminNavItems = [
  { href: '/admin/schedule', label: 'Schedule' },
  { href: '/admin/inbox', label: 'Inbox' },
  { href: '/admin/quotes', label: 'Quotes' },
  { href: '/admin/maintenance-opportunities', label: 'Opportunities' },
  { href: '/admin/subcontractors', label: 'Subcontractors' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/customers', label: 'Customers' },
  { href: '/workers', label: 'Workers' },
  { href: '/kelly/notes-summary', label: 'Notes Summary' },
]

const mobilePrimaryNavItems: Array<{ href: string; label: string; icon: IconName }> = [
  { href: '/admin/schedule', label: 'Schedule', icon: 'calendar' },
  { href: '/admin/inbox', label: 'Inbox', icon: 'inbox' },
  { href: '/admin/quotes', label: 'Quotes', icon: 'quotes' },
  { href: '/jobs', label: 'Jobs', icon: 'jobs' },
]

const mobileMoreNavItems = [
  { href: '/admin/subcontractors', label: 'Subcontractors' },
  { href: '/admin/maintenance-opportunities', label: 'Opportunities' },
  { href: '/customers', label: 'Customers' },
  { href: '/workers', label: 'Workers' },
  { href: '/kelly/notes-summary', label: 'Notes Summary' },
]

function isActivePath(pathname: string, href: string) {
  if (href === '/admin/schedule') return pathname === '/admin' || pathname === '/admin/schedule'
  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavIcon({ name }: { name: IconName }) {
  const commonProps = { width: 21, height: 21, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  if (name === 'calendar') return <svg {...commonProps}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>
  if (name === 'inbox') return <svg {...commonProps}><path d="M4 4h16v13a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V4Z" /><path d="M4 14h4l2 3h4l2-3h4" /></svg>
  if (name === 'quotes') return <svg {...commonProps}><path d="M6 3h9l3 3v15H6z" /><path d="M14 3v4h4M9 12h6M9 16h4" /></svg>
  if (name === 'jobs') return <svg {...commonProps}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" /></svg>
  return <svg {...commonProps}><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></svg>
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const moreActive = mobileMoreNavItems.some((item) => isActivePath(pathname, item.href))
  useEffect(() => setMoreOpen(false), [pathname])

  return (
    <div style={{ minHeight: '100dvh', background: 'linear-gradient(180deg,#07101d 0%,#0b1626 55%,#101b2b 100%)', color: '#f8fafc' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 40, background: 'rgba(7,16,29,0.96)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(250,204,21,0.24)' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#facc15', marginBottom: 3 }}>Admin</div>
            <div style={{ fontSize: 20, fontWeight: 900, lineHeight: 1.1, color: '#facc15', wordBreak: 'break-word' }}>Furlads Control Centre</div>
          </div>
          <Link href="/admin/worker-view" style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, padding: '0 14px', borderRadius: 12, background: '#facc15', color: '#111827', textDecoration: 'none', fontSize: 14, fontWeight: 900, whiteSpace: 'nowrap' }}>Worker View</Link>
        </div>
      </header>

      <div className="admin-layout-shell" style={{ maxWidth: 1400, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr' }}>
        <aside className="admin-sidebar" style={{ display: 'none', borderRight: '1px solid rgba(255,255,255,0.10)', background: '#081321' }}>
          <div style={{ padding: 20, position: 'sticky', top: 73 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#facc15', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>Admin Navigation</div>
            <nav aria-label="Admin navigation" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {adminNavItems.map((item) => {
                const active = isActivePath(pathname, item.href)
                return <Link key={item.href} href={item.href} style={{ display: 'flex', alignItems: 'center', minHeight: 48, padding: '0 14px', borderRadius: 14, background: active ? '#facc15' : '#111d2d', color: active ? '#111827' : '#facc15', textDecoration: 'none', fontSize: 15, fontWeight: 800, border: active ? '1px solid #facc15' : '1px solid rgba(250,204,21,0.16)' }}>{item.label}</Link>
              })}
            </nav>
          </div>
        </aside>
        <main style={{ minWidth: 0, padding: '18px 16px 112px' }}>{children}</main>
      </div>

      {moreOpen ? <div className="admin-mobile-more" style={{ position: 'fixed', left: 16, right: 16, bottom: 94, zIndex: 60, background: '#0d1928', border: '1px solid rgba(250,204,21,0.24)', borderRadius: 22, boxShadow: '0 20px 50px rgba(0,0,0,0.42)', padding: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#facc15', padding: '6px 8px 10px' }}>More</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>{mobileMoreNavItems.map((item) => { const active = isActivePath(pathname, item.href); return <Link key={item.href} href={item.href} style={{ minHeight: 52, display: 'flex', alignItems: 'center', padding: '0 14px', borderRadius: 14, border: '1px solid rgba(250,204,21,0.16)', background: active ? '#facc15' : '#142236', color: active ? '#111827' : '#facc15', textDecoration: 'none', fontSize: 14, fontWeight: 800 }}>{item.label}</Link> })}</div>
      </div> : null}

      <nav className="admin-mobile-nav" aria-label="Mobile admin navigation" style={{ position: 'fixed', left: 16, right: 16, bottom: 12, zIndex: 70, display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 4, padding: 7, borderRadius: 24, background: 'rgba(7,16,29,0.98)', border: '1px solid rgba(250,204,21,0.18)', boxShadow: '0 15px 40px rgba(0,0,0,0.42)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
        {mobilePrimaryNavItems.map((item) => { const active = isActivePath(pathname,item.href); return <Link key={item.href} href={item.href} style={{ minWidth: 0, minHeight: 58, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 18, background: active ? '#facc15' : 'transparent', color: active ? '#111827' : '#facc15', textDecoration: 'none', fontSize: 11, fontWeight: 900 }}><NavIcon name={item.icon}/><span>{item.label}</span></Link> })}
        <button type="button" onClick={() => setMoreOpen((current) => !current)} aria-expanded={moreOpen} aria-label="Open more admin navigation" style={{ minWidth: 0, minHeight: 58, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, border: 0, borderRadius: 18, background: moreOpen || moreActive ? '#facc15' : 'transparent', color: moreOpen || moreActive ? '#111827' : '#facc15', font: 'inherit', fontSize: 11, fontWeight: 900, cursor: 'pointer' }}><NavIcon name="more"/><span>More</span></button>
      </nav>

      <style jsx global>{`
        .admin-layout-shell > main > * { color: #111827; }

        /* Dashboard hero only: Furlads yellow, dark type, no white panel or white text. */
        .admin-layout-shell main > div > section:first-child {
          background: linear-gradient(135deg,#facc15 0%,#fde047 100%) !important;
          border-color: #eab308 !important;
          color: #111827 !important;
        }
        .admin-layout-shell main > div > section:first-child * {
          color: #111827 !important;
        }
        .admin-layout-shell main > div > section:first-child a {
          background: #111827 !important;
          color: #facc15 !important;
          border-color: #111827 !important;
        }
        .admin-layout-shell main > div > section:first-child a:last-child {
          background: #fff3a3 !important;
          color: #111827 !important;
          border-color: #eab308 !important;
        }

        @media (min-width: 900px) {
          .admin-layout-shell { grid-template-columns: 240px 1fr !important; }
          .admin-sidebar { display: block !important; }
          .admin-mobile-nav,.admin-mobile-more { display:none !important; }
        }
      `}</style>
    </div>
  )
}
