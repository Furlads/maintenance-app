'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import ChasAvatar from './ChasAvatar'

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
    const selector = 'h1,h2,h3,summary,button,a'

    function decorateChasReferences() {
      const template = document.querySelector('#chas-global-avatar-template > span') as HTMLElement | null
      if (!template) return

      document.querySelectorAll<HTMLElement>(selector).forEach((element) => {
        if (element.closest('#chas-global-avatar-template')) return
        if (element.dataset.chasIdentityDecorated === 'true') return
        if (!/\bchas\b/i.test(element.textContent || '')) return
        if (element.querySelector('[aria-label="Chas AI assistant for Furlads and Three Counties"]')) {
          element.dataset.chasIdentityDecorated = 'true'
          return
        }
        if (element.parentElement?.querySelector(':scope > [aria-label="Chas AI assistant for Furlads and Three Counties"]')) {
          element.dataset.chasIdentityDecorated = 'true'
          return
        }

        const avatar = template.cloneNode(true) as HTMLElement
        avatar.dataset.globalChasAvatar = 'true'
        avatar.setAttribute('aria-hidden', 'true')
        avatar.style.display = 'inline-block'
        avatar.style.verticalAlign = 'middle'
        avatar.style.marginRight = '8px'
        avatar.style.flex = '0 0 24px'
        avatar.style.width = '24px'
        avatar.style.height = '24px'
        avatar.style.minWidth = '24px'

        element.insertBefore(avatar, element.firstChild)
        element.dataset.chasIdentityDecorated = 'true'
      })
    }

    const timer = window.setTimeout(decorateChasReferences, 0)
    const observer = new MutationObserver(decorateChasReferences)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      window.clearTimeout(timer)
      observer.disconnect()
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
    const observer = new MutationObserver(makePhotoPickerLibraryFriendly)
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

  return (
    <div id="chas-global-avatar-template" style={{ display: 'none' }} aria-hidden="true">
      <ChasAvatar size={24} />
    </div>
  )
}
