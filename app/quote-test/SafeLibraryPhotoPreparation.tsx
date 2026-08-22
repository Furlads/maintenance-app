'use client'

import { useEffect } from 'react'

const TARGET_BYTES = 1.1 * 1024 * 1024
const MAX_SIDE = 1440

type PreparedInput = HTMLInputElement & {
  dataset: DOMStringMap & {
    safeLibraryPrepared?: string
    safeLibraryWorking?: string
    quotePhotosPrepared?: string
  }
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }

    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not prepare photo'))
    }

    image.src = url
  })
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not compress photo'))),
      'image/jpeg',
      quality,
    )
  })
}

async function prepareFile(file: File) {
  if (file.size <= 650 * 1024 && /^image\/(jpeg|jpg|webp)$/i.test(file.type || '')) {
    return file
  }

  const image = await loadImage(file)
  const naturalWidth = image.naturalWidth || image.width
  const naturalHeight = image.naturalHeight || image.height
  const scale = Math.min(1, MAX_SIDE / Math.max(naturalWidth, naturalHeight))
  const width = Math.max(1, Math.round(naturalWidth * scale))
  const height = Math.max(1, Math.round(naturalHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) return file

  context.drawImage(image, 0, 0, width, height)

  let quality = 0.7
  let blob = await canvasBlob(canvas, quality)
  while (blob.size > TARGET_BYTES && quality > 0.46) {
    quality -= 0.08
    blob = await canvasBlob(canvas, quality)
  }

  // Release the large backing store before moving on to the next iPhone photo.
  canvas.width = 1
  canvas.height = 1

  const baseName = (file.name || 'site-photo').replace(/\.[^.]+$/, '')
  return new File([blob], `${baseName}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  })
}

export default function SafeLibraryPhotoPreparation() {
  useEffect(() => {
    const attached = new WeakSet<HTMLInputElement>()

    function attach(input: PreparedInput) {
      if (attached.has(input)) return
      attached.add(input)

      // Mark before iOS opens the picker so the older global handler does not
      // try to process the whole batch in parallel when selection returns.
      input.addEventListener('click', () => {
        input.dataset.quotePhotosPrepared = '1'
      })

      input.addEventListener(
        'change',
        async (event) => {
          if (input.dataset.safeLibraryPrepared === '1') {
            delete input.dataset.safeLibraryPrepared
            return
          }

          if (input.dataset.safeLibraryWorking === '1') return

          const files = Array.from(input.files || [])
          if (!files.length) return

          event.preventDefault()
          event.stopImmediatePropagation()
          input.dataset.safeLibraryWorking = '1'

          try {
            const prepared: File[] = []

            // Deliberately sequential. Seven 12MP iPhone images decoded in
            // parallel can push Safari/PWA over its memory ceiling and kill it.
            for (const file of files) {
              try {
                prepared.push(await prepareFile(file))
              } catch {
                prepared.push(file)
              }

              // Give Safari a chance to release the previous image/canvas.
              await new Promise<void>((resolve) => window.setTimeout(resolve, 30))
            }

            const transfer = new DataTransfer()
            prepared.forEach((file) => transfer.items.add(file))
            input.files = transfer.files
            input.dataset.safeLibraryPrepared = '1'
            input.dataset.quotePhotosPrepared = '1'
          } finally {
            delete input.dataset.safeLibraryWorking
          }

          input.dispatchEvent(new Event('change', { bubbles: true }))
        },
        true,
      )
    }

    function scan() {
      document
        .querySelectorAll<PreparedInput>('input[type="file"][accept*="image"]')
        .forEach(attach)
    }

    scan()
    const observer = new MutationObserver(scan)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [])

  return null
}
