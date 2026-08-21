'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

const items = [
  { href: '/trev', label: 'Overview', icon: '⌂' },
  { href: '/today', label: 'Today', icon: '☀' },
  { href: '/trev/calendar', label: 'Calendar', icon: '◫' },
  { href: '/trev/quotes', label: 'Quotes', icon: '£' },
  { href: '/admin/inbox', label: 'Inbox', icon: '✉' },
  { href: '/jobs', label: 'Jobs', icon: '▣' },
] as const

export default function TrevMobileDock() {
  const pathname = usePathname()
  const isTrevOverview = pathname === '/trev'
  const isTrevArea = pathname.startsWith('/trev/')
  const isQuoteVisit = pathname.startsWith('/trev/quote/')

  useEffect(() => {
    if (!isTrevOverview) return

    const workerQuoteLinks = Array.from(
      document.querySelectorAll<HTMLAnchorElement>('a[href="/admin/inbox?source=worker-quote"]')
    )

    for (const link of workerQuoteLinks) {
      link.href = '/trev/quotes'
    }
  }, [isTrevOverview])

  useEffect(() => {
    document.body.classList.toggle('trev-quote-visit-active', isQuoteVisit)

    return () => {
      document.body.classList.remove('trev-quote-visit-active')
    }
  }, [isQuoteVisit])

  if (!isTrevOverview && !isTrevArea) return null

  return (
    <>
      {isQuoteVisit ? (
        <style>{`
          @media (max-width: 767px) {
            body.trev-quote-visit-active .trev-mobile-shell footer {
              padding-bottom: calc(88px + env(safe-area-inset-bottom)) !important;
            }

            body.trev-quote-visit-active .trev-mobile-shell main {
              min-height: 100dvh;
            }
          }
        `}</style>
      ) : null}

      <nav
        aria-label="Trev quick navigation"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-800 bg-zinc-950/95 px-1.5 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2 shadow-[0_-12px_30px_rgba(0,0,0,0.18)] backdrop-blur md:hidden"
      >
        <div className="mx-auto grid max-w-xl grid-cols-6 gap-1">
          {items.map((item) => {
            const active =
              pathname === item.href ||
              (item.href === '/trev/quotes' &&
                (pathname.startsWith('/trev/quotes') || pathname.startsWith('/trev/quote/'))) ||
              (item.href === '/trev/calendar' && pathname.startsWith('/trev/calendar'))

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-14 flex-col items-center justify-center rounded-xl px-0.5 py-1.5 text-center transition ${
                  active
                    ? 'bg-yellow-300 text-zinc-950'
                    : 'text-zinc-200 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="text-lg font-black leading-none" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="mt-1 text-[9px] font-black leading-none">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
