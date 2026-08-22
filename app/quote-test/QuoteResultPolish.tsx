'use client'

import { useEffect } from 'react'

export default function QuoteResultPolish() {
  useEffect(() => {
    let frame = 0

    function explodeLine(input: string): string[] {
      const line = input.trim()
      if (!line) return []

      // CHAS occasionally puts the combined offer on the end of the final
      // option description. Force it back out into its own section.
      const combinedMatch = line.match(/\bIf all completed together\b/i)
      if (combinedMatch && combinedMatch.index && combinedMatch.index > 0) {
        return [
          ...explodeLine(line.slice(0, combinedMatch.index)),
          ...explodeLine(line.slice(combinedMatch.index)),
        ]
      }

      // Likewise, if CHAS runs the next option on after a "Why choose it"
      // sentence, keep only that first why-choose sentence with the current
      // option and feed the remainder back through the section parser.
      const whyIndex = line.search(/\bWhy choose it:\s*/i)
      if (whyIndex > 0) {
        const before = line.slice(0, whyIndex).trim()
        const whyAndAfter = line.slice(whyIndex).trim()
        const sentenceMatch = whyAndAfter.match(/^Why choose it:\s*.*?[.!?](?=\s|$)/i)

        if (sentenceMatch) {
          const whySentence = sentenceMatch[0].trim()
          const remainder = whyAndAfter.slice(sentenceMatch[0].length).trim()
          return [
            ...explodeLine(before),
            whySentence,
            ...(remainder ? explodeLine(remainder) : []),
          ]
        }
      }

      return [line]
    }

    function enhance() {
      frame = 0

      document.querySelectorAll<HTMLElement>('div.whitespace-pre-wrap').forEach((bubble) => {
        if (bubble.className.includes('bg-zinc-950')) return
        if (bubble.dataset.chasResultPolished === 'v4') return

        const text = (bubble.textContent || '').trim()
        if (!text || (!text.includes('Price:') && !text.includes('Total:'))) return

        const lines = text
          .split(/\n+/)
          .flatMap((line) => explodeLine(line))
          .map((line) => line.trim())
          .filter(Boolean)

        if (lines.length < 3) return

        bubble.dataset.chasResultPolished = 'v4'
        bubble.classList.remove('whitespace-pre-wrap')
        bubble.style.maxWidth = '100%'
        bubble.style.width = '100%'
        bubble.style.padding = '12px'
        bubble.replaceChildren()

        const intro: string[] = []
        const groups: string[][] = []
        let current: string[] = []

        const startsGroup = (line: string) =>
          /^Option\s+/i.test(line) ||
          /^Package\s+/i.test(line) ||
          /^Combined/i.test(line) ||
          /^All together/i.test(line) ||
          /^If all completed together/i.test(line) ||
          (/^[A-Z][^\n]{1,180}\s—\s/.test(line) && !line.includes('£'))

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
          introBox.className = 'mb-3 rounded-2xl bg-zinc-100 px-4 py-3 text-sm font-semibold leading-5 text-zinc-800'
          introBox.textContent = intro.join(' ')
          bubble.appendChild(introBox)
        }

        const renderGroup = (group: string[]) => {
          const card = document.createElement('section')
          const isCombined = /^If all completed together|^Combined|^All together/i.test(group[0])
          card.className = isCombined
            ? 'mb-4 rounded-2xl border-2 border-yellow-300 bg-yellow-50 p-4 shadow-sm last:mb-0'
            : 'mb-4 rounded-2xl border-2 border-zinc-200 bg-white p-4 shadow-sm last:mb-0'

          const heading = document.createElement('div')
          heading.className = isCombined
            ? 'text-lg font-black leading-tight text-zinc-950'
            : 'text-base font-black leading-5 text-zinc-950'
          heading.textContent = group[0]
          card.appendChild(heading)

          const bodyLines: string[] = []
          const bulletLines: string[] = []
          const priceLines: string[] = []
          const detailLines: string[] = []

          for (const line of group.slice(1)) {
            if (/^(Price|VAT|Total):/i.test(line)) priceLines.push(line)
            else if (/^•/.test(line)) bulletLines.push(line.replace(/^•\s*/, ''))
            else if (/^(Likely|Saving|Why it|Why choose it|Includes):?/i.test(line)) detailLines.push(line)
            else if (/^If those prices/i.test(line)) detailLines.push(line)
            else bodyLines.push(line)
          }

          if (bodyLines.length) {
            const body = document.createElement('div')
            body.className = 'mt-3 space-y-2 text-sm font-medium leading-6 text-zinc-700'
            bodyLines.forEach((line) => {
              const row = document.createElement('p')
              row.textContent = line
              body.appendChild(row)
            })
            card.appendChild(body)
          }

          if (bulletLines.length) {
            const list = document.createElement('ul')
            list.className = 'mt-3 space-y-2 text-sm text-zinc-700'
            bulletLines.forEach((item) => {
              const li = document.createElement('li')
              li.className = 'flex gap-2 border-l-4 border-yellow-300 pl-3 leading-5'
              li.textContent = item
              list.appendChild(li)
            })
            card.appendChild(list)
          }

          if (priceLines.length) {
            const priceBox = document.createElement('div')
            priceBox.className = 'mt-4 overflow-hidden rounded-2xl bg-zinc-950 text-white shadow-sm'

            priceLines.forEach((line) => {
              const index = line.indexOf(':')
              const labelText = index >= 0 ? line.slice(0, index) : ''
              const valueText = index >= 0 ? line.slice(index + 1).trim() : line
              const row = document.createElement('div')
              const isTotal = labelText.toLowerCase() === 'total'
              row.className = isTotal
                ? 'flex items-center justify-between gap-4 bg-yellow-300 px-3 py-3 text-zinc-950'
                : 'flex items-center justify-between gap-4 border-b border-white/10 px-3 py-2.5 last:border-b-0'

              const label = document.createElement('span')
              label.className = 'text-xs font-black uppercase tracking-wide'
              label.textContent = labelText

              const value = document.createElement('span')
              value.className = isTotal ? 'text-xl font-black' : 'text-sm font-black'
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
              const isSaving = /^Saving/i.test(line)
              item.className = isSaving
                ? 'rounded-xl bg-green-50 px-3 py-2 text-sm font-black leading-5 text-green-800 ring-1 ring-inset ring-green-200'
                : 'rounded-xl bg-zinc-100 px-3 py-2 text-sm font-semibold leading-5 text-zinc-700'
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
    observer.observe(document.body, { childList: true, subtree: true })
    schedule()

    return () => {
      observer.disconnect()
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  return null
}
