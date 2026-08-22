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
    let active = false

    function isPhotoUpload(input: RequestInfo | URL) {
      const url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.pathname
          : input.url

      return String(url).includes('/api/ai/quote/photos')
    }

    async function runNext() {
      if (active) return
      const job = queue.shift()
      if (!job) return

      active = true
      try {
        // Use the normal Next.js upload endpoint. The selected photo has already
        // been reduced before it reaches this queue, so the request stays small.
        // Keeping one request active at a time avoids the browser-side Vercel
        // Blob uploader that was hanging on the final image in Chrome/PWA.
        const response = await originalFetch(job.input, job.init)
        job.resolve(response)
      } catch (error) {
        job.reject(error)
      } finally {
        active = false
        window.setTimeout(() => void runNext(), 30)
      }
    }

    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      if (!isPhotoUpload(input)) {
        return originalFetch(input, init)
      }

      return new Promise<Response>((resolve, reject) => {
        queue.push({ input, init, resolve, reject })
        void runNext()
      })
    }) as typeof window.fetch

    return () => {
      window.fetch = originalFetch as typeof window.fetch
      while (queue.length) {
        queue.shift()?.reject(
          new Error('Photo upload cancelled because the page changed.')
        )
      }
    }
  }, [])

  return null
}
