'use client'

import { useEffect, useMemo, useState } from 'react'
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

function findAddressCard() {
  const headings = Array.from(document.querySelectorAll('h2'))
  const customerDetailsHeading = headings.find(
    (heading) => heading.textContent?.trim() === 'Customer Details'
  )
  const section = customerDetailsHeading?.closest('section')
  if (!section) return null

  const labels = Array.from(section.querySelectorAll('div'))
  const addressLabel = labels.find(
    (element) => element.textContent?.trim() === 'Address'
  )

  return addressLabel?.parentElement || null
}

function buildWasteAwayBanner(status: WasteAwayStatus) {
  const selected = status !== null
  const banner = document.createElement('div')
  banner.dataset.customerWasteAway = 'true'
  banner.style.gridColumn = '1 / -1'
  banner.style.background = selected ? '#ecfdf3' : '#fff8d9'
  banner.style.border = selected ? '1px solid #86efac' : '1px solid #ffe27a'
  banner.style.borderRadius = '12px'
  banner.style.padding = '12px'

  const label = document.createElement('div')
  label.textContent = 'Waste Away'
  label.style.fontSize = '12px'
  label.style.fontWeight = '800'
  label.style.color = selected ? '#166534' : '#6a5600'
  label.style.marginBottom = '6px'
  label.style.textTransform = 'uppercase'
  label.style.letterSpacing = '0.3px'

  const value = document.createElement('div')
  value.textContent = selected
    ? status
    : 'Not selected — check with Kelly or customer'
  value.style.fontSize = '15px'
  value.style.fontWeight = '800'
  value.style.color = selected ? '#14532d' : '#5f4b00'

  banner.append(label, value)
  return banner
}

export default function CustomerWasteAway() {
  const params = useParams()
  const customerId = useMemo(() => Number(params.id), [params.id])
  const [status, setStatus] = useState<WasteAwayStatus>(null)
  const [loaded, setLoaded] = useState(false)

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
    if (!loaded) return

    let banner: HTMLDivElement | null = null

    function mountBanner() {
      document.querySelector('[data-customer-waste-away="true"]')?.remove()

      const addressCard = findAddressCard()
      if (!addressCard) return false

      banner = buildWasteAwayBanner(status)
      addressCard.insertAdjacentElement('afterend', banner)
      return true
    }

    if (mountBanner()) {
      return () => banner?.remove()
    }

    const observer = new MutationObserver(() => {
      if (mountBanner()) observer.disconnect()
    })

    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      banner?.remove()
    }
  }, [loaded, status])

  return null
}
