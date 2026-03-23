export type OfflineJobActionType = 'start' | 'pause' | 'resume' | 'finish'

export type OfflineJobAction = {
  id: string
  jobId: number
  action: OfflineJobActionType
  createdAt: string
}

const JOB_ACTION_QUEUE_KEY = 'furlads:job-action-queue'

function isBrowser() {
  return typeof window !== 'undefined'
}

function makeQueueId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `queue-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function getQueuedJobActions(): OfflineJobAction[] {
  if (!isBrowser()) return []

  const raw = window.localStorage.getItem(JOB_ACTION_QUEUE_KEY)

  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.error('Failed to parse job action queue:', error)
    return []
  }
}

export function saveQueuedJobActions(actions: OfflineJobAction[]) {
  if (!isBrowser()) return

  try {
    window.localStorage.setItem(JOB_ACTION_QUEUE_KEY, JSON.stringify(actions))
  } catch (error) {
    console.error('Failed to save job action queue:', error)
  }
}

export function queueJobAction(jobId: number, action: OfflineJobActionType) {
  const current = getQueuedJobActions()

  const next: OfflineJobAction = {
    id: makeQueueId(),
    jobId,
    action,
    createdAt: new Date().toISOString(),
  }

  saveQueuedJobActions([...current, next])

  return next
}

export function removeQueuedJobAction(queueId: string) {
  const current = getQueuedJobActions()
  saveQueuedJobActions(current.filter((item) => item.id !== queueId))
}

export function clearQueuedJobActions() {
  if (!isBrowser()) return
  window.localStorage.removeItem(JOB_ACTION_QUEUE_KEY)
}

export function getQueuedJobActionCount() {
  return getQueuedJobActions().length
}

export async function flushQueuedJobActions() {
  const queued = getQueuedJobActions()

  if (!queued.length) {
    return { ok: true, flushed: 0 }
  }

  let flushed = 0

  for (const item of queued) {
    try {
      const res = await fetch(`/api/jobs/${item.jobId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: item.action,
        }),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || `Failed to sync ${item.action}`)
      }

      removeQueuedJobAction(item.id)
      flushed += 1
    } catch (error) {
      console.error('Failed to flush queued job action:', item, error)
      break
    }
  }

  return { ok: true, flushed }
}