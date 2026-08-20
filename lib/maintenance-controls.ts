import prisma from '@/lib/prisma'

export const MAINTENANCE_CONTROLS_PREFIX = 'MAINTENANCE_CONTROLS_JSON:'

export type MaintenanceExtraWork = {
  id: string
  description: string
  reportedBy: string
  reportedAt: string
}

export type MaintenanceControls = {
  version: 1
  jobId: number
  updatedAt: string
  nextVisitNote: string
  extraWork: MaintenanceExtraWork[]
  outcome: '' | 'completed' | 'could_not_complete'
  completionNote: string
  completedAt: string
}

const EMPTY: Omit<MaintenanceControls, 'jobId'> = {
  version: 1,
  updatedAt: '',
  nextVisitNote: '',
  extraWork: [],
  outcome: '',
  completionNote: '',
  completedAt: '',
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
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
        reportedBy: cleanText(row.reportedBy) || 'Worker',
        reportedAt: cleanText(row.reportedAt) || new Date().toISOString(),
      }
    })
    .filter((row): row is MaintenanceExtraWork => Boolean(row))
    .slice(0, 50)
}

function parse(note: string | null | undefined): MaintenanceControls | null {
  if (!note || !note.startsWith(MAINTENANCE_CONTROLS_PREFIX)) return null
  try {
    const raw = JSON.parse(note.slice(MAINTENANCE_CONTROLS_PREFIX.length)) as Record<string, unknown>
    const jobId = Number(raw.jobId)
    if (!Number.isInteger(jobId) || jobId <= 0) return null
    const rawOutcome = cleanText(raw.outcome)
    const outcome = rawOutcome === 'completed' || rawOutcome === 'could_not_complete' ? rawOutcome : ''
    return {
      version: 1,
      jobId,
      updatedAt: cleanText(raw.updatedAt),
      nextVisitNote: cleanText(raw.nextVisitNote),
      extraWork: normaliseExtraWork(raw.extraWork),
      outcome,
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
    const parsed = parse(row.note)
    if (parsed) return parsed
  }

  return { ...EMPTY, jobId, extraWork: [] }
}

export async function getPreviousMaintenanceNextVisitNote(customerId: number, currentJobId: number) {
  const jobs = await prisma.job.findMany({
    where: {
      customerId,
      jobType: { equals: 'Maintenance', mode: 'insensitive' },
      id: { not: currentJobId },
    },
    orderBy: [{ visitDate: 'desc' }, { createdAt: 'desc' }],
    take: 12,
    select: {
      id: true,
      jobNotes: {
        where: { note: { startsWith: MAINTENANCE_CONTROLS_PREFIX } },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { note: true },
      },
    },
  })

  for (const job of jobs) {
    const parsed = parse(job.jobNotes[0]?.note)
    if (parsed?.nextVisitNote) return parsed.nextVisitNote
  }

  return ''
}

export async function saveMaintenanceControls(
  jobId: number,
  input: Partial<Pick<MaintenanceControls, 'nextVisitNote' | 'extraWork' | 'outcome' | 'completionNote' | 'completedAt'>>,
  createdByWorkerId?: number | null
) {
  const current = await getMaintenanceControls(jobId)
  const next: MaintenanceControls = {
    version: 1,
    jobId,
    updatedAt: new Date().toISOString(),
    nextVisitNote: input.nextVisitNote === undefined ? current.nextVisitNote : cleanText(input.nextVisitNote),
    extraWork: input.extraWork === undefined ? current.extraWork : normaliseExtraWork(input.extraWork),
    outcome: input.outcome === undefined
      ? current.outcome
      : input.outcome === 'completed' || input.outcome === 'could_not_complete'
        ? input.outcome
        : '',
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
