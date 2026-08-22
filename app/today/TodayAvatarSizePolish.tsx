'use client'

import { useEffect } from 'react'

export default function TodayAvatarSizePolish() {
  useEffect(() => {
    function applySize() {
      const hero = document.querySelector('[data-today-dashboard-home] .today-v2-person')
      if (!hero) return

      const avatar = hero.querySelector('img[alt$=" avatar"]') as HTMLImageElement | null
      if (!avatar) return

      avatar.width = 74
      avatar.height = 74
      avatar.style.width = '74px'
      avatar.style.height = '74px'
      avatar.style.flex = '0 0 74px'
    }

    applySize()
    const observer = new MutationObserver(applySize)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return null
}
