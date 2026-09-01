import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export type ContractorRecipient = {
  workerId: number
  status: string
  sourceJobId: number | null
}

export async function getContractorRecipient(token: string) {
  const rows = await prisma.$queryRaw<ContractorRecipient[]>`
    SELECT r."workerId", r."status", o."sourceJobId"
    FROM "SubcontractorOpportunityRecipient" r
    JOIN "SubcontractorOpportunity" o ON o."id" = r."opportunityId"
    WHERE r."token" = ${token}
    LIMIT 1
  `
  return rows[0] ?? null
}

export async function contractorSessionMatchesWorker(workerId: number) {
  const session = await getSession()
  if (!session?.workerId) return false
  return Number(session.workerId) === workerId
}

export async function requireContractorForToken(token: string) {
  const recipient = await getContractorRecipient(token)
  if (!recipient) return { ok: false as const, reason: 'not_found' as const, recipient: null }
  const sessionMatches = await contractorSessionMatchesWorker(recipient.workerId)
  if (!sessionMatches) return { ok: false as const, reason: 'unauthenticated' as const, recipient }

  const worker = await prisma.worker.findUnique({
    where: { id: recipient.workerId },
    select: { active: true, employmentType: true, passwordHash: true },
  })

  if (!worker || !worker.active || worker.employmentType !== 'subcontractor' || !worker.passwordHash) {
    return { ok: false as const, reason: 'unauthenticated' as const, recipient }
  }

  return { ok: true as const, recipient }
}

export function normaliseUkPhone(value: string) {
  const compact = String(value || '').replace(/[^0-9+]/g, '')
  if (compact.startsWith('+44')) return `0${compact.slice(3)}`
  if (compact.startsWith('44') && compact.length >= 12) return `0${compact.slice(2)}`
  return compact
}
