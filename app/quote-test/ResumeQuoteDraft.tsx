'use client'

import { useEffect } from 'react'

type QuoteResponse = {
  ok?: boolean
  quote?: {
    id: number
    status: string
    customerId?: number | null
    conversationId?: string | null
    customerName?: string | null
    customerPhone?: string | null
    customerEmail?: string | null
    customerAddress?: string | null
    customerPostcode?: string | null
    scope?: string | null
    quoteWorking?: string | null
  }
  error?: string
}

function setControlledValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = element instanceof HTMLTextAreaElement
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set

  if (setter) setter.call(element, value)
  else element.value = value

  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

async function waitForElement<T extends Element>(selector: string, timeout = 10000) {
  const started = Date.now()

  while (Date.now() - started < timeout) {
    const element = document.querySelector<T>(selector)
    if (element) return element
    await new Promise((resolve) => window.setTimeout(resolve, 100))
  }

  return null
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export default function ResumeQuoteDraft() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const quoteId = Number(params.get('resume'))
    if (!Number.isInteger(quoteId) || quoteId <= 0) return

    let cancelled = false

    async function resumeQuote() {
      try {
        const response = await fetch(`/api/quotes/${quoteId}`, { cache: 'no-store' })
        const data = (await response.json().catch(() => null)) as QuoteResponse | null
        const quote = data?.quote

        if (!response.ok || !data?.ok || !quote || quote.status !== 'in_progress' || cancelled) {
          return
        }

        const customerName = clean(quote.customerName)
        const customerPostcode = clean(quote.customerPostcode)

        if (quote.conversationId) {
          localStorage.setItem('chasDraftConversationId', quote.conversationId)
          localStorage.setItem(
            'chasDraftCustomerSignature',
            `${customerName}|${customerPostcode}`
          )
        }
        localStorage.setItem('chasActiveDraftId', String(quote.id))

        const nameInput = await waitForElement<HTMLInputElement>('input[placeholder="Customer name"]')
        if (!nameInput || cancelled) return

        const phoneInput = document.querySelector<HTMLInputElement>('input[placeholder="07…"]')
        const postcodeInput = document.querySelector<HTMLInputElement>('input[placeholder="TF9 4BQ"]')
        const addressInput = document.querySelector<HTMLInputElement>('input[placeholder="Optional address"]')
        const emailInput = document.querySelector<HTMLInputElement>('input[placeholder="Optional email"]')
        const searchInput = document.querySelector<HTMLInputElement>('input[placeholder="Name, phone or postcode"]')

        setControlledValue(nameInput, customerName)
        if (phoneInput) setControlledValue(phoneInput, clean(quote.customerPhone))
        if (postcodeInput) setControlledValue(postcodeInput, customerPostcode)
        if (addressInput) setControlledValue(addressInput, clean(quote.customerAddress))
        if (emailInput) setControlledValue(emailInput, clean(quote.customerEmail))
        if (searchInput) setControlledValue(searchInput, customerName)

        await new Promise((resolve) => window.setTimeout(resolve, 250))
        if (cancelled) return

        const startButton = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
          (button) => (button.textContent || '').includes('start quote with CHAS')
        )
        if (!startButton) return
        startButton.click()

        const composer = await waitForElement<HTMLTextAreaElement>(
          'textarea[placeholder="Tell Chas about the job…"]',
          12000
        )
        if (!composer || cancelled) return

        let working: Record<string, unknown> = {}
        try {
          working = quote.quoteWorking ? JSON.parse(quote.quoteWorking) : {}
        } catch {
          working = {}
        }

        const resumeText =
          clean(working.typedText) ||
          clean(quote.scope) ||
          clean(working.transcript)

        if (resumeText) {
          setControlledValue(composer, resumeText)
        }
        composer.focus()
      } catch (error) {
        console.warn('Could not resume CHAS quote draft:', error)
      }
    }

    void resumeQuote()

    return () => {
      cancelled = true
    }
  }, [])

  return null
}
