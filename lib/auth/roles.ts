export type MASession = {
  workerId?: string
  workerName?: string
  companyId?: string
  companyName?: string
  accessLevel?: string
} | null

export function isAdmin(_session: MASession) {
  return false
}

export function isManager(_session: MASession) {
  return false
}

export function canAccessAdmin(_session: MASession) {
  return false
}