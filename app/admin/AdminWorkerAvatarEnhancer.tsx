'use client'

import { useEffect } from 'react'

const JACOB_AVATAR = '/avatars/jacob-three-counties.webp'

function makeAvatar(size: number) {
  const img = document.createElement('img')
  img.src = JACOB_AVATAR
  img.alt = 'Jacob avatar'
  img.title = 'Jacob · Three Counties Property Care'
  img.width = size
  img.height = size
  img.dataset.workerAvatar = 'jacob'
  img.style.width = `${size}px`
  img.style.height = `${size}px`
  img.style.flex = `0 0 ${size}px`
  img.style.borderRadius = '999px'
  img.style.objectFit = 'cover'
  img.style.display = 'block'
  img.style.border = '2px solid #d9f99d'
  return img
}

function enhanceTeamCards(root: ParentNode) {
  const names = Array.from(root.querySelectorAll('div.text-sm.font-bold.text-zinc-900')) as HTMLElement[]

  for (const name of names) {
    if (!/^jacob(?:\s|$)/i.test(name.textContent?.trim() || '')) continue
    const row = name.parentElement?.parentElement
    if (!row || row.querySelector('[data-worker-avatar="jacob"]')) continue

    row.style.display = 'flex'
    row.style.alignItems = 'center'
    row.style.gap = '12px'
    row.insertBefore(makeAvatar(48), row.firstChild)
  }
}

function enhanceAssignedRows(root: ParentNode) {
  const rows = Array.from(root.querySelectorAll('div.sm\\:col-span-2')) as HTMLElement[]

  for (const row of rows) {
    const text = row.textContent || ''
    if (!text.includes('Assigned:') || !/\bJacob\b/i.test(text)) continue
    if (row.querySelector('[data-worker-avatar="jacob"]')) continue

    row.style.display = 'flex'
    row.style.alignItems = 'center'
    row.style.gap = '8px'
    row.insertBefore(makeAvatar(34), row.firstChild)
  }
}

function enhanceAdmin() {
  const root = document.querySelector('.admin-main')
  if (!root) return
  enhanceTeamCards(root)
  enhanceAssignedRows(root)
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
