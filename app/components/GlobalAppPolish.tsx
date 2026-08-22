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

function directText(element: Element) {
  return Array.from(element.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent || '')
    .join(' ')
    .trim()
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
    const template = () => document.querySelector('#chas-global-avatar-template > span') as HTMLElement | null

    function makeAvatar(size: number) {
      const source = template()
      if (!source) return null
      const avatar = source.cloneNode(true) as HTMLElement
      avatar.dataset.globalChasAvatar = 'true'
      avatar.setAttribute('aria-hidden', 'true')
      avatar.style.display = 'inline-block'
      avatar.style.width = `${size}px`
      avatar.style.height = `${size}px`
      avatar.style.minWidth = `${size}px`
      avatar.style.flex = `0 0 ${size}px`
      avatar.style.margin = '0'
      avatar.style.verticalAlign = 'middle'
      return avatar
    }

    function replaceLegacyChasIdentity() {
      // Trev quote header: replace the old black/yellow "C" badge with the real Chas portrait.
      const quoteTitle = Array.from(document.querySelectorAll<HTMLElement>('h1,h2,h3,div,span')).find((element) =>
        /CHAS\s*[·•-]\s*New Quote/i.test(element.textContent || '')
      )
      if (quoteTitle) {
        const textBlock = quoteTitle.closest('div') || quoteTitle
        const headerRow = textBlock.parentElement
        const possibleBadge = headerRow?.firstElementChild as HTMLElement | null
        if (possibleBadge && !possibleBadge.querySelector('[data-global-chas-avatar="true"]')) {
          const badgeText = (possibleBadge.textContent || '').trim()
          if (badgeText === 'C') {
            const avatar = makeAvatar(58)
            if (avatar) {
              possibleBadge.replaceChildren(avatar)
              possibleBadge.style.background = 'transparent'
              possibleBadge.style.border = '0'
              possibleBadge.style.width = '58px'
              possibleBadge.style.height = '58px'
              possibleBadge.style.minWidth = '58px'
              possibleBadge.style.padding = '0'
              possibleBadge.style.overflow = 'visible'
              possibleBadge.style.display = 'grid'
              possibleBadge.style.placeItems = 'center'
            }
          }
        }
      }

      // Today-page Chas modal: replace the old smiley/hard-hat mascot in the header.
      const helpText = Array.from(document.querySelectorAll<HTMLElement>('div,p,span')).find(
        (element) => directText(element) === 'Friendly on-site help'
      )
      if (helpText) {
        const textBlock = helpText.parentElement
        const oldMascot = textBlock?.previousElementSibling as HTMLElement | null
        if (oldMascot && !oldMascot.querySelector('[data-global-chas-avatar="true"]')) {
          const avatar = makeAvatar(54)
          if (avatar) {
            oldMascot.replaceChildren(avatar)
            oldMascot.style.width = '54px'
            oldMascot.style.height = '54px'
            oldMascot.style.minWidth = '54px'
            oldMascot.style.background = 'transparent'
            oldMascot.style.border = '0'
            oldMascot.style.padding = '0'
            oldMascot.style.overflow = 'visible'
            oldMascot.style.display = 'grid'
            oldMascot.style.placeItems = 'center'
          }
        }
      }
    }

    function decorateChasReferences() {
      replaceLegacyChasIdentity()

      const source = template()
      if (!source) return
      const selector = 'h1,h2,h3,summary,button,a'

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

        const avatar = makeAvatar(24)
        if (!avatar) return
        avatar.style.marginRight = '8px'

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
