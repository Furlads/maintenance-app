'use client'

import { useEffect } from 'react'

type WorkerAvatarConfig = {
  key: string
  namePattern: RegExp
  src: string
  title: string
  border: string
}

const WORKER_AVATARS: WorkerAvatarConfig[] = [
  {
    key: 'jacob',
    namePattern: /^jacob(?:\s|$)/i,
    src: '/avatars/jacob-three-counties.webp',
    title: 'Jacob · Three Counties Property Care',
    border: '#84a93f',
  },
  {
    key: 'codie',
    namePattern: /^codie(?:\s|$)/i,
    src: '/branding/workers/codie-furlads-avatar.jpg',
    title: 'Codie · Furlads Garden Services',
    border: '#facc15',
  },
  {
    key: 'steve',
    namePattern: /^(?:steve|stephen)(?:\s|$)/i,
    src: '/branding/workers/steve-furlads-avatar.webp',
    title: 'Steve · Furlads Garden Services',
    border: '#facc15',
  },
  {
    key: 'oli',
    namePattern: /^(?:oli|oliver)(?:\s|$)/i,
    src: '/branding/workers/oli-furlads-avatar.webp',
    title: 'Oli · Furlads Garden Services',
    border: '#facc15',
  },
  {
    key: 'kelly',
    namePattern: /^kelly(?:\s|$)/i,
    src: '/branding/workers/kelly-both-brands-avatar.webp',
    title: 'Kelly · Furlads & Three Counties',
    border: '#b59a45',
  },
  {
    key: 'trevor',
    namePattern: /^(?:trev|trevor)(?:\s|$)/i,
    src: '/branding/workers/trevor-both-brands-avatar.webp',
    title: 'Trevor · Furlads & Three Counties',
    border: '#b59a45',
  },
]

function makeAvatar(worker: WorkerAvatarConfig) {
  const img = document.createElement('img')
  img.src = worker.src
  img.alt = `${worker.title} avatar`
  img.title = worker.title
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

function enhanceTrevLiveBoard() {
  const headings = Array.from(document.querySelectorAll('h2')) as HTMLElement[]
  const boardHeading = headings.find((heading) => heading.textContent?.trim() === 'Team live board')
  const board = boardHeading?.closest('section')
  if (!board) return

  const names = Array.from(board.querySelectorAll('div.text-base.font-bold.text-zinc-950')) as HTMLElement[]

  for (const name of names) {
    const text = name.textContent?.trim() || ''
    const worker = WORKER_AVATARS.find((item) => item.namePattern.test(text))
    if (!worker) continue

    const cardBody = name.closest('div.min-w-0.flex-1')
    const cardRow = cardBody?.parentElement
    if (!cardBody || !cardRow) continue
    if (cardRow.querySelector(`[data-trev-worker-avatar="${worker.key}"]`)) continue

    cardRow.insertBefore(makeAvatar(worker), cardBody)
  }
}

export default function TrevWorkerAvatarEnhancer() {
  useEffect(() => {
    enhanceTrevLiveBoard()

    const observer = new MutationObserver(enhanceTrevLiveBoard)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [])

  return null
}
