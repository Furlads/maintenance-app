'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

function routeMode(pathname: string) {
  if (pathname.startsWith('/admin')) return 'admin'
  if (pathname.startsWith('/trev') || pathname.startsWith('/kelly')) return 'office'
  if (
    pathname.startsWith('/today') ||
    pathname.startsWith('/worker') ||
    pathname.startsWith('/my-visits') ||
    pathname.startsWith('/chas') ||
    pathname.startsWith('/jobs') ||
    pathname.startsWith('/calendar')
  ) {
    return 'worker'
  }
  return 'public'
}

export default function GlobalAppPolish() {
  const pathname = usePathname()

  useEffect(() => {
    const body = document.body
    const mode = routeMode(pathname)

    body.classList.add('app-polished')
    body.classList.remove('app-worker-view', 'app-admin-view', 'app-office-view', 'app-public-view')
    body.classList.add(`app-${mode}-view`)
    body.dataset.appRoute = pathname

    let cancelled = false

    async function resolveBrand() {
      let brand = 'furlads'

      try {
        const stored = window.localStorage.getItem('company')
        if (stored === 'threecounties') brand = 'threecounties'

        const res = await fetch('/api/auth/me', {
          cache: 'no-store',
          credentials: 'include',
        })
        const data = await res.json().catch(() => null)
        const name = String(data?.name || '').trim()

        if (/^jacob(?:\s|$)/i.test(name)) brand = 'threecounties'
      } catch {
        // Styling should never block the app.
      }

      if (cancelled) return
      body.dataset.appBrand = brand
      body.classList.toggle('app-brand-three-counties', brand === 'threecounties')
      body.classList.toggle('app-brand-furlads', brand !== 'threecounties')
    }

    void resolveBrand()

    return () => {
      cancelled = true
    }
  }, [pathname])

  useEffect(() => {
    if (pathname !== '/quote-test') return

    function makePhotoPickerLibraryFriendly() {
      document
        .querySelectorAll<HTMLInputElement>('input[type="file"][accept*="image"]')
        .forEach((input) => input.removeAttribute('capture'))
    }

    function handlePhotoButtonClick(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Element)) return

      const button = target.closest('button[aria-label="Add site photos"]')
      if (!button) return

      makePhotoPickerLibraryFriendly()
    }

    makePhotoPickerLibraryFriendly()

    const observer = new MutationObserver(() => {
      makePhotoPickerLibraryFriendly()
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['capture'],
    })

    document.addEventListener('click', handlePhotoButtonClick, true)
    document.addEventListener('touchstart', makePhotoPickerLibraryFriendly, true)

    return () => {
      observer.disconnect()
      document.removeEventListener('click', handlePhotoButtonClick, true)
      document.removeEventListener('touchstart', makePhotoPickerLibraryFriendly, true)
    }
  }, [pathname])

  return null
}
