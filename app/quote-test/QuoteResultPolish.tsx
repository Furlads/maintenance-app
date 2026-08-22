'use client'

import { useEffect } from 'react'

export default function QuoteResultPolish() {
  useEffect(() => {
    let frame = 0

    function enhance() {
      frame = 0

      document.querySelectorAll<HTMLElement>('div.whitespace-pre-wrap').forEach((bubble) => {
        if (bubble.className.includes('bg-zinc-950')) return
        if (bubble.dataset.chasResultPolished === 'true') return

        const text = (bubble.textContent || '').trim()
        if (!text || (!text.includes('Price:') && !text.includes('Total:'))) return

        const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean)
        if (lines.length < 3) return

        bubble.dataset.chasResultPolished = 'true'
        bubble.classList.remove('whitespace-pre-wrap')
        bubble.style.maxWidth = '100%'
        bubble.style.width = '100%'
        bubble.style.padding = '14px'
        bubble.replaceChildren()

        const intro: string[] = []
        const groups: string[][] = []
        let current: string[] = []

        const startsGroup = (line: string) =>
          /^Option\s+/i.test(line) ||
          /^Package\s+/i.test(line) ||
          /^Combined/i.test(line) ||
          /^All together/i.test(line) ||
          (/^[A-Z][^:]{1,60}\s—\s/.test(line) && !line.includes('£'))

        for (const line of lines) {
          if (startsGroup(line)) {
            if (current.length) groups.push(current)
            current = [line]
          } else if (current.length) {
            current.push(line)
          } else {
            intro.push(line)
          }
        }
        if (current.length) groups.push(current)

        if (intro.length) {
          const introBox = document.createElement('div')
          introBox.className = 'mb-3 rounded-2xl bg-zinc-100 px-4 py-3 text-sm leading-5 text-zinc-700'
          introBox.textContent = intro.join(' ')
          bubble.appendChild(introBox)
        }

        const renderGroup = (group: string[]) => {
          const card = document.createElement('section')
          card.className = 'mb-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm last:mb-0'

          const heading = document.createElement('div')
          heading.className = 'text-lg font-black leading-tight text-zinc-950'
          heading.textContent = group[0]
          card.appendChild(heading)

          const bodyLines: string[] = []
          const bulletLines: string[] = []
          const priceLines: string[] = []
          const detailLines: string[] = []

          for (const line of group.slice(1)) {
            if (/^(Price|VAT|Total):/i.test(line)) priceLines.push(line)
            else if (/^•/.test(line)) bulletLines.push(line.replace(/^•\s*/, ''))
            else if (/^(Likely|Saving|Why it|Includes):?/i.test(line)) detailLines.push(line)
            else bodyLines.push(line)
          }

          if (bodyLines.length) {
            const body = document.createElement('div')
            body.className = 'mt-2 text-sm leading-5 text-zinc-700'
            body.textContent = bodyLines.join(' ')
            card.appendChild(body)
          }

          if (bulletLines.length) {
            const list = document.createElement('ul')
            list.className = 'mt-3 space-y-1.5 text-sm text-zinc-700'
            bulletLines.forEach((item) => {
              const li = document.createElement('li')
              li.className = 'flex gap-2'
              li.innerHTML = '<span class="font-black text-zinc-400">•</span><span></span>'
              const span = li.lastElementChild as HTMLElement
              span.textContent = item
              list.appendChild(li)
            })
            card.appendChild(list)
          }

          if (priceLines.length) {
            const priceBox = document.createElement('div')
            priceBox.className = 'mt-3 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50'

            priceLines.forEach((line) => {
              const index = line.indexOf(':')
              const labelText = index >= 0 ? line.slice(0, index) : ''
              const valueText = index >= 0 ? line.slice(index + 1).trim() : line
              const row = document.createElement('div')
              row.className = 'flex items-center justify-between gap-4 border-b border-zinc-200 px-3 py-2.5 last:border-b-0'

              const label = document.createElement('span')
              label.className = 'text-xs font-black uppercase tracking-wide text-zinc-500'
              label.textContent = labelText

              const value = document.createElement('span')
              value.className = labelText.toLowerCase() === 'total'
                ? 'text-lg font-black text-zinc-950'
                : 'text-sm font-black text-zinc-900'
              value.textContent = valueText

              row.append(label, value)
              priceBox.appendChild(row)
            })

            card.appendChild(priceBox)
          }

          if (detailLines.length) {
            const details = document.createElement('div')
            details.className = 'mt-3 space-y-2'
            detailLines.forEach((line) => {
              const item = document.createElement('div')
              item.className = 'rounded-xl bg-yellow-50 px-3 py-2 text-sm font-semibold leading-5 text-yellow-900'
              item.textContent = line
              details.appendChild(item)
            })
            card.appendChild(details)
          }

          bubble.appendChild(card)
        }

        groups.forEach(renderGroup)

        if (!groups.length) {
          const fallback = document.createElement('div')
          fallback.className = 'space-y-2 text-sm leading-5 text-zinc-800'
          lines.forEach((line) => {
            const row = document.createElement('div')
            row.textContent = line
            fallback.appendChild(row)
          })
          bubble.appendChild(fallback)
        }
      })
    }

    const schedule = () => {
      if (frame) return
      frame = window.requestAnimationFrame(enhance)
    }

    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    schedule()

    return () => {
      observer.disconnect()
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  return null
}
