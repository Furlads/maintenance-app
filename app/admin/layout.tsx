'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useMemo, useState } from 'react'

type NavItem = {
  href: string
  label: string
}

const navItems: NavItem[] = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/inbox', label: 'Inbox' },
  { href: '/admin/quotes', label: 'Quotes' },
  { href: '/admin/jobs', label: 'Jobs' },
  { href: '/admin/customers', label: 'Customers' },
  { href: '/admin/workers', label: 'Workers' },
]

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

function AdminNavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string
  onNavigate?: () => void
}) {
  return (
    <nav className="flex flex-col gap-1.5">
      {navItems.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== '/admin' && pathname.startsWith(item.href))

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              active
                ? 'bg-zinc-900 text-white'
                : 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900'
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  const pageTitle = useMemo(() => {
    if (pathname === '/admin') return 'Admin Dashboard'
    if (pathname.startsWith('/admin/inbox')) return 'Unified Inbox'
    if (pathname.startsWith('/admin/quotes')) return 'Quotes'
    if (pathname.startsWith('/admin/jobs')) return 'Jobs'
    if (pathname.startsWith('/admin/customers')) return 'Customers'
    if (pathname.startsWith('/admin/workers')) return 'Workers'
    return 'Admin'
  }, [pathname])

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-zinc-200 bg-white xl:flex xl:flex-col">
          <div className="border-b border-zinc-200 px-5 py-5">
            <div className="text-xs font-black uppercase tracking-[0.22em] text-zinc-500">
              Furlads Admin
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight">
              Office Control
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              One system for maintenance and landscaping.
            </p>
          </div>

          <div className="px-4 py-4">
            <AdminNavLinks pathname={pathname} />
          </div>

          <div className="mt-auto border-t border-zinc-200 px-5 py-4">
            <div className="rounded-2xl bg-zinc-100 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Built for office use
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-700">
                Maintenance, landscaping, quotes and messages all in one place.
              </p>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur">
            <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-300 bg-white text-zinc-800 xl:hidden"
                  aria-label="Open admin menu"
                >
                  {menuOpen ? <CloseIcon /> : <MenuIcon />}
                </button>

                <div>
                  <div className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500 xl:hidden">
                    Furlads Admin
                  </div>
                  <h1 className="text-lg font-bold tracking-tight sm:text-xl">
                    {pageTitle}
                  </h1>
                </div>
              </div>

              <div className="hidden text-sm font-medium text-zinc-500 sm:block">
                Trevor / Kelly
              </div>
            </div>

            {menuOpen ? (
              <div className="border-t border-zinc-200 bg-white px-4 py-4 xl:hidden">
                <AdminNavLinks
                  pathname={pathname}
                  onNavigate={() => setMenuOpen(false)}
                />
              </div>
            ) : null}
          </header>

          <main className="flex-1 px-4 py-4 sm:px-6">{children}</main>
        </div>
      </div>
    </div>
  )
}