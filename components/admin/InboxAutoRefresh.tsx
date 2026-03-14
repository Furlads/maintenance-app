"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function InboxAutoRefresh() {
  const router = useRouter()

  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh()
    }, 5000)

    return () => clearInterval(interval)
  }, [router])

  return null
}