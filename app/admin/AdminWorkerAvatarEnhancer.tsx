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

function enhanceAdmin() {
  const root = document.querySelector('.admin-main')
  if (!root) return
  enhanceTeamCards(root)
  enhanceAssignedRows(root)
  enhanceGenericWorkerCards(root)
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
