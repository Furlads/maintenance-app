'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

const items = [
  { href: '/trev', label: 'Overview', icon: '⌂' },
  { href: '/today', label: 'Today', icon: '☀' },
  { href: '/trev/quotes', label: 'Quotes', icon: '£' },
  { href: '/admin/inbox', label: 'Inbox', icon: '✉' },
  { href: '/jobs', label: 'Jobs', icon: '▣' },
  { href: '/admin/todos', label: 'To-dos', icon: '✓' },
] as const

export default function TrevMobileDock() {
  const pathname = usePathname()
  const isTrevOverview = pathname === '/trev'
  const isTrevQuotes = pathname === '/trev/quotes'

  useEffect(() => {
    if (!isTrevOverview) return

    const workerQuoteLinks = Array.from(
      document.querySelectorAll<HTMLAnchorElement>('a[href="/admin/inbox?source=worker-quote"]')
    )

    for (const link of workerQuoteLinks) {
      link.href = '/trev/quotes'
    }
  }, [isTrevOverview])

  if (!isTrevOverview && !isTrevQuotes) return null

  return (
    <nav
      aria-label="Trev quick navigation"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-800 bg-zinc-950/95 px-1.5 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2 shadow-[0_-12px_30px_rgba(0,0,0,0.18)] backdrop-blur md:hidden"
    >
      <div className="mx-auto grid max-w-xl grid-cols-6 gap-1">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href === '/trev/quotes' && pathname.startsWith('/trev/quotes'))

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
  )
}
