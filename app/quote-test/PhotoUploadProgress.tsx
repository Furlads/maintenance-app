'use client'

import { useEffect } from 'react'

export default function PhotoUploadProgress() {
  useEffect(() => {
    let frame = 0
    let observer: MutationObserver | null = null

    function findStatusLabels() {
      return Array.from(document.querySelectorAll<HTMLElement>('div')).filter((element) => {
        const text = (element.textContent || '').trim()
        return element.children.length === 0 && ['Uploading', 'Ready', 'Failed'].includes(text)
      })
    }

    function renderProgress() {
      frame = 0
      observer?.disconnect()

      try {
        const statusLabels = findStatusLabels()
        const existing = document.querySelector<HTMLElement>('[data-photo-upload-progress="true"]')

        if (!statusLabels.length) {
          existing?.remove()
          return
        }

        const cards = statusLabels
          .map((label) => label.parentElement)
          .filter((card): card is HTMLElement => Boolean(card))

        const strip = cards[0]?.parentElement as HTMLElement | null
        if (!strip || !cards.every((card) => card.parentElement === strip)) return

        const total = statusLabels.length
        const ready = statusLabels.filter((label) => label.textContent?.trim() === 'Ready').length
        const failed = statusLabels.filter((label) => label.textContent?.trim() === 'Failed').length
        const uploading = total - ready - failed
        const finished = ready + failed
        const percent = total ? Math.round((finished / total) * 100) : 0

        let progress = existing
        if (!progress || progress.nextElementSibling !== strip) {
          progress?.remove()
          progress = document.createElement('div')
          progress.dataset.photoUploadProgress = 'true'
          progress.className = 'mb-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2.5'
          strip.parentElement?.insertBefore(progress, strip)
        }

        const titleText = uploading > 0
          ? `Uploading photos… ${ready} of ${total} ready`
          : failed > 0
            ? `${ready} of ${total} photos ready`
            : `All ${total} photos ready ✓`

        const detailText = uploading > 0
          ? `${uploading} still uploading`
          : failed > 0
            ? `${failed} failed`
            : 'Done'

        const stateKey = `${titleText}|${detailText}|${percent}|${failed}`
        if (progress.dataset.progressState === stateKey) return
        progress.dataset.progressState = stateKey

        progress.replaceChildren()

        const top = document.createElement('div')
        top.className = 'flex items-center justify-between gap-3'

        const title = document.createElement('div')
        title.className = 'text-xs font-black text-zinc-800'
        title.textContent = titleText

        const detail = document.createElement('div')
        detail.className = `text-[11px] font-black ${uploading > 0 ? 'text-zinc-500' : failed > 0 ? 'text-red-700' : 'text-green-700'}`
        detail.textContent = detailText

        const track = document.createElement('div')
        track.className = 'mt-2 h-2 overflow-hidden rounded-full bg-zinc-200'

        const fill = document.createElement('div')
        fill.className = `h-full rounded-full transition-all duration-300 ${failed > 0 && uploading === 0 ? 'bg-red-600' : 'bg-green-600'}`
        fill.style.width = `${percent}%`
        if (uploading > 0 && percent === 0) fill.style.width = '8%'

        top.append(title, detail)
        track.appendChild(fill)
        progress.append(top, track)
      } finally {
        observer?.observe(document.body, {
          childList: true,
          subtree: true,
          characterData: true,
        })
      }
    }

    function scheduleRender() {
      if (frame) return
      frame = window.requestAnimationFrame(renderProgress)
    }

    observer = new MutationObserver(scheduleRender)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    })

    scheduleRender()

    return () => {
      observer?.disconnect()
      if (frame) window.cancelAnimationFrame(frame)
      document.querySelector('[data-photo-upload-progress="true"]')?.remove()
    }
  }, [])

  return null
}
