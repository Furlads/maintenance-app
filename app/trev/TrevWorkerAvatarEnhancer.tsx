'use client'

import { useEffect } from 'react'

type WorkerAvatarConfig = {
  key: string
  namePattern: RegExp
  src: string
  title: string
  border: string
}

type ScheduleWorker = {
  id: number
  name: string
}

const WORKER_AVATARS: WorkerAvatarConfig[] = [
  { key: 'jacob', namePattern: /^jacob(?:\s|$)/i, src: '/avatars/jacob-three-counties.webp', title: 'Jacob · Three Counties Property Care', border: '#84a93f' },
  { key: 'codie', namePattern: /^codie(?:\s|$)/i, src: '/branding/workers/codie-furlads-avatar.jpg', title: 'Codie · Furlads Garden Services', border: '#facc15' },
  { key: 'steve', namePattern: /^(?:steve|stephen)(?:\s|$)/i, src: '/branding/workers/steve-furlads-avatar.webp', title: 'Steve · Furlads Garden Services', border: '#facc15' },
  { key: 'oli', namePattern: /^(?:oli|oliver)(?:\s|$)/i, src: '/branding/workers/oli-furlads-avatar.webp', title: 'Oli · Furlads Garden Services', border: '#facc15' },
  { key: 'kelly', namePattern: /^kelly(?:\s|$)/i, src: '/branding/workers/kelly-both-brands-avatar.webp', title: 'Kelly · Furlads & Three Counties', border: '#b59a45' },
  { key: 'trevor', namePattern: /^(?:trev|trevor)(?:\s|$)/i, src: '/branding/workers/trevor-both-brands-avatar.webp', title: 'Trevor · Furlads & Three Counties', border: '#b59a45' },
]

function todayKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function makeAvatar(worker: WorkerAvatarConfig) {
  const img = document.createElement('img')
  img.src = worker.src
  img.alt = `${worker.title} avatar`
  img.title = `${worker.title} · tap to view today`
  img.width = 52
  img.height = 52
  img.dataset.trevWorkerAvatar = worker.key
  img.style.width = '52px'
  img.style.height = '52px'
  img.style.flex = '0 0 52px'
  img.style.borderRadius = '999px'
  img.style.objectFit = 'cover'
  img.style.display = 'block'
  img.style.border = `2px solid ${worker.border}`
  img.style.background = '#fff'
  return img
}

export default function TrevWorkerAvatarEnhancer() {
  useEffect(() => {
    let cancelled = false
    const workerIds = new Map<string, number>()

    async function loadWorkerIds() {
      try {
        const response = await fetch(`/api/schedule/day?date=${encodeURIComponent(todayKey())}`, {
          cache: 'no-store',
          credentials: 'include',
        })
        const data = await response.json().catch(() => null)
        if (!response.ok || cancelled) return
        for (const worker of (data?.workers || []) as ScheduleWorker[]) {
          workerIds.set(worker.name.trim().toLowerCase(), worker.id)
        }
        enhance()
      } catch {
        // Keep the live board usable even if the schedule lookup fails.
      }
    }

    function enhance() {
      const headings = Array.from(document.querySelectorAll('h2')) as HTMLElement[]
      const boardHeading = headings.find((heading) => heading.textContent?.trim() === 'Team live board')
      const board = boardHeading?.closest('section')
      if (!board) return

      const names = Array.from(board.querySelectorAll('div.text-base.font-bold.text-zinc-950')) as HTMLElement[]

      for (const name of names) {
        const text = name.textContent?.trim() || ''
        const avatarConfig = WORKER_AVATARS.find((item) => item.namePattern.test(text))
        const cardBody = name.closest('div.min-w-0.flex-1') as HTMLElement | null
        const cardRow = cardBody?.parentElement as HTMLElement | null
        if (!cardBody || !cardRow) continue

        if (avatarConfig && !cardRow.querySelector(`[data-trev-worker-avatar="${avatarConfig.key}"]`)) {
          cardRow.insertBefore(makeAvatar(avatarConfig), cardBody)
        }

        const workerId = workerIds.get(text.toLowerCase())
        if (!workerId || cardRow.dataset.workerTodayLinked === '1') continue

        cardRow.dataset.workerTodayLinked = '1'
        cardRow.setAttribute('role', 'link')
        cardRow.setAttribute('tabindex', '0')
        cardRow.setAttribute('aria-label', `View ${text}'s today page read only`)
        cardRow.style.cursor = 'pointer'
        cardRow.style.transition = 'transform 120ms ease, box-shadow 120ms ease'

        const open = () => {
          window.location.href = `/trev/team/${workerId}`
        }
        cardRow.addEventListener('click', open)
        cardRow.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            open()
          }
        })
      }
    }

    void loadWorkerIds()
    enhance()
    const observer = new MutationObserver(enhance)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [])

  return null
}
