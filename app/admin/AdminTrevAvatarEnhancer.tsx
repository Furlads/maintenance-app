'use client'

import { useEffect } from 'react'

export default function AdminTrevAvatarEnhancer() {
  useEffect(() => {
    function enhance() {
      const root = document.querySelector('.admin-main')
      if (!root) return

      const elements = Array.from(root.querySelectorAll('div')) as HTMLElement[]
      const name = elements.find((element) => {
        if (element.children.length !== 0) return false
        const text = element.textContent?.trim() || ''
        return /^Trevor(?:\s|$)/i.test(text) || /^Trev(?:\s|$)/i.test(text)
      })

      if (!name) return

      const card = name.parentElement?.parentElement
      if (!card || card.querySelector('[data-worker-avatar="trevor"]')) return

      const firstChild = card.firstElementChild
      if (!(firstChild instanceof HTMLElement)) return

      const img = document.createElement('img')
      img.src = '/branding/workers/trevor-both-brands-avatar.webp'
      img.alt = 'Trevor · Furlads & Three Counties avatar'
      img.title = 'Trevor · Furlads & Three Counties'
      img.width = 48
      img.height = 48
      img.dataset.workerAvatar = 'trevor'
      img.style.width = '48px'
      img.style.height = '48px'
      img.style.flex = '0 0 48px'
      img.style.borderRadius = '999px'
      img.style.objectFit = 'cover'
      img.style.display = 'block'
      img.style.border = '2px solid #b59a45'

      firstChild.style.display = 'flex'
      firstChild.style.alignItems = 'center'
      firstChild.style.gap = '12px'
      firstChild.insertBefore(img, firstChild.firstChild)
    }

    enhance()
    const observer = new MutationObserver(enhance)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return null
}
