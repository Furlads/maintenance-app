'use client'

import type { ReactNode } from 'react'
import { useEffect } from 'react'

type Props = {
  children: ReactNode
}

function normalisePhone(value: string | null | undefined) {
  return String(value || '').replace(/\s+/g, '').trim()
}

function getRedirectPath() {
  const workerName = String(localStorage.getItem('lastWorkerName') || localStorage.getItem('workerName') || '')
    .trim()
    .toLowerCase()
  const accessLevel = String(localStorage.getItem('lastWorkerAccessLevel') || '')
    .trim()
    .toLowerCase()

  if (workerName === 'trevor fudger' || workerName === 'trev fudger') return '/trev'
  if (['admin', 'office', 'manager', 'owner'].includes(accessLevel)) return '/admin'
  return '/worker/home'
}

export default function LoginLayout({ children }: Props) {
  useEffect(() => {
    function skipRepeatPrompt() {
      if (localStorage.getItem('quickLoginEnabled') !== 'true') return

      const savedPhone = normalisePhone(localStorage.getItem('quickLoginPhone'))
      const phoneInput = document.querySelector<HTMLInputElement>('input[type="tel"]')
      const currentPhone = normalisePhone(phoneInput?.value)

      if (!savedPhone || !currentPhone || savedPhone !== currentPhone) return

      const promptHeading = Array.from(document.querySelectorAll('h2')).find((heading) =>
        String(heading.textContent || '').includes('Use Face ID / fingerprint on this phone next time?')
      )

      if (!promptHeading) return

      const overlay = promptHeading.closest('div[style*="position: fixed"]') as HTMLElement | null
      if (overlay) overlay.style.display = 'none'

      window.location.replace(getRedirectPath())
    }

    skipRepeatPrompt()

    const observer = new MutationObserver(skipRepeatPrompt)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [])

  return children
}
