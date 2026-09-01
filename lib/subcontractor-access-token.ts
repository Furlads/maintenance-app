import crypto from 'crypto'

export type ContractorAccessPurpose = 'onboarding' | 'reset'

type Payload = {
  workerId: number
  purpose: ContractorAccessPurpose
  exp: number
  state: string
}

function secret() {
  const value = process.env.SESSION_SECRET?.trim()
  if (value) return value
  if (process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET is missing in production.')
  return 'dev-secret-change-me'
}

function b64(value: string | Buffer) {
  return Buffer.from(value).toString('base64url')
}

function stateFor(passwordHash: string | null | undefined, phone: string | null | undefined) {
  return crypto.createHash('sha256').update(passwordHash || `unregistered:${phone || ''}`).digest('hex').slice(0, 24)
}

export function createContractorAccessToken(input: {
  workerId: number
  purpose: ContractorAccessPurpose
  passwordHash?: string | null
  phone?: string | null
  ttlSeconds?: number
}) {
  const payload: Payload = {
    workerId: input.workerId,
    purpose: input.purpose,
    exp: Math.floor(Date.now() / 1000) + (input.ttlSeconds || 60 * 60 * 24 * 3),
    state: stateFor(input.passwordHash, input.phone),
  }
  const body = b64(JSON.stringify(payload))
  const signature = crypto.createHmac('sha256', secret()).update(body).digest('base64url')
  return `${body}.${signature}`
}

export function verifyContractorAccessToken(token: string, worker: { passwordHash?: string | null; phone?: string | null }) {
  try {
    const [body, signature] = String(token || '').split('.')
    if (!body || !signature) return null
    const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url')
    const a = Buffer.from(signature)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Payload
    if (!payload.workerId || !['onboarding', 'reset'].includes(payload.purpose) || payload.exp < Math.floor(Date.now() / 1000)) return null
    if (payload.state !== stateFor(worker.passwordHash, worker.phone)) return null
    if (payload.purpose === 'onboarding' && worker.passwordHash) return null
    if (payload.purpose === 'reset' && !worker.passwordHash) return null
    return payload
  } catch {
    return null
  }
}
