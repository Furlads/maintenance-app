'use client'

import { useEffect } from 'react'

type WorkerAvatarConfig = {
  key: string
  namePattern: RegExp
  assignedPattern: RegExp
  src: string
  title: string
  border: string
}

const WORKER_AVATARS: WorkerAvatarConfig[] = [
  {
    key: 'jacob',
    namePattern: /^jacob(?:\s|$)/i,
    assignedPattern: /\bJacob\b/i,
    src: '/avatars/jacob-three-counties.webp',
    title: 'Jacob · Three Counties Property Care',
    border: '#d9f99d',
  },
  {
    key: 'codie',
    namePattern: /^codie(?:\s|$)/i,
    assignedPattern: /\bCodie\b/i,
    src: '/branding/workers/codie-furlads-avatar.jpg',
    title: 'Codie · Furlads Garden Services',
    border: '#facc15',
  },
  {
    key: 'steve',
    namePattern: /^(?:steve|stephen)(?:\s|$)/i,
    assignedPattern: /\b(?:Steve|Stephen)\b/i,
    src: '/branding/workers/steve-furlads-avatar.webp',
    title: 'Steve · Furlads Garden Services',
    border: '#facc15',
  },
  {
    key: 'oli',
    namePattern: /^(?:oli|oliver)(?:\s|$)/i,
    assignedPattern: /\b(?:Oli|Oliver)\b/i,
    src: '/branding/workers/oli-furlads-avatar.webp',
    title: 'Oli · Furlads Garden Services',
    border: '#facc15',
  },
  {
    key: 'kelly',
    namePattern: /^kelly(?:\s|$)/i,
    assignedPattern: /\bKelly\b/i,
    src: '/branding/workers/kelly-both-brands-avatar.webp',
    title: 'Kelly · Furlads & Three Counties',
    border: '#b59a45',
  },
  {
    key: 'trevor',
    namePattern: /^(?:trev|trevor)(?:\s|$)/i,
    assignedPattern: /\b(?:Trev|Trevor)\b/i,
    src: '/branding/workers/trevor-both-brands-avatar.webp',
    title: 'Trevor · Furlads & Three Counties',
    border: '#b59a45',
  },
]

function makeAvatar(worker: WorkerAvatarConfig, size: number) {
  const img = document.createElement('img')
  img.src = worker.src
  img.alt = `${worker.title} avatar`
  img.title = worker.title
  img.width = size
  img.height = size
  img.dataset.workerAvatar = worker.key
  img.style.width = `${size}px`
  img.style.height = `${size}px`
  img.style.flex = `0 0 ${size}px`
  img.style.borderRadius = '999px'
  img.style.objectFit = 'cover'
  img.style.display = 'block'
  img.style.border = `2px solid ${worker.border}`
  return img
}

function enhanceTeamCards(root: ParentNode) {
  const names = Array.from(root.querySelectorAll('div.text-sm.font-bold.text-zinc-900')) as HTMLElement[]

  for (const name of names) {
    const text = name.textContent?.trim() || ''
    const worker = WORKER_AVATARS.find((item) => item.namePattern.test(text))
    if (!worker) continue

    const row = name.parentElement?.parentElement
    if (!row || row.querySelector(`[data-worker-avatar="${worker.key}"]`)) continue

    row.style.display = 'flex'
    row.style.alignItems = 'center'
    row.style.gap = '12px'
    row.insertBefore(makeAvatar(worker, 48), row.firstChild)
  }
}

function enhanceAssignedRows(root: ParentNode) {
  const rows = Array.from(root.querySelectorAll('div.sm\\:col-span-2')) as HTMLElement[]

  for (const row of rows) {
    const text = row.textContent || ''
    if (!text.includes('Assigned:')) continue

    const worker = WORKER_AVATARS.find((item) => item.assignedPattern.test(text))
    if (!worker || row.querySelector(`[data-worker-avatar="${worker.key}"]`)) continue

    row.style.display = 'flex'
    row.style.alignItems = 'center'
    row.style.gap = '8px'
    row.insertBefore(makeAvatar(worker, 34), row.firstChild)
  }
}

function enhanceGenericWorkerCards(root: ParentNode) {
  const elements = Array.from(root.querySelectorAll('div')) as HTMLElement[]

  for (const element of elements) {
    if (element.children.length !== 0) continue
    const text = element.textContent?.trim() || ''
    const worker = WORKER_AVATARS.find((item) => item.namePattern.test(text))
    if (!worker) continue

    const card = element.parentElement?.parentElement
    if (!card || card.querySelector(`[data-worker-avatar="${worker.key}"]`)) continue

    const firstChild = card.firstElementChild
    if (!(firstChild instanceof HTMLElement)) continue

    const cardText = card.textContent || ''
    if (!cardText.toLowerCase().includes('worker') && !cardText.toLowerCase().includes('login')) continue

    firstChild.style.display = 'flex'
    firstChild.style.alignItems = 'center'
    firstChild.style.gap = '12px'
    firstChild.insertBefore(makeAvatar(worker, 48), firstChild.firstChild)
  }
}

function fixAdminDashboardHero(root: ParentNode) {
  const hero = Array.from(root.querySelectorAll<HTMLElement>('section')).find((section) =>
    (section.textContent || '').includes('Office control for today')
  )

  if (!hero) return

  hero.style.setProperty('background', 'linear-gradient(145deg, #111111, #1c1c1c)', 'important')
  hero.style.setProperty('border-color', '#27272a', 'important')
  hero.style.setProperty('color', '#ffffff', 'important')

  hero.querySelectorAll<HTMLElement>('h2').forEach((element) => {
    element.style.setProperty('color', '#ffffff', 'important')
  })

  hero.querySelectorAll<HTMLElement>('p').forEach((element) => {
    element.style.setProperty('color', '#d4d4d8', 'important')
  })

  const eyebrow = Array.from(hero.querySelectorAll<HTMLElement>('div')).find(
    (element) => element.textContent?.trim() === 'Daily overview'
  )
  eyebrow?.style.setProperty('color', '#d4d4d8', 'important')

  const inbox = hero.querySelector<HTMLAnchorElement>('a[href="/admin/inbox"]')
  inbox?.style.setProperty('background', '#ffffff', 'important')
  inbox?.style.setProperty('color', '#111827', 'important')
  inbox?.style.setProperty('border-color', '#ffffff', 'important')

  const schedule = hero.querySelector<HTMLAnchorElement>('a[href="/admin/schedule"]')
  schedule?.style.setProperty('background', 'rgba(255,255,255,0.12)', 'important')
  schedule?.style.setProperty('color', '#ffffff', 'important')
  schedule?.style.setProperty('border-color', 'rgba(255,255,255,0.22)', 'important')

  const timeOff = hero.querySelector<HTMLAnchorElement>('a[href="/kelly/time-off"]')
  timeOff?.style.setProperty('background', '#facc15', 'important')
  timeOff?.style.setProperty('color', '#18130a', 'important')
}

function enhanceAdmin() {
  const root = document.querySelector('.admin-main')
  if (root) {
    enhanceTeamCards(root)
    enhanceAssignedRows(root)
    enhanceGenericWorkerCards(root)
    fixAdminDashboardHero(root)
  }
}

export default function AdminWorkerAvatarEnhancer() {
  useEffect(() => {
    enhanceAdmin()
    const observer = new MutationObserver(enhanceAdmin)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return null
}
