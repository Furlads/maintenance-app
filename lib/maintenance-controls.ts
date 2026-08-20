import prisma from '@/lib/prisma'

export const MAINTENANCE_CONTROLS_PREFIX = 'MAINTENANCE_CONTROLS_JSON:'

export type MaintenanceOpportunitySource = 'worker_spotted' | 'customer_requested'
export type MaintenanceOpportunityStatus = 'open' | 'quote_created' | 'dismissed'
export type MaintenanceCompletionReason = '' | 'no_access' | 'weather' | 'customer_cancelled' | 'materials' | 'ran_out_of_time' | 'other'

export type MaintenanceExtraWork = {
  id: string
  description: string
  source: MaintenanceOpportunitySource
  status: MaintenanceOpportunityStatus
  reportedBy: string
  reportedAt: string
  quoteId: number | null
  photoUrl: string
}

export type MaintenanceControls = {
  version: 3
  jobId: number
  updatedAt: string
  propertyMemory: string
  nextVisitNote: string
  extraWork: MaintenanceExtraWork[]
  outcome: '' | 'completed' | 'could_not_complete'
  completionReason: MaintenanceCompletionReason
  completionNote: string
  completedAt: string
}

export type MaintenanceOpportunityRow = MaintenanceExtraWork & {
  jobId: number
  customerId: number
  customerName: string
  address: string
  postcode: string
  visitDate: Date | null
}

export type MaintenanceIncompleteRow = {
  jobId: number
  customerName: string
  visitDate: Date | null
  reason: MaintenanceCompletionReason
  note: string
  completedAt: string
}

