'use client'

import { useEffect } from 'react'

export default function FurladsBrandPolish() {
  useEffect(() => {
    let cancelled = false

    async function applyBranding() {
      try {
        const authRes = await fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' })
        const auth = await authRes.json().catch(() => null)
        if (!authRes.ok || !auth?.authenticated || cancelled) return

        const name = String(auth.name || '').trim()
        if (/^jacob(?:\s|$)/i.test(name)) return

        const apply = () => {
          const root = document.querySelector('[data-today-dashboard-home]') as HTMLElement | null
          if (!root || root.querySelector('[data-furlads-brand-logo]')) return

          const top = root.querySelector('.worker-home-top') as HTMLElement | null
          const status = root.querySelector('.worker-home-status') as HTMLElement | null
          if (!top || !status) return

          const logo = document.createElement('img')
          logo.src = '/branding/furlads-logo.png'
          logo.alt = 'Furlads Garden Services'
          logo.title = 'Furlads Garden Services'
          logo.dataset.furladsBrandLogo = 'true'
          logo.style.width = '78px'
          logo.style.height = '78px'
          logo.style.objectFit = 'contain'
          logo.style.borderRadius = '16px'
          logo.style.background = '#facc15'
          logo.style.padding = '5px'
          logo.style.boxShadow = '0 8px 22px rgba(0,0,0,.24)'
          logo.style.flex = '0 0 78px'

          const wrap = document.createElement('div')
          wrap.dataset.furladsBrandLogo = 'true'
          wrap.style.display = 'flex'
          wrap.style.alignItems = 'center'
          wrap.style.gap = '10px'
          wrap.style.marginLeft = 'auto'
          wrap.appendChild(logo)
          wrap.appendChild(status)

          top.appendChild(wrap)

          if (window.matchMedia('(max-width: 520px)').matches) {
            logo.style.width = '64px'
            logo.style.height = '64px'
            logo.style.flexBasis = '64px'
            wrap.style.gap = '8px'
          }
        }

        apply()
        const observer = new MutationObserver(apply)
        observer.observe(document.body, { childList: true, subtree: true })
        return () => observer.disconnect()
      } catch {
        // Branding is cosmetic; leave the page functional if auth lookup fails.
      }
    }

    let cleanup: (() => void) | undefined
    void applyBranding().then((result) => {
      if (typeof result === 'function') cleanup = result
    })

    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [])

  return null
}
