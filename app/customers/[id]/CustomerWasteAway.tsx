'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams } from 'next/navigation'

type Job = {
  id: number
  customerId: number
  notes: string | null
  createdAt: string
}

type WasteAwayStatus = 'YES' | 'NO' | null

function getWasteAwayStatus(jobs: Job[], customerId: number): WasteAwayStatus {
  const customerJobs = jobs
    .filter((job) => job.customerId === customerId)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

  for (const job of customerJobs) {
    const match = String(job.notes || '').match(/Waste away:\s*(YES|NO)/i)
    if (match) return match[1].toUpperCase() as 'YES' | 'NO'
  }

  return null
}

export default function CustomerWasteAway() {
  const params = useParams()
  const customerId = useMemo(() => Number(params.id), [params.id])
  const [status, setStatus] = useState<WasteAwayStatus>(null)
  const [loaded, setLoaded] = useState(false)
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadWasteAway() {
      try {
        const response = await fetch('/api/jobs', { cache: 'no-store' })
        if (!response.ok) return

        const data = await response.json()
        if (!cancelled && Array.isArray(data)) {
          setStatus(getWasteAwayStatus(data, customerId))
        }
      } catch (error) {
        console.error('Failed to load waste-away status', error)
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }

    if (Number.isFinite(customerId)) loadWasteAway()

    return () => {
      cancelled = true
    }
  }, [customerId])

  useEffect(() => {
    let target: HTMLElement | null = null

    function findAddressCard() {
      const headings = Array.from(document.querySelectorAll('h2'))
      const customerDetailsHeading = headings.find(
        (heading) => heading.textContent?.trim() === 'Customer Details'
      )
      const section = customerDetailsHeading?.closest('section')
      if (!section) return

      const labels = Array.from(section.querySelectorAll('div'))
      const addressLabel = labels.find(
        (element) => element.textContent?.trim() === 'Address'
      )
      const addressCard = addressLabel?.parentElement
      if (!addressCard || !addressCard.parentElement) return

      target = document.createElement('div')
      target.dataset.customerWasteAway = 'true'
      target.style.gridColumn = '1 / -1'
      addressCard.insertAdjacentElement('afterend', target)
      setPortalTarget(target)
    }

    findAddressCard()
    if (target) return () => target?.remove()

    const observer = new MutationObserver(() => {
      if (!target) findAddressCard()
      if (target) observer.disconnect()
    })

    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      target?.remove()
    }
  }, [])

  if (!loaded || !portalTarget) return null

  const selected = status !== null

  return createPortal(
    <div
      style={{
        background: selected ? '#ecfdf3' : '#fff8d9',
        border: selected ? '1px solid #86efac' : '1px solid #ffe27a',
        borderRadius: 12,
        padding: 12,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          color: selected ? '#166534' : '#6a5600',
          marginBottom: 6,
          textTransform: 'uppercase',
          letterSpacing: 0.3,
        }}
      >
        Waste Away
      </div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 800,
          color: selected ? '#14532d' : '#5f4b00',
        }}
      >
        {selected ? status : 'Not selected — check with Kelly or customer'}
      </div>
    </div>,
    portalTarget
  )
}
