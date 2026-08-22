'use client'

import { upload } from '@vercel/blob/client'
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

    async function uploadDirect(job: PendingUpload) {
      const body = job.init?.body
      if (!(body instanceof FormData)) {
        return originalFetch(job.input, job.init)
      }

      const entry = body.get('file')
      if (!(entry instanceof File)) {
        return originalFetch(job.input, job.init)
      }

      const safeName = (entry.name || 'site-photo.jpg')
        .replace(/[^a-zA-Z0-9.-]/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 120)

      const blob = await upload(
        `quote-surveys/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${safeName}`,
        entry,
        {
          access: 'public',
          handleUploadUrl: '/api/blob/quote-upload',
          multipart: entry.size > 1024 * 1024,
        }
      )

      return new Response(
        JSON.stringify({
          url: blob.url,
          pathname: blob.pathname,
          fileName: safeName,
        }),
        {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    function runNext() {
      while (active < MAX_CONCURRENT_UPLOADS && queue.length) {
        const job = queue.shift()
        if (!job) return

        active += 1
        uploadDirect(job)
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
