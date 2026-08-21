'use client'

import { useEffect } from 'react'

type Props = {
  maintenanceJobIds: number[]
}

const LEGACY_ACTIONS = new Set([
  'Start Job',
  'Pause',
  'Resume',
  'Finish Job',
  'Couldn’t Complete',
  "Couldn't Complete",
  'Add 30 mins',
  'Add Other Time',
  'Undo Start',
  'Undo Done',
])

function cleanText(value: string | null | undefined) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function findJobContainer(link: HTMLAnchorElement) {
  let node: HTMLElement | null = link.parentElement

  while (node && node !== document.body) {
    const hasActions =
      Boolean(node.querySelector('.today-quick-actions')) ||
      Boolean(node.querySelector('.today-active-actions')) ||
      Boolean(node.querySelector('.today-job-actions'))

    if (hasActions) return node
    node = node.parentElement
  }

  return null
}

function ensureOpenJobButton(container: HTMLElement, jobId: string, maintenance: boolean) {
  if (container.querySelector(`[data-worker-open-job="${jobId}"]`)) return

  const host =
    container.querySelector<HTMLElement>('.today-quick-actions') ||
    container.querySelector<HTMLElement>('.today-active-actions') ||
    container.querySelector<HTMLElement>('.today-job-actions')

  if (!host) return

  host.style.display = 'grid'
  host.style.gridTemplateColumns = '1fr'

  const link = document.createElement('a')
  link.href = maintenance ? `/maintenance/jobs/${jobId}` : `/jobs/${jobId}`
  link.dataset.workerOpenJob = jobId
  link.textContent = 'Open Job'
  link.style.display = 'inline-flex'
  link.style.alignItems = 'center'
  link.style.justifyContent = 'center'
  link.style.minHeight = '48px'
  link.style.padding = '12px 16px'
  link.style.borderRadius = '12px'
  link.style.border = '1px solid #111827'
  link.style.background = '#111827'
  link.style.color = '#fff'
  link.style.textDecoration = 'none'
  link.style.fontWeight = '800'
  link.style.fontSize = '15px'
  link.style.width = '100%'

  host.prepend(link)
}

export default function MaintenanceTodayBridge({ maintenanceJobIds }: Props) {
  useEffect(() => {
    const maintenanceIds = new Set(maintenanceJobIds.map(String))

    function simplifyWorkerCards() {
      const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="/jobs/"]'))

      for (const link of links) {
        const match = link.getAttribute('href')?.match(/^\/jobs\/(\d+)/)
        if (!match) continue

        const container = findJobContainer(link)
        if (!container) continue

        const jobId = match[1]
        const maintenance = maintenanceIds.has(jobId)
        container.dataset.simpleWorkerJobCard = jobId

        const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
        for (const button of buttons) {
          if (LEGACY_ACTIONS.has(cleanText(button.textContent))) {
            button.style.display = 'none'
          }
        }

        const actionGroups = Array.from(
          container.querySelectorAll<HTMLElement>('.today-quick-actions, .today-active-actions, .today-job-actions')
        )

        for (const group of actionGroups) {
          const usefulControls = Array.from(group.querySelectorAll<HTMLElement>('a,button')).filter((control) => {
            const text = cleanText(control.textContent)
            return text && !LEGACY_ACTIONS.has(text) && !control.dataset.workerOpenJob
          })

          if (!usefulControls.length) group.style.display = 'none'
        }

        ensureOpenJobButton(container, jobId, maintenance)
      }
    }

    simplifyWorkerCards()

    const observer = new MutationObserver(simplifyWorkerCards)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [maintenanceJobIds])

  return null
}
