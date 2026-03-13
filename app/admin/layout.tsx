"use client"

import { useState } from "react"
import Link from "next/link"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  const navItems = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/inbox", label: "Inbox" },
    { href: "/admin/quotes", label: "Quotes" },
    { href: "/admin/jobs", label: "Jobs" },
    { href: "/admin/customers", label: "Customers" },
    { href: "/admin/workers", label: "Workers" },
  ]

  return (
    <div className="min-h-screen flex bg-zinc-50 text-zinc-900">

      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex w-64 flex-col border-r border-zinc-200 bg-white p-5">
        <div className="text-xl font-bold mb-6">
          Furlads Admin
        </div>

        <nav className="flex flex-col gap-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-semibold hover:bg-zinc-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col">

        {/* Top bar */}
        <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">

          {/* Hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden text-2xl"
          >
            ☰
          </button>

          <div className="font-bold">
            Furlads Admin
          </div>

          <div className="text-sm text-zinc-500">
            Trevor / Kelly
          </div>
        </header>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-b border-zinc-200 bg-white px-4 py-3 flex flex-col gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-semibold hover:bg-zinc-100"
              >
                {item.label}
              </Link>
            ))}
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 p-6">
          {children}
        </main>

      </div>
    </div>
  )
}