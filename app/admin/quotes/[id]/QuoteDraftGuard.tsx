'use client'

import { useEffect } from 'react'

type SavedControl = {
  key: string
  value: string
  checked?: boolean
}

type SavedDraft = {
  version: 1
  savedAt: string
  controls: SavedControl[]
}

const STORAGE_PREFIX = 'furlads-admin-quote-draft-v1:'

function controlKey(control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, index: number) {
  const name = control.getAttribute('name')?.trim()
  if (name) return `name:${name}`

  const id = control.id?.trim()
  if (id) return `id:${id}`

  const type = control instanceof HTMLInputElement ? control.type || 'text' : control.tagName.toLowerCase()
  return `${control.tagName.toLowerCase()}:${type}:${index}`
}

function getControls(root: HTMLElement) {
  return Array.from(
    root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select')
  ).filter((control) => !control.readOnly && !control.disabled)
}

function capture(root: HTMLElement): SavedDraft {
  const controls = getControls(root).map((control, index) => ({
    key: controlKey(control, index),
    value: control.value,
    ...(control instanceof HTMLInputElement && (control.type === 'checkbox' || control.type === 'radio')
      ? { checked: control.checked }
      : {}),
  }))

  return {
    version: 1,
    savedAt: new Date().toISOString(),
    controls,
  }
}

function setNativeValue(control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  if (control instanceof HTMLInputElement) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(control, value)
  } else if (control instanceof HTMLTextAreaElement) {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
    setter?.call(control, value)
  } else {
    control.value = value
  }
}

function restore(root: HTMLElement, draft: SavedDraft) {
  const controls = getControls(root)
  const savedByKey = new Map(draft.controls.map((control) => [control.key, control]))

  controls.forEach((control, index) => {
    const saved = savedByKey.get(controlKey(control, index))
    if (!saved) return

    if (control instanceof HTMLInputElement && (control.type === 'checkbox' || control.type === 'radio')) {
      if (typeof saved.checked === 'boolean') control.checked = saved.checked
    } else {
      setNativeValue(control, saved.value)
    }

    control.dispatchEvent(new Event('input', { bubbles: true }))
    control.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

export default function QuoteDraftGuard({ quoteId }: { quoteId: number }) {
  useEffect(() => {
    const root = document.getElementById('quote-editor-autosave')
    if (!root) return

    const storageKey = `${STORAGE_PREFIX}${quoteId}`
    let saveTimer: number | null = null

    try {
      const raw = window.localStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw) as SavedDraft
        if (parsed?.version === 1 && Array.isArray(parsed.controls)) {
          window.setTimeout(() => restore(root, parsed), 0)
        }
      }
    } catch (error) {
      console.warn('Could not restore quote draft:', error)
    }

    function saveDraft() {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(capture(root)))
      } catch (error) {
        console.warn('Could not autosave quote draft:', error)
      }
    }

    function queueSave() {
      if (saveTimer) window.clearTimeout(saveTimer)
      saveTimer = window.setTimeout(saveDraft, 250)
    }

    function clearSavedDraftIfCommitted() {
      const text = root.textContent || ''
      const committed =
        text.includes('Quote saved.') ||
        text.includes('Quote amendment saved.') ||
        text.includes('Quote moved to ') ||
        text.includes('Fresh Kelly-led customer message generated.') ||
        text.includes('Fresh post-visit Trev message generated.')

      if (!committed) return

      try {
        window.localStorage.removeItem(storageKey)
      } catch {
        // If storage is unavailable there is nothing else to clear.
      }
    }

    root.addEventListener('input', queueSave, true)
    root.addEventListener('change', queueSave, true)

    const observer = new MutationObserver(clearSavedDraftIfCommitted)
    observer.observe(root, { childList: true, subtree: true, characterData: true })

    return () => {
      if (saveTimer) window.clearTimeout(saveTimer)
      root.removeEventListener('input', queueSave, true)
      root.removeEventListener('change', queueSave, true)
      observer.disconnect()
    }
  }, [quoteId])

  return null
}
