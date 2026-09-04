'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

export const dynamic = 'force-dynamic'

type AdminLayoutProps = { children: React.ReactNode }
type IconName = 'calendar' | 'inbox' | 'quotes' | 'jobs' | 'more'
type Profile = { name: string; role: string; avatar: string | null }

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
  const [profile, setProfile] = useState<Profile | null>(null)
  const moreActive = mobileMoreNavItems.some((item) => isActivePath(pathname, item.href))

  useEffect(() => setMoreOpen(false), [pathname])

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/profile', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data?.ok) {
          setProfile({ name: data.name, role: data.role, avatar: data.avatar || null })
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  return (
    <div style={{ minHeight: '100dvh', background: '#f4f4f5', color: '#111827' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 40, background: '#18181b', borderBottom: '1px solid #3f3f46' }}>
        <div className="admin-header-inner" style={{ maxWidth: 1400, margin: '0 auto', padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div className="admin-profile-avatar" style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 999, overflow: 'hidden', background: '#facc15', border: '2px solid #facc15', display: 'grid', placeItems: 'center' }}>
              {profile?.avatar ? (
                <img src={profile.avatar} alt={profile.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ color: '#111827', fontWeight: 900, fontSize: 17 }}>{profile?.name?.charAt(0) || 'F'}</span>
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="admin-profile-kicker" style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#facc15', marginBottom: 2 }}>
                {profile?.name ? `${profile.name} dashboard` : 'Admin dashboard'}
              </div>
              <div className="admin-control-title" style={{ fontSize: 18, fontWeight: 950, lineHeight: 1.05, color: '#facc15', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Furlads Control Centre</div>
            </div>
          </div>
          <Link className="admin-worker-view" href="/admin/worker-view" style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 42, padding: '0 11px', borderRadius: 11, background: '#facc15', color: '#111827', textDecoration: 'none', fontSize: 13, fontWeight: 900, whiteSpace: 'nowrap' }}>Worker View</Link>
        </div>
      </header>

      <div className="admin-layout-shell" style={{ maxWidth: 1400, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr' }}>
        <aside className="admin-sidebar" style={{ display: 'none', borderRight: '1px solid #e4e4e7', background: '#fafafa' }}>
          <div style={{ padding: 20, position: 'sticky', top: 75 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 14 }}>Admin navigation</div>
            <nav aria-label="Admin navigation" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {adminNavItems.map((item) => {
                const active = isActivePath(pathname, item.href)
                return <Link key={item.href} href={item.href} style={{ display: 'flex', alignItems: 'center', minHeight: 48, padding: '0 14px', borderRadius: 14, background: active ? '#facc15' : '#ffffff', color: '#111827', textDecoration: 'none', fontSize: 15, fontWeight: 850, border: active ? '1px solid #eab308' : '1px solid #d4d4d8', boxShadow: active ? '0 4px 14px rgba(0,0,0,0.06)' : 'none' }}>{item.label}</Link>
              })}
            </nav>
          </div>
        </aside>
        <main style={{ minWidth: 0, padding: '14px 12px 104px', color: '#111827' }}>{children}</main>
      </div>

      {moreOpen ? <div className="admin-mobile-more" style={{ position: 'fixed', left: 10, right: 10, bottom: 80, zIndex: 60, background: '#ffffff', border: '1px solid #d4d4d8', borderRadius: 18, boxShadow: '0 18px 46px rgba(0,0,0,0.18)', padding: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#52525b', padding: '5px 7px 9px' }}>More</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>{mobileMoreNavItems.map((item) => { const active = isActivePath(pathname, item.href); return <Link key={item.href} href={item.href} style={{ minHeight: 50, display: 'flex', alignItems: 'center', padding: '0 12px', borderRadius: 12, border: '1px solid #d4d4d8', background: active ? '#facc15' : '#fafafa', color: '#111827', textDecoration: 'none', fontSize: 13, fontWeight: 850 }}>{item.label}</Link> })}</div>
      </div> : null}

      <nav className="admin-mobile-nav" aria-label="Mobile admin navigation" style={{ position: 'fixed', left: 10, right: 10, bottom: 8, zIndex: 70, display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 2, padding: 5, borderRadius: 20, background: '#18181b', border: '1px solid #3f3f46', boxShadow: '0 14px 34px rgba(0,0,0,0.24)' }}>
        {mobilePrimaryNavItems.map((item) => { const active = isActivePath(pathname,item.href); return <Link key={item.href} href={item.href} style={{ minWidth: 0, minHeight: 54, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 15, background: active ? '#facc15' : 'transparent', color: active ? '#111827' : '#facc15', textDecoration: 'none', fontSize: 10, fontWeight: 900 }}><NavIcon name={item.icon}/><span>{item.label}</span></Link> })}
        <button type="button" onClick={() => setMoreOpen((current) => !current)} aria-expanded={moreOpen} aria-label="Open more admin navigation" style={{ minWidth: 0, minHeight: 54, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, border: 0, borderRadius: 15, background: moreOpen || moreActive ? '#facc15' : 'transparent', color: moreOpen || moreActive ? '#111827' : '#facc15', font: 'inherit', fontSize: 10, fontWeight: 900, cursor: 'pointer' }}><NavIcon name="more"/><span>More</span></button>
      </nav>

      <style jsx global>{`
        .admin-layout-shell > main, .admin-layout-shell > main * { color: #111827; }

        /* White text is never allowed in admin content. */
        .admin-layout-shell main .text-white,
        .admin-layout-shell main a[class*='text-white'],
        .admin-layout-shell main button[class*='text-white'] {
          color: #facc15 !important;
        }

        /* Dark controls stay dark and always use Furlads yellow text. */
        .admin-layout-shell main .bg-zinc-950,
        .admin-layout-shell main .bg-zinc-900,
        .admin-layout-shell main .bg-black {
          background-color: #18181b !important;
          color: #facc15 !important;
        }
        .admin-layout-shell main .bg-zinc-950 *,
        .admin-layout-shell main .bg-zinc-900 *,
        .admin-layout-shell main .bg-black * {
          color: #facc15 !important;
        }

        /* Main page heroes keep the Trev-dashboard feel: clean cards, dark readable type. */
        .admin-layout-shell main > div > section:first-child {
          border-radius: 18px !important;
          box-shadow: 0 10px 26px rgba(0,0,0,0.08) !important;
        }
        .admin-layout-shell main > div > section:first-child * { color: #111827; }
        .admin-layout-shell main > div > section:first-child .bg-zinc-950,
        .admin-layout-shell main > div > section:first-child .bg-zinc-900,
        .admin-layout-shell main > div > section:first-child .bg-black,
        .admin-layout-shell main > div > section:first-child .bg-zinc-950 *,
        .admin-layout-shell main > div > section:first-child .bg-zinc-900 *,
        .admin-layout-shell main > div > section:first-child .bg-black * {
          color: #facc15 !important;
        }

        .admin-layout-shell main a,
        .admin-layout-shell main button,
        .admin-layout-shell main input,
        .admin-layout-shell main select,
        .admin-layout-shell main textarea {
          -webkit-tap-highlight-color: transparent;
        }

        .admin-layout-shell main .overflow-x-auto {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .admin-layout-shell main .overflow-x-auto::-webkit-scrollbar { display: none; }

        @media (min-width: 600px) {
          .admin-header-inner { padding: 12px 16px !important; gap: 12px !important; }
          .admin-profile-avatar { width: 50px !important; height: 50px !important; }
          .admin-profile-kicker { font-size: 11px !important; letter-spacing: 0.16em !important; }
          .admin-control-title { font-size: 22px !important; }
          .admin-worker-view { min-height: 44px !important; padding: 0 14px !important; border-radius: 12px !important; font-size: 14px !important; }
          .admin-layout-shell > main { padding: 18px 16px 112px !important; }
          .admin-mobile-nav { left: 16px !important; right: 16px !important; bottom: 12px !important; padding: 7px !important; border-radius: 24px !important; gap: 4px !important; }
          .admin-mobile-more { left: 16px !important; right: 16px !important; bottom: 94px !important; border-radius: 22px !important; padding: 12px !important; }
        }

        @media (min-width: 900px) {
          .admin-layout-shell { grid-template-columns: 240px 1fr !important; }
          .admin-sidebar { display: block !important; }
          .admin-mobile-nav,.admin-mobile-more { display:none !important; }
          .admin-layout-shell > main { padding: 24px 28px 48px !important; }
          .admin-layout-shell main > div > section:first-child { border-radius: 24px !important; }
        }
      `}</style>
    </div>
  )
}
