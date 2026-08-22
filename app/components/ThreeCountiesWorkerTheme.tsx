'use client'

import { useEffect } from 'react'

type AuthMeResponse = {
  authenticated?: boolean
  name?: string | null
}

const DARK_BACKGROUNDS = new Set([
  'rgb(17, 17, 17)',
  'rgb(24, 24, 27)',
  'rgb(17, 24, 39)',
  'rgb(30, 30, 30)',
  'rgb(15, 23, 42)',
])

const ACCENT_BACKGROUNDS = new Set([
  'rgb(250, 204, 21)',
  'rgb(255, 204, 0)',
  'rgb(255, 216, 0)',
  'rgb(253, 224, 71)',
])

const SOFT_YELLOW_BACKGROUNDS = new Set([
  'rgb(255, 253, 243)',
  'rgb(255, 253, 245)',
  'rgb(255, 251, 235)',
  'rgb(254, 249, 195)',
  'rgb(255, 249, 217)',
])

const YELLOW_TEXT = new Set([
  'rgb(250, 204, 21)',
  'rgb(255, 204, 0)',
  'rgb(255, 216, 0)',
  'rgb(253, 224, 71)',
])

function isJacob(name: string | null | undefined) {
  return /^jacob(?:\s|$)/i.test(String(name || '').trim())
}

export default function ThreeCountiesWorkerTheme() {
  useEffect(() => {
    let observer: MutationObserver | null = null
    let raf = 0

    function clearTheme() {
      document.body.removeAttribute('data-worker-brand')
      document.querySelectorAll('[data-tc-dark-surface]').forEach((element) => element.removeAttribute('data-tc-dark-surface'))
      document.querySelectorAll('[data-tc-accent-surface]').forEach((element) => element.removeAttribute('data-tc-accent-surface'))
      document.querySelectorAll('[data-tc-soft-surface]').forEach((element) => element.removeAttribute('data-tc-soft-surface'))
      document.querySelectorAll('[data-tc-accent-text]').forEach((element) => element.removeAttribute('data-tc-accent-text'))
    }

    function polishThreeCounties() {
      if (document.body.dataset.workerBrand !== 'three-counties') return

      const elements = document.querySelectorAll<HTMLElement>('main, main section, main header, main div, main article, main button, main a, nav, nav button, nav a')

      elements.forEach((element) => {
        const style = window.getComputedStyle(element)
        const backgroundColor = style.backgroundColor
        const backgroundImage = style.backgroundImage
        const color = style.color

        if (
          DARK_BACKGROUNDS.has(backgroundColor) ||
          /rgb\(17, 17, 17\)|rgb\(17, 24, 39\)|rgb\(30, 30, 30\)/.test(backgroundImage)
        ) {
          element.dataset.tcDarkSurface = 'true'
        }

        if (ACCENT_BACKGROUNDS.has(backgroundColor)) {
          element.dataset.tcAccentSurface = 'true'
        }

        if (SOFT_YELLOW_BACKGROUNDS.has(backgroundColor)) {
          element.dataset.tcSoftSurface = 'true'
        }

        if (YELLOW_TEXT.has(color)) {
          element.dataset.tcAccentText = 'true'
        }
      })
    }

    function schedulePolish() {
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(polishThreeCounties)
    }

    async function applyTheme() {
      let workerName = ''

      try {
        workerName = localStorage.getItem('workerName') || ''
      } catch {
        workerName = ''
      }

      try {
        const res = await fetch('/api/auth/me', {
          cache: 'no-store',
          credentials: 'include',
        })
        const data: AuthMeResponse | null = await res.json().catch(() => null)
        if (res.ok && data?.authenticated && data?.name) workerName = data.name
      } catch {
        // Local storage fallback keeps the worker theme available offline.
      }

      if (!isJacob(workerName)) {
        clearTheme()
        return
      }

      document.body.dataset.workerBrand = 'three-counties'
      document.documentElement.style.setProperty('--worker-brand-accent', '#93b83d')
      document.documentElement.style.setProperty('--worker-brand-dark', '#142611')
      document.documentElement.style.setProperty('--worker-brand-page', '#eef2e8')

      polishThreeCounties()
      observer = new MutationObserver(schedulePolish)
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] })
    }

    void applyTheme()

    return () => {
      if (raf) cancelAnimationFrame(raf)
      observer?.disconnect()
    }
  }, [])

  return (
    <style>{`
      body[data-worker-brand='three-counties'] {
        background:#eef2e8 !important;
      }

      body[data-worker-brand='three-counties'] main {
        background:#eef2e8 !important;
      }

      body[data-worker-brand='three-counties'] [data-tc-dark-surface='true'] {
        background:#142611 !important;
        background-image:linear-gradient(145deg,#142611,#29401c) !important;
        border-color:#355528 !important;
      }

      body[data-worker-brand='three-counties'] [data-tc-accent-surface='true'] {
        background:#93b83d !important;
        border-color:#7f9f35 !important;
        color:#14200d !important;
      }

      body[data-worker-brand='three-counties'] [data-tc-soft-surface='true'] {
        background:#f1f6e8 !important;
        border-color:#d7e4bf !important;
      }

      body[data-worker-brand='three-counties'] [data-tc-accent-text='true'] {
        color:#b7d66f !important;
      }

      body[data-worker-brand='three-counties'] a:focus-visible,
      body[data-worker-brand='three-counties'] button:focus-visible,
      body[data-worker-brand='three-counties'] input:focus-visible,
      body[data-worker-brand='three-counties'] textarea:focus-visible,
      body[data-worker-brand='three-counties'] select:focus-visible {
        outline:3px solid rgba(147,184,61,.45) !important;
        outline-offset:2px;
      }

      body[data-worker-brand='three-counties'] input[type='checkbox'],
      body[data-worker-brand='three-counties'] input[type='radio'] {
        accent-color:#7fa232;
      }

      body[data-worker-brand='three-counties'] .today-v2-three-counties {
        --accent:#93b83d;
        --accentText:#14200d;
        --hero:#142611;
        --hero2:#29401c;
        --soft:#eef5e2;
        --page:#eef2e8;
      }
    `}</style>
  )
}
