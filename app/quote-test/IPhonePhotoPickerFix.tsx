'use client'

import { useEffect } from 'react'

type PickerInput = HTMLInputElement & {
  showPicker?: () => void
}

export default function IPhonePhotoPickerFix() {
  useEffect(() => {
    const input = document.querySelector<HTMLInputElement>(
      'footer input[type="file"][accept*="image"]'
    ) as PickerInput | null
    const button = document.querySelector<HTMLButtonElement>(
      'footer button[aria-label="Add site photos"]'
    )

    if (!input || !button) return

    // Keep iPhone library formats selectable even when Safari reports HEIC/HEIF
    // with a non-standard MIME type.
    input.accept = 'image/*,.heic,.heif'

    const openNativePicker = (event: MouseEvent) => {
      if (button.disabled) return

      // Safari is more reliable when the native picker is opened directly from
      // the user's tap, rather than through React's programmatic .click().
      event.preventDefault()
      event.stopPropagation()

      try {
        if (typeof input.showPicker === 'function') {
          input.showPicker()
        } else {
          input.click()
        }
      } catch {
        input.click()
      }
    }

    button.addEventListener('click', openNativePicker, true)

    return () => {
      button.removeEventListener('click', openNativePicker, true)
    }
  }, [])

  return null
}
