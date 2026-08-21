import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { processDueAlerts } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EXPECTED_ISSUER = 'https://token.actions.githubusercontent.com'
const EXPECTED_AUDIENCE = 'furlads-quote-reminders'
const EXPECTED_REPOSITORY = 'Furlads/maintenance-app'
const EXPECTED_WORKFLOW_PREFIX = 'Furlads/maintenance-app/.github/workflows/quote-reminders.yml@refs/heads/main'

type JwtHeader = {
  alg?: string
  kid?: string
}

type JwtPayload = {
  iss?: string
  aud?: string | string[]
  exp?: number
  nbf?: number
  repository?: string
  ref?: string
  event_name?: string
  workflow_ref?: string
}

function decodeBase64UrlJson<T>(value: string): T {
  const normalised = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = '='.repeat((4 - (normalised.length % 4)) % 4)
  return JSON.parse(Buffer.from(normalised + padding, 'base64').toString('utf8')) as T
}

function decodeBase64Url(value: string) {
  const normalised = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = '='.repeat((4 - (normalised.length % 4)) % 4)
  return Buffer.from(normalised + padding, 'base64')
}

function audienceMatches(aud: string | string[] | undefined) {
  if (Array.isArray(aud)) return aud.includes(EXPECTED_AUDIENCE)
  return aud === EXPECTED_AUDIENCE
}

async function verifyGitHubOidcToken(token: string) {
  const parts = token.split('.')
  if (parts.length !== 3) return false

  const [headerPart, payloadPart, signaturePart] = parts
  const header = decodeBase64UrlJson<JwtHeader>(headerPart)
  const payload = decodeBase64UrlJson<JwtPayload>(payloadPart)

  if (header.alg !== 'RS256' || !header.kid) return false
  if (payload.iss !== EXPECTED_ISSUER) return false
  if (!audienceMatches(payload.aud)) return false
  if (payload.repository !== EXPECTED_REPOSITORY) return false
  if (payload.ref !== 'refs/heads/main') return false
  if (payload.workflow_ref !== EXPECTED_WORKFLOW_PREFIX) return false
  if (payload.event_name !== 'schedule' && payload.event_name !== 'workflow_dispatch') return false

  const now = Math.floor(Date.now() / 1000)
  if (!payload.exp || payload.exp < now) return false
  if (payload.nbf && payload.nbf > now + 30) return false

  const configurationResponse = await fetch(`${EXPECTED_ISSUER}/.well-known/openid-configuration`, {
    cache: 'no-store',
  })
  if (!configurationResponse.ok) return false

  const configuration = await configurationResponse.json() as { jwks_uri?: string }
  if (!configuration.jwks_uri) return false

  const jwksResponse = await fetch(configuration.jwks_uri, { cache: 'no-store' })
  if (!jwksResponse.ok) return false

  const jwks = await jwksResponse.json() as { keys?: Array<Record<string, unknown> & { kid?: string }> }
  const jwk = jwks.keys?.find((key) => key.kid === header.kid)
  if (!jwk) return false

  const publicKey = crypto.createPublicKey({ key: jwk as crypto.JsonWebKey, format: 'jwk' })
  const signingInput = Buffer.from(`${headerPart}.${payloadPart}`)
  const signature = decodeBase64Url(signaturePart)

  return crypto.verify('RSA-SHA256', signingInput, publicKey, signature)
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : ''

    if (!token || !(await verifyGitHubOidcToken(token))) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const result = await processDueAlerts(100)
    return NextResponse.json(result)
  } catch (error) {
    console.error('POST /api/cron/alerts/github failed:', error)
    return NextResponse.json({ ok: false, error: 'Failed to process quote reminders' }, { status: 500 })
  }
}
