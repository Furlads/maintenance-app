'use client'

import { useEffect } from 'react'

const LOGO_SRC = '/branding/three-counties/three-counties-property-care-logo.webp'

export default function JacobBrandPolish() {
  useEffect(() => {
    function polish() {
      const page = document.querySelector('.worker-home-three-counties') as HTMLElement | null
      if (!page) return

      const hero = page.querySelector('.worker-home-hero') as HTMLElement | null
      const top = page.querySelector('.worker-home-top') as HTMLElement | null
      if (!hero || !top) return

      hero.style.position = 'relative'
      hero.style.overflow = 'hidden'

      if (!hero.querySelector('[data-three-counties-glow]')) {
        const glow = document.createElement('div')
        glow.dataset.threeCountiesGlow = 'true'
        glow.setAttribute('aria-hidden', 'true')
        Object.assign(glow.style, {
          position: 'absolute',
          right: '-70px',
          top: '-90px',
          width: '250px',
          height: '250px',
          borderRadius: '999px',
          background: 'radial-gradient(circle, rgba(168,207,69,.18), rgba(168,207,69,0) 68%)',
          pointerEvents: 'none',
        })
        hero.insertBefore(glow, hero.firstChild)
      }

      if (!top.querySelector('[data-three-counties-logo]')) {
        const logoWrap = document.createElement('div')
        logoWrap.dataset.threeCountiesLogo = 'true'
        Object.assign(logoWrap.style, {
          marginLeft: 'auto',
          width: '112px',
          minWidth: '112px',
          borderRadius: '14px',
          background: 'rgba(255,255,255,.96)',
          padding: '7px',
          boxShadow: '0 8px 24px rgba(0,0,0,.14)',
          position: 'relative',
          zIndex: '1',
        })

        const logo = document.createElement('img')
        logo.src = LOGO_SRC
        logo.alt = 'Three Counties Property Care Ltd'
        logo.title = 'Three Counties Property Care Ltd'
        Object.assign(logo.style, {
          width: '100%',
          height: 'auto',
          display: 'block',
          borderRadius: '8px',
        })

        logoWrap.appendChild(logo)
        top.appendChild(logoWrap)
      }

      top.style.position = 'relative'
      top.style.zIndex = '1'

      const brandLine = page.querySelector('.worker-home-brand') as HTMLElement | null
      if (brandLine) {
        brandLine.textContent = 'Three Counties Property Care Ltd'
        brandLine.style.color = '#b5d766'
      }

      const weather = page.querySelector('.worker-home-weather') as HTMLElement | null
      if (weather) {
        weather.style.background = 'rgba(9,27,12,.42)'
        weather.style.borderColor = 'rgba(181,215,102,.24)'
      }

      const tools = page.querySelector('.worker-home-tools') as HTMLElement | null
      if (tools) {
        tools.style.boxShadow = '0 10px 26px rgba(31,58,20,.08)'
      }

      const primary = page.querySelector('.worker-home-action-primary') as HTMLElement | null
      if (primary) {
        primary.style.boxShadow = '0 8px 18px rgba(117,154,45,.22)'
      }

      const cards = Array.from(page.querySelectorAll('.worker-home-action')) as HTMLElement[]
      for (const card of cards) {
        card.style.transition = 'transform .15s ease, box-shadow .15s ease'
      }

      if (window.innerWidth <= 560) {
        const logoWrap = top.querySelector('[data-three-counties-logo]') as HTMLElement | null
        if (logoWrap) {
          logoWrap.style.width = '82px'
          logoWrap.style.minWidth = '82px'
          logoWrap.style.padding = '5px'
        }
      }
    }

    polish()
    const observer = new MutationObserver(polish)
    observer.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('resize', polish)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', polish)
    }
  }, [])

  return null
}
