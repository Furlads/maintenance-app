'use client'

import { useEffect } from 'react'

type PendingUpload = {
  input: RequestInfo | URL
  init?: RequestInit
  resolve: (value: Response) => void
  reject: (reason?: unknown) => void
}

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500
}

export default function PhotoUploadQueue() {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window)
    const queue: PendingUpload[] = []
    let active = false

    function isPhotoUpload(input: RequestInfo | URL) {
      const url = requestUrl(input)
      return (
        url.includes('/api/ai/quote/photos') ||
        url.includes('blob.vercel-storage.com') ||
        url.includes('vercel-storage.com')
      )
    }

    async function performAttempt(job: PendingUpload) {
      if (job.input instanceof Request) {
        return originalFetch(job.input.clone(), job.init)
      }
      return originalFetch(job.input, job.init)
    }

    async function uploadWithRetry(job: PendingUpload) {
      let lastError: unknown = null

      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          const response = await performAttempt(job)

          if (!isRetryableStatus(response.status) || attempt === 3) {
            return response
          }

          try {
            await response.body?.cancel()
          } catch {
            // Nothing to do. We are retrying the transfer anyway.
          }
        } catch (error) {
          lastError = error
          if (attempt === 3) throw error
        }

        // Mobile data can briefly drop during cell handover. Give the radio a
        // moment to recover before retrying instead of immediately failing the photo.
        await new Promise<void>((resolve) =>
          window.setTimeout(resolve, attempt === 1 ? 800 : 1800)
        )
      }

      throw lastError instanceof Error
        ? lastError
        : new Error('Photo upload failed after retrying.')
    }

    async function runNext() {
      if (active) return
      const job = queue.shift()
      if (!job) return

      active = true
      try {
        // On 4G, several simultaneous Blob uploads can compete for a weak uplink
        // and fail together. Keep photo transfers strictly sequential and retry
        // transient network/server failures before reporting them as failed.
        const response = await uploadWithRetry(job)
        job.resolve(response)
      } catch (error) {
        job.reject(error)
      } finally {
        active = false
        window.setTimeout(() => void runNext(), 120)
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
