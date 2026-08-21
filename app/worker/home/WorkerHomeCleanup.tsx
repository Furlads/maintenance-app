"use client"

import { useEffect } from "react"

const LEGACY_ACTION_TITLES = new Set([
  "Start Travel",
  "Start / Finish Work",
  "Upload Photos",
])

function cleanWorkerHome() {
  const candidates = Array.from(document.querySelectorAll("a, button"))

  for (const candidate of candidates) {
    const text = String(candidate.textContent || "").replace(/\s+/g, " ").trim()

    for (const title of LEGACY_ACTION_TITLES) {
      if (text.includes(title)) {
        ;(candidate as HTMLElement).style.display = "none"
        break
      }
    }
  }
}

export default function WorkerHomeCleanup() {
  useEffect(() => {
    cleanWorkerHome()

    const observer = new MutationObserver(() => cleanWorkerHome())
    observer.observe(document.body, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [])

  return null
}
