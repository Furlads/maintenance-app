'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

export default function QuoteChasAutoRefresh({ quoteId }: { quoteId: number }) {
  const router = useRouter()
  const lastMessageId = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    async function check() {
      if (cancelled) return

      try {
        if (document.visibilityState !== 'visible') return

        const response = await fetch(`/api/quotes/${quoteId}/chas`, { cache: 'no-store' })
        const data = await response.json().catch(() => null)
        if (!response.ok || !data?.ok || !Array.isArray(data.messages)) return

        const latest = data.messages[data.messages.length - 1]
        const latestId = Number(latest?.id || 0)
        if (!latestId) return

        if (lastMessageId.current === null) {
          lastMessageId.current = latestId
          return
        }

        if (latestId !== lastMessageId.current) {
          lastMessageId.current = latestId
          router.refresh()
        }
      } catch {
        // Quietly retry. The quote editor already shows any CHAS request error.
      } finally {
        if (!cancelled) timer = setTimeout(check, 1500)
      }
    }

    void check()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [quoteId, router])

  return null
}
