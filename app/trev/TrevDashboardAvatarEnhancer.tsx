'use client'

import { useEffect } from 'react'

const AVATARS = [
  { pattern: /^(?:trev|trevor)(?:\s|$)/i, src: '/branding/workers/trevor-both-brands-avatar.webp', border: '#b59a45' },
  { pattern: /^kelly(?:\s|$)/i, src: '/branding/workers/kelly-both-brands-avatar.webp', border: '#b59a45' },
  { pattern: /^jacob(?:\s|$)/i, src: '/avatars/jacob-three-counties.webp', border: '#84cc16' },
  { pattern: /^codie(?:\s|$)/i, src: '/branding/workers/codie-furlads-avatar.jpg', border: '#facc15' },
  { pattern: /^(?:steve|stephen)(?:\s|$)/i, src: '/branding/workers/steve-furlads-avatar.webp', border: '#facc15' },
  { pattern: /^(?:oli|oliver)(?:\s|$)/i, src: '/branding/workers/oli-furlads-avatar.webp', border: '#facc15' },
]

export default function TrevDashboardAvatarEnhancer() {
  useEffect(() => {
    function enhance() {
      const hero = document.querySelector('.trev-mobile-shell > main > div > section:first-child') as HTMLElement | null
      if (!hero) return

      const heroTitle = hero.querySelector('h1') as HTMLElement | null
      if (heroTitle) {
        heroTitle.style.color = '#ffffff'
        heroTitle.style.textShadow = '0 1px 1px rgba(0,0,0,.2)'
      }

      if (hero.querySelector('[data-dashboard-login-avatar]')) return

      const loggedIn = Array.from(hero.querySelectorAll('div')).find((element) =>
        (element.textContent || '').trim().startsWith('Logged in as:')
      ) as HTMLElement | undefined

      if (!loggedIn) return

      const name = (loggedIn.textContent || '').replace(/^Logged in as:\s*/i, '').trim()
      const config = AVATARS.find((item) => item.pattern.test(name))
      if (!config) return

      const textBlock = loggedIn.parentElement as HTMLElement | null
      if (!textBlock) return

      textBlock.style.position = 'relative'
      textBlock.style.paddingLeft = '88px'
      textBlock.style.minHeight = '76px'

      const img = document.createElement('img')
      img.src = config.src
      img.alt = `${name} avatar`
      img.title = name
      img.dataset.dashboardLoginAvatar = 'true'
      img.width = 74
      img.height = 74
      img.style.position = 'absolute'
      img.style.left = '0'
      img.style.top = '-2px'
      img.style.width = '74px'
      img.style.height = '74px'
      img.style.borderRadius = '999px'
      img.style.objectFit = 'cover'
      img.style.display = 'block'
      img.style.border = `3px solid ${config.border}`
      img.style.boxShadow = '0 10px 24px rgba(0,0,0,.28)'

      textBlock.insertBefore(img, textBlock.firstChild)
    }

    enhance()
    const observer = new MutationObserver(enhance)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return null
}
