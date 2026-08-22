'use client'

import { useEffect } from 'react'

type PendingUpload = {
  input: RequestInfo | URL
  init?: RequestInit
  resolve: (value: Response) => void
  reject: (reason?: unknown) => void
}

export default function PhotoUploadQueue() {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window)
    const queue: PendingUpload[] = []
    let active = 0
    const MAX_CONCURRENT_UPLOADS = 2

    function isPhotoUpload(input: RequestInfo | URL) {
      const url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.pathname
          : input.url

      return String(url).includes('/api/ai/quote/photos')
    }

    function runNext() {
      while (active < MAX_CONCURRENT_UPLOADS && queue.length) {
        const job = queue.shift()
        if (!job) return

        active += 1
        originalFetch(job.input, job.init)
          .then(job.resolve, job.reject)
          .finally(() => {
            active -= 1
            runNext()
          })
      }
    }

    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      if (!isPhotoUpload(input)) {
        return originalFetch(input, init)
      }

      return new Promise<Response>((resolve, reject) => {
        queue.push({ input, init, resolve, reject })
        runNext()
      })
    }) as typeof window.fetch

    return () => {
      window.fetch = originalFetch as typeof window.fetch
      while (queue.length) {
        queue.shift()?.reject(new Error('Photo upload cancelled because the page changed.'))
      }
    }
  }, [])

  return null
}
