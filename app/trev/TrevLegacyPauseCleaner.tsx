'use client'

import { useEffect } from 'react'

export default function TrevLegacyPauseCleaner() {
  useEffect(() => {
    function cleanLegacyPausedLabels() {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>('span,div'))

      for (const node of nodes) {
        if (node.children.length > 0) continue
        if ((node.textContent || '').trim() !== 'Paused') continue

        node.textContent = 'On site'
        node.classList.remove('bg-yellow-50', 'text-yellow-800', 'ring-yellow-200')
        node.classList.add('bg-green-50', 'text-green-700', 'ring-green-200')
      }
    }

    cleanLegacyPausedLabels()

    const observer = new MutationObserver(cleanLegacyPausedLabels)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [])

  return null
}
