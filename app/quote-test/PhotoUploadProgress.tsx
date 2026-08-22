'use client'

import { useEffect } from 'react'

export default function PhotoUploadProgress() {
  useEffect(() => {
    function updateProgress() {
      const statusLabels = Array.from(document.querySelectorAll('div')).filter((element) => {
        const text = (element.textContent || '').trim()
        return element.children.length === 0 && ['Uploading', 'Ready', 'Failed'].includes(text)
      }) as HTMLElement[]

      if (!statusLabels.length) {
        document.querySelector('[data-photo-upload-progress]')?.remove()
        return
      }

      const cards = statusLabels
        .map((label) => label.parentElement)
        .filter((card): card is HTMLElement => Boolean(card))

      const strip = cards[0]?.parentElement
      if (!strip || !cards.every((card) => card.parentElement === strip)) return

      const total = statusLabels.length
      const ready = statusLabels.filter((label) => label.textContent?.trim() === 'Ready').length
      const failed = statusLabels.filter((label) => label.textContent?.trim() === 'Failed').length
      const uploading = total - ready - failed
      const finished = ready + failed

      let progress = strip.previousElementSibling as HTMLElement | null
      if (!progress || progress.dataset.photoUploadProgress !== 'true') {
        progress = document.createElement('div')
        progress.dataset.photoUploadProgress = 'true'
        progress.style.marginBottom = '10px'
        progress.style.borderRadius = '14px'
        progress.style.border = '1px solid #e4e4e7'
        progress.style.background = '#fafafa'
        progress.style.padding = '10px 12px'
        strip.parentElement?.insertBefore(progress, strip)
      }

      progress.innerHTML = ''

      const top = document.createElement('div')
      top.style.display = 'flex'
      top.style.alignItems = 'center'
      top.style.justifyContent = 'space-between'
      top.style.gap = '10px'

      const title = document.createElement('div')
      title.style.fontSize = '12px'
      title.style.fontWeight = '900'
      title.style.color = '#27272a'
      title.textContent = uploading > 0
        ? `Uploading photos… ${ready} of ${total} ready`
        : failed > 0
          ? `${ready} of ${total} photos ready`
          : `All ${total} photos ready ✓`

      const detail = document.createElement('div')
      detail.style.fontSize = '11px'
      detail.style.fontWeight = '800'
      detail.style.color = uploading > 0 ? '#71717a' : failed > 0 ? '#b91c1c' : '#15803d'
      detail.textContent = uploading > 0
        ? `${uploading} still uploading`
        : failed > 0
          ? `${failed} failed`
          : 'Done'

      top.appendChild(title)
      top.appendChild(detail)

      const track = document.createElement('div')
      track.style.position = 'relative'
      track.style.height = '8px'
      track.style.marginTop = '8px'
      track.style.overflow = 'hidden'
      track.style.borderRadius = '999px'
      track.style.background = '#e4e4e7'

      const fill = document.createElement('div')
      const countPercent = total ? (finished / total) * 100 : 0
      fill.style.height = '100%'
      fill.style.width = `${countPercent}%`
      fill.style.minWidth = uploading > 0 && finished === 0 ? '8%' : '0'
      fill.style.borderRadius = '999px'
      fill.style.background = failed > 0 && uploading === 0 ? '#dc2626' : '#16a34a'
      fill.style.transition = 'width 300ms ease'

      if (uploading > 0) {
        fill.style.animation = 'chas-upload-pulse 1s ease-in-out infinite alternate'
      }

      track.appendChild(fill)
      progress.appendChild(top)
      progress.appendChild(track)

      if (!document.getElementById('chas-upload-progress-style')) {
        const style = document.createElement('style')
        style.id = 'chas-upload-progress-style'
        style.textContent = '@keyframes chas-upload-pulse{from{opacity:.55}to{opacity:1}}'
        document.head.appendChild(style)
      }
    }

    updateProgress()
    const observer = new MutationObserver(updateProgress)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [])

  return null
}
