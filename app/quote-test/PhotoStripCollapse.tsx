'use client'

import { useEffect } from 'react'

export default function PhotoStripCollapse() {
  useEffect(() => {
    let observer: MutationObserver | null = null

    function update() {
      const labels = Array.from(document.querySelectorAll<HTMLElement>('div')).filter((element) => {
        const text = (element.textContent || '').trim()
        return element.children.length === 0 && ['Uploading', 'Ready', 'Failed'].includes(text)
      })

      if (!labels.length) {
        document.querySelector('[data-photo-collapse-toggle]')?.remove()
        return
      }

      const cards = labels
        .map((label) => label.parentElement)
        .filter((card): card is HTMLElement => Boolean(card))

      const strip = cards[0]?.parentElement as HTMLElement | null
      if (!strip || !cards.every((card) => card.parentElement === strip)) return

      const total = labels.length
      const ready = labels.filter((label) => (label.textContent || '').trim() === 'Ready').length
      const uploading = labels.filter((label) => (label.textContent || '').trim() === 'Uploading').length
      const failed = labels.filter((label) => (label.textContent || '').trim() === 'Failed').length

      if (uploading > 0) {
        strip.style.display = ''
        const toggle = document.querySelector<HTMLElement>('[data-photo-collapse-toggle]')
        if (toggle) toggle.style.display = 'none'
        return
      }

      let toggle = document.querySelector<HTMLButtonElement>('[data-photo-collapse-toggle]')
      if (!toggle) {
        toggle = document.createElement('button')
        toggle.type = 'button'
        toggle.dataset.photoCollapseToggle = 'true'
        toggle.className = 'mb-3 flex min-h-11 w-full items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-left text-sm font-black text-zinc-800'
        strip.parentElement?.insertBefore(toggle, strip)
        toggle.addEventListener('click', () => {
          const hidden = strip.style.display === 'none'
          strip.style.display = hidden ? '' : 'none'
          toggle!.dataset.expanded = hidden ? 'true' : 'false'
          update()
        })
      }

      toggle.style.display = ''
      const expanded = toggle.dataset.expanded === 'true'
      toggle.replaceChildren()

      const left = document.createElement('span')
      left.textContent = failed > 0
        ? `${ready} of ${total} photos ready · ${failed} failed`
        : `${ready} photos attached ✓`

      const right = document.createElement('span')
      right.className = 'text-xs font-black text-zinc-500'
      right.textContent = expanded ? 'Hide photos ↑' : 'Show photos ↓'

      toggle.append(left, right)
      strip.style.display = expanded ? '' : 'none'
    }

    observer = new MutationObserver(update)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    update()

    return () => {
      observer?.disconnect()
      document.querySelector('[data-photo-collapse-toggle]')?.remove()
    }
  }, [])

  return null
}
