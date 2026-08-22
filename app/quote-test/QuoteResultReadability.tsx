'use client'

import { useEffect } from 'react'

export default function QuoteResultReadability() {
  useEffect(() => {
    let frame = 0
    let observer: MutationObserver | null = null

    function makeLine(text: string, className: string) {
      const div = document.createElement('div')
      div.className = className
      div.textContent = text
      return div
    }

    function renderQuoteResult(element: HTMLElement) {
      if (element.className.includes('bg-zinc-950')) return

      const raw = (element.textContent || '').trim()
      if (!raw || !raw.includes('Price:') || !raw.includes('Total:')) return
      if (element.dataset.readableQuoteVersion === '3' && element.childElementCount > 0) return

      const lines = raw
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)

      if (!lines.length) return

      element.dataset.readableQuoteVersion = '3'
      element.dataset.quoteReadable = '1'
      element.replaceChildren()
      element.classList.remove('whitespace-pre-wrap')
      element.classList.add('w-full', 'max-w-[96%]', 'space-y-3', 'rounded-3xl', 'border', 'border-zinc-200', 'bg-white', 'p-3', 'text-zinc-900', 'shadow-sm')

      let currentCard: HTMLDivElement | null = null
      let priceBox: HTMLDivElement | null = null

      function ensureCard() {
        if (currentCard) return currentCard
        currentCard = document.createElement('div')
        currentCard.className = 'rounded-2xl border border-zinc-200 bg-zinc-50 p-3.5'
        element.appendChild(currentCard)
        return currentCard
      }

      function startCard(title: string) {
        currentCard = document.createElement('div')
        currentCard.className = 'rounded-2xl border-2 border-zinc-200 bg-white p-3.5 shadow-sm'
        priceBox = null

        const heading = makeLine(title, 'text-base font-black leading-5 text-zinc-950')
        currentCard.appendChild(heading)
        element.appendChild(currentCard)
      }

      lines.forEach((line, index) => {
        const nextLine = lines[index + 1] || ''
        const isExplicitHeading = /^(Option|Package|Combined|All together)/i.test(line)
        const looksLikeTitleBeforePrice =
          !line.includes(':') &&
          !line.startsWith('•') &&
          /^(Price|VAT|Total):/i.test(nextLine) &&
          line.length < 90

        if (isExplicitHeading || looksLikeTitleBeforePrice) {
          startCard(line)
          return
        }

        if (/^(Price|VAT|Total):/i.test(line)) {
          const card = ensureCard()
          if (!priceBox) {
            priceBox = document.createElement('div')
            priceBox.className = 'mt-3 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-950 text-white'
            card.appendChild(priceBox)
          }

          const [labelPart, ...valueParts] = line.split(':')
          const label = labelPart.trim()
          const value = valueParts.join(':').trim()
          const row = document.createElement('div')
          row.className = `flex items-center justify-between gap-4 px-3 py-2 ${label === 'Total' ? 'bg-yellow-300 text-zinc-950' : 'border-b border-white/10 last:border-0'}`

          row.appendChild(makeLine(label, 'text-xs font-black uppercase tracking-wide'))
          row.appendChild(makeLine(value, label === 'Total' ? 'text-lg font-black' : 'text-sm font-black'))
          priceBox.appendChild(row)
          return
        }

        if (/^Saving compared/i.test(line)) {
          ensureCard().appendChild(makeLine(line, 'mt-3 rounded-xl bg-green-50 px-3 py-2 text-sm font-black leading-5 text-green-800 ring-1 ring-inset ring-green-200'))
          return
        }

        if (/^Likely/i.test(line)) {
          ensureCard().appendChild(makeLine(line, 'mt-3 inline-flex rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-black text-white'))
          return
        }

        if (/^(Why it|Why choose it|Includes):/i.test(line)) {
          ensureCard().appendChild(makeLine(line, 'mt-2 rounded-xl bg-zinc-100 px-3 py-2 text-sm font-semibold leading-5 text-zinc-700'))
          return
        }

        if (/^If those prices/i.test(line)) {
          currentCard = null
          priceBox = null
          element.appendChild(makeLine(line, 'rounded-2xl border border-yellow-300 bg-yellow-50 px-3.5 py-3 text-sm font-black leading-5 text-yellow-900'))
          return
        }

        if (/^(A few things I would keep an eye on|Still worth confirming):/i.test(line)) {
          currentCard = null
          priceBox = null
          const section = document.createElement('div')
          section.className = 'rounded-2xl border border-amber-200 bg-amber-50 p-3.5'
          section.appendChild(makeLine(line, 'text-sm font-black text-amber-900'))
          element.appendChild(section)
          currentCard = section
          return
        }

        if (line.startsWith('•')) {
          ensureCard().appendChild(makeLine(line.replace(/^•\s*/, ''), 'mt-1.5 border-l-4 border-yellow-300 pl-3 text-sm font-medium leading-5 text-zinc-700'))
          return
        }

        const card = ensureCard()
        const isIntro = index === 0 && /^(Right|Here)/i.test(line)
        card.appendChild(makeLine(line, isIntro ? 'text-sm font-black leading-5 text-zinc-800' : 'mt-1.5 text-sm font-medium leading-5 text-zinc-700'))
      })
    }

    function run() {
      frame = 0
      observer?.disconnect()
      try {
        document.querySelectorAll<HTMLElement>('div.whitespace-pre-wrap, div[data-quote-readable="1"]').forEach(renderQuoteResult)
      } finally {
        observer?.observe(document.body, { childList: true, subtree: true, characterData: true })
      }
    }

    function schedule() {
      if (frame) return
      frame = window.requestAnimationFrame(run)
    }

    observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    schedule()

    return () => {
      observer?.disconnect()
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  return null
}
