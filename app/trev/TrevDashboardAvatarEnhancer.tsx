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
      if (!hero || hero.querySelector('[data-dashboard-login-avatar]')) return

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
      textBlock.style.paddingLeft = '70px'

      const img = document.createElement('img')
      img.src = config.src
      img.alt = `${name} avatar`
      img.title = name
      img.dataset.dashboardLoginAvatar = 'true'
      img.width = 56
      img.height = 56
      img.style.position = 'absolute'
      img.style.left = '0'
      img.style.top = '0'
      img.style.width = '56px'
      img.style.height = '56px'
      img.style.borderRadius = '999px'
      img.style.objectFit = 'cover'
      img.style.display = 'block'
      img.style.border = `3px solid ${config.border}`
      img.style.boxShadow = '0 8px 20px rgba(0,0,0,.25)'

      textBlock.insertBefore(img, textBlock.firstChild)
    }

    enhance()
    const observer = new MutationObserver(enhance)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return null
}
