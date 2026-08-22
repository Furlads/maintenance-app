'use client'

import { useEffect } from 'react'

function makeConversationId() {
  return `chas-draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export default function QuoteDraftAutosave() {
  useEffect(() => {
    let timer: number | null = null
    let saving = false
    let lastSaved = ''

    function getCustomer() {
      const header = document.querySelector('header')
      if (!header) return null

      const button = Array.from(header.querySelectorAll('button')).find((item) =>
        (item.textContent || '').includes(' · ')
      )
      if (!button) return null

      const parts = (button.textContent || '').trim().split(' · ')
      const name = (parts[0] || '').trim()
      const postcode = parts.slice(1).join(' · ').trim()
      if (!name) return null

      return { name, postcode }
    }

    function getConversationId(customerName: string, customerPostcode: string) {
      const signature = `${customerName}|${customerPostcode}`
      const storedSignature = localStorage.getItem('chasDraftCustomerSignature') || ''
      let id = localStorage.getItem('chasDraftConversationId') || ''

      if (!id || storedSignature !== signature) {
        id = makeConversationId()
        localStorage.setItem('chasDraftConversationId', id)
        localStorage.setItem('chasDraftCustomerSignature', signature)
      }

      return id
    }

    function getWorkingState() {
      const customer = getCustomer()
      if (!customer) return null

      const textarea = document.querySelector<HTMLTextAreaElement>('textarea[placeholder="Tell Chas about the job…"]')
      const typedText = textarea?.value?.trim() || ''

      const messageArea = document.querySelector('main > section')
      const messageText = messageArea
        ? Array.from(messageArea.querySelectorAll<HTMLElement>('div'))
            .filter((element) => {
              const text = (element.textContent || '').trim()
              if (!text) return false
              if (element.children.length > 0) return false
              if (['Ready', 'Uploading', 'Failed'].includes(text)) return false
              return text.length > 10
            })
            .map((element) => (element.textContent || '').trim())
            .filter(Boolean)
            .join('\n\n')
        : ''

      const readyPhotos = Array.from(document.querySelectorAll<HTMLImageElement>('footer img[alt]'))
        .map((image) => image.getAttribute('alt') || '')
        .filter(Boolean)

      const working = {
        version: 2,
        customer,
        typedText,
        transcript: messageText,
        photoNames: readyPhotos,
        savedAt: new Date().toISOString(),
      }

      const scope = typedText || messageText || `Quote in progress for ${customer.name}`
      const conversationId = getConversationId(customer.name, customer.postcode)

      return {
        conversationId,
        customerName: customer.name,
        customerPostcode: customer.postcode,
        scope: scope.slice(0, 6000),
        quoteWorking: JSON.stringify(working),
      }
    }

    async function saveNow(useKeepalive = false) {
      if (saving && !useKeepalive) return
      const state = getWorkingState()
      if (!state) return

      const serialised = JSON.stringify(state)
      if (!useKeepalive && serialised === lastSaved) return

      saving = true
      try {
        const response = await fetch('/api/quotes/autosave', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: serialised,
          keepalive: useKeepalive,
        })

        if (response.ok) {
          lastSaved = serialised
          const data = await response.json().catch(() => null)
          if (data?.quote?.id) {
            localStorage.setItem('chasActiveDraftId', String(data.quote.id))
          }
        }
      } catch (error) {
        console.warn('CHAS draft autosave failed:', error)
      } finally {
        saving = false
      }
    }

    function queueSave() {
      if (timer) window.clearTimeout(timer)
      timer = window.setTimeout(() => void saveNow(false), 700)
    }

    function saveOnExit() {
      const state = getWorkingState()
      if (!state) return
      const body = JSON.stringify(state)

      try {
        if (navigator.sendBeacon) {
          const blob = new Blob([body], { type: 'application/json' })
          navigator.sendBeacon('/api/quotes/autosave', blob)
          return
        }
      } catch {}

      void fetch('/api/quotes/autosave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      })
    }

    const observer = new MutationObserver(queueSave)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })

    document.addEventListener('input', queueSave, true)
    document.addEventListener('change', queueSave, true)
    window.addEventListener('pagehide', saveOnExit)
    window.addEventListener('beforeunload', saveOnExit)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') saveOnExit()
      else queueSave()
    })

    const interval = window.setInterval(() => void saveNow(false), 5000)
    queueSave()

    return () => {
      observer.disconnect()
      if (timer) window.clearTimeout(timer)
      window.clearInterval(interval)
      document.removeEventListener('input', queueSave, true)
      document.removeEventListener('change', queueSave, true)
      window.removeEventListener('pagehide', saveOnExit)
      window.removeEventListener('beforeunload', saveOnExit)
      saveOnExit()
    }
  }, [])

  return null
}
