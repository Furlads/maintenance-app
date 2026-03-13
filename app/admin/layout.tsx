"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"

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

const navItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/inbox", label: "Inbox" },

  { href: "/jobs", label: "Jobs" },
  { href: "/customers", label: "Customers" },
  { href: "/workers", label: "Workers" }
]

export default function AdminLayout({
  children
}: {
  children: React.ReactNode
}) {

  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">

      <div className="flex min-h-screen">

        {/* Desktop Sidebar */}
        <aside className="hidden xl:flex xl:w-72 flex-col border-r border-zinc-200 bg-white">

          <div className="border-b border-zinc-200 px-5 py-5">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">
              Furlads Admin
            </div>

            <div className="mt-2 text-2xl font-bold">
              Office Control
            </div>
          </div>

          <nav className="flex flex-col gap-1 p-4">

            {navItems.map((item) => {

              const active =
                pathname === item.href ||
                pathname.startsWith(item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 rounded-lg text-sm font-medium ${
                    active
                      ? "bg-black text-white"
                      : "text-zinc-700 hover:bg-zinc-100"
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}

          </nav>

        </aside>

        {/* Main Area */}
        <div className="flex-1 flex flex-col">

          {/* Mobile Header */}
          <header className="border-b border-zinc-200 bg-white px-4 py-3 flex items-center justify-between xl:hidden">

            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2"
            >
              {menuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>

            <div className="font-bold">
              Furlads Admin
            </div>

          </header>

          {/* Mobile Menu */}
          {menuOpen && (
            <div className="xl:hidden border-b border-zinc-200 bg-white">

              <nav className="flex flex-col gap-1 p-4">

                {navItems.map((item) => (

                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className="px-3 py-2 rounded-lg text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                  >
                    {item.label}
                  </Link>

                ))}

              </nav>

            </div>
          )}

          <main className="flex-1 p-4">
            {children}
          </main>

        </div>

      </div>

    </div>
  )
}