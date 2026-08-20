'use client'

import { useEffect } from 'react'

type Props = {
  maintenanceJobIds: number[]
}

const LEGACY_MAINTENANCE_ACTIONS = new Set([
  'Start Job',
  'Pause',
  'Resume',
  'Finish Job',
  'Couldn’t Complete',
  "Couldn't Complete",
  'Add 30 mins',
  'Add Other Time',
  'Undo Start',
])

function cleanText(value: string | null | undefined) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function findJobContainer(link: HTMLAnchorElement) {
  let node: HTMLElement | null = link.parentElement

  while (node && node !== document.body) {
    const hasLegacyControls =
      Boolean(node.querySelector('.today-quick-actions')) ||
      Boolean(node.querySelector('.today-active-actions'))

    if (hasLegacyControls) return node
    node = node.parentElement
  }

  return null
}

export default function MaintenanceTimerCleaner({ maintenanceJobIds }: Props) {
  useEffect(() => {
    if (!maintenanceJobIds.length) return

    const maintenanceIds = new Set(maintenanceJobIds.map(String))

    function cleanMaintenanceCards() {
      const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="/jobs/"]'))

      for (const link of links) {
        const match = link.getAttribute('href')?.match(/^\/jobs\/(\d+)/)
        if (!match || !maintenanceIds.has(match[1])) continue

        const container = findJobContainer(link)
        if (!container) continue

        const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
        for (const button of buttons) {
          if (LEGACY_MAINTENANCE_ACTIONS.has(cleanText(button.textContent))) {
            button.style.display = 'none'
          }
        }

        const quickActions = container.querySelector<HTMLElement>('.today-quick-actions')
        if (quickActions) quickActions.style.display = 'none'

        const actionGroups = Array.from(container.querySelectorAll<HTMLElement>('.today-job-actions'))
        for (const group of actionGroups) {
          const visibleUsefulControl = Array.from(group.querySelectorAll('a,button')).some((control) => {
            const text = cleanText(control.textContent)
            return text && !LEGACY_MAINTENANCE_ACTIONS.has(text)
          })

          if (!visibleUsefulControl) group.style.display = 'none'
        }
      }
    }

    cleanMaintenanceCards()

    const observer = new MutationObserver(cleanMaintenanceCards)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [maintenanceJobIds])

  return null
}