const EMPTY: Omit<MaintenanceControls, 'jobId'> = {
  version: 3,
  updatedAt: '',
  propertyMemory: '',
  nextVisitNote: '',
  extraWork: [],
  outcome: '',
  completionReason: '',
  completionNote: '',
  completedAt: '',
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function cleanSource(value: unknown): MaintenanceOpportunitySource {
  return cleanText(value) === 'customer_requested' ? 'customer_requested' : 'worker_spotted'
}

function cleanOpportunityStatus(value: unknown): MaintenanceOpportunityStatus {
  const text = cleanText(value)
  if (text === 'quote_created' || text === 'quoted') return 'quote_created'
  if (text === 'dismissed') return 'dismissed'
  return 'open'
}

function cleanCompletionReason(value: unknown): MaintenanceCompletionReason {
  const text = cleanText(value)
  if (
    text === 'no_access' ||
    text === 'weather' ||
    text === 'customer_cancelled' ||
    text === 'materials' ||
    text === 'ran_out_of_time' ||
    text === 'other'
  ) return text
  return ''
}

function cleanQuoteId(value: unknown) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

function normaliseExtraWork(value: unknown): MaintenanceExtraWork[] {
  if (!Array.isArray(value)) return []
  return value
    .map((raw, index) => {
      const row = raw && typeof raw === 'object' && !Array.isArray(raw)
        ? raw as Record<string, unknown>
        : {}
      const description = cleanText(row.description)
      if (!description) return null
      return {
        id: cleanText(row.id) || `extra-${Date.now()}-${index}`,
        description,
        source: cleanSource(row.source),
        status: cleanOpportunityStatus(row.status),
        reportedBy: cleanText(row.reportedBy) || 'Worker',
        reportedAt: cleanText(row.reportedAt) || new Date().toISOString(),
        quoteId: cleanQuoteId(row.quoteId),
        photoUrl: cleanText(row.photoUrl),
      }
    })
    .filter((row): row is MaintenanceExtraWork => Boolean(row))
    .slice(0, 100)
}

export function parseMaintenanceControlsNote(note: string | null | undefined): MaintenanceControls | null {
  if (!note || !note.startsWith(MAINTENANCE_CONTROLS_PREFIX)) return null
  try {
    const raw = JSON.parse(note.slice(MAINTENANCE_CONTROLS_PREFIX.length)) as Record<string, unknown>
    const jobId = Number(raw.jobId)
    if (!Number.isInteger(jobId) || jobId <= 0) return null
    const rawOutcome = cleanText(raw.outcome)
    const outcome = rawOutcome === 'completed' || rawOutcome === 'could_not_complete' ? rawOutcome : ''
    return {
      version: 3,
      jobId,
      updatedAt: cleanText(raw.updatedAt),
      propertyMemory: cleanText(raw.propertyMemory),
      nextVisitNote: cleanText(raw.nextVisitNote),
      extraWork: normaliseExtraWork(raw.extraWork),
      outcome,
      completionReason: cleanCompletionReason(raw.completionReason),
      completionNote: cleanText(raw.completionNote),
      completedAt: cleanText(raw.completedAt),
    }
  } catch {
    return null
  }
}

export async function getMaintenanceControls(jobId: number): Promise<MaintenanceControls> {
  const notes = await prisma.jobNote.findMany({
    where: { jobId, note: { startsWith: MAINTENANCE_CONTROLS_PREFIX } },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { note: true },
  })

  for (const row of notes) {
    const parsed = parseMaintenanceControlsNote(row.note)
    if (parsed) return parsed
  }

  return { ...EMPTY, jobId, extraWork: [] }
}

async function getPreviousMaintenanceField(
  customerId: number,
  currentJobId: number,
  field: 'nextVisitNote' | 'propertyMemory'
) {
  const jobs = await prisma.job.findMany({
    where: {
      customerId,
      jobType: { equals: 'Maintenance', mode: 'insensitive' },
      id: { not: currentJobId },
    },
    orderBy: [{ visitDate: 'desc' }, { createdAt: 'desc' }],
    take: 40,
    select: {
      jobNotes: {
        where: { note: { startsWith: MAINTENANCE_CONTROLS_PREFIX } },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { note: true },
      },
    },
  })

  for (const job of jobs) {
    const parsed = parseMaintenanceControlsNote(job.jobNotes[0]?.note)
    const value = parsed?.[field]
    if (value) return value
  }

  return ''
}

export async function getPreviousMaintenanceNextVisitNote(customerId: number, currentJobId: number) {
  return getPreviousMaintenanceField(customerId, currentJobId, 'nextVisitNote')
}

export async function getMaintenancePropertyMemory(customerId: number, currentJobId: number) {
  return getPreviousMaintenanceField(customerId, currentJobId, 'propertyMemory')
}

export async function getMaintenancePhotoHistory(customerId: number, currentJobId: number) {
  return prisma.jobPhoto.findMany({
    where: {
      job: {
        customerId,
        jobType: { equals: 'Maintenance', mode: 'insensitive' },
      },
      jobId: { not: currentJobId },
    },
    orderBy: { createdAt: 'desc' },
    take: 12,
    select: {
      id: true,
      imageUrl: true,
      label: true,
      createdAt: true,
      jobId: true,
    },
  })
}

export async function getMaintenanceOfficeOverview() {
  const jobs = await prisma.job.findMany({
    where: { jobType: { equals: 'Maintenance', mode: 'insensitive' } },
    orderBy: { createdAt: 'desc' },
    take: 250,
    select: {
      id: true,
      customerId: true,
      address: true,
      visitDate: true,
      customer: { select: { name: true, postcode: true } },
      jobNotes: {
        where: { note: { startsWith: MAINTENANCE_CONTROLS_PREFIX } },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { note: true },
      },
    },
  })

  const opportunities: MaintenanceOpportunityRow[] = []
  const incomplete: MaintenanceIncompleteRow[] = []

  for (const job of jobs) {
    const controls = parseMaintenanceControlsNote(job.jobNotes[0]?.note)
    if (!controls) continue

    for (const item of controls.extraWork) {
      opportunities.push({
        ...item,
        jobId: job.id,
        customerId: job.customerId,
        customerName: job.customer.name,
        address: job.address,
        postcode: job.customer.postcode || '',
        visitDate: job.visitDate,
      })
    }

    if (controls.outcome === 'could_not_complete') {
      incomplete.push({
        jobId: job.id,
        customerName: job.customer.name,
        visitDate: job.visitDate,
        reason: controls.completionReason,
        note: controls.completionNote,
        completedAt: controls.completedAt,
      })
    }
  }

  opportunities.sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime())
  incomplete.sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime())

  return { opportunities, incomplete }
}

export async function saveMaintenanceControls(
  jobId: number,
  input: Partial<Pick<MaintenanceControls, 'propertyMemory' | 'nextVisitNote' | 'extraWork' | 'outcome' | 'completionReason' | 'completionNote' | 'completedAt'>>,
  createdByWorkerId?: number | null
) {
  const current = await getMaintenanceControls(jobId)
  const next: MaintenanceControls = {
    version: 3,
    jobId,
    updatedAt: new Date().toISOString(),
    propertyMemory: input.propertyMemory === undefined ? current.propertyMemory : cleanText(input.propertyMemory),
    nextVisitNote: input.nextVisitNote === undefined ? current.nextVisitNote : cleanText(input.nextVisitNote),
    extraWork: input.extraWork === undefined ? current.extraWork : normaliseExtraWork(input.extraWork),
    outcome: input.outcome === undefined
      ? current.outcome
      : input.outcome === 'completed' || input.outcome === 'could_not_complete'
        ? input.outcome
        : '',
    completionReason: input.completionReason === undefined ? current.completionReason : cleanCompletionReason(input.completionReason),
    completionNote: input.completionNote === undefined ? current.completionNote : cleanText(input.completionNote),
    completedAt: input.completedAt === undefined ? current.completedAt : cleanText(input.completedAt),
  }

  await prisma.jobNote.create({
    data: {
      jobId,
      note: `${MAINTENANCE_CONTROLS_PREFIX}${JSON.stringify(next)}`,
      createdByWorkerId: createdByWorkerId || null,
    },
  })

  return next
}
