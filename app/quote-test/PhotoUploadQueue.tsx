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
    let active = false

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
          // Files are compressed before they reach here. Keeping this as one
          // normal request avoids the CPU/network overhead of multipart uploads
          // and is much more stable in installed Chrome/Safari PWAs.
          multipart: false,
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

    async function runNext() {
      if (active) return
      const job = queue.shift()
      if (!job) return

      active = true
      try {
        const response = await uploadDirect(job)
        job.resolve(response)
      } catch (error) {
        job.reject(error)
      } finally {
        active = false
        window.setTimeout(() => void runNext(), 20)
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
        queue.shift()?.reject(new Error('Photo upload cancelled because the page changed.'))
      }
    }
  }, [])

  return null
}
