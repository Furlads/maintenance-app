import prisma from '@/lib/prisma'

export const LANDSCAPING_CONTROLS_PREFIX = 'LANDSCAPING_CONTROLS_JSON:'

export type MaterialOrderStatus = 'not_ordered' | 'ordered' | 'delivered' | 'stock'

export type MaterialOrderTracking = {
  status: MaterialOrderStatus
  supplier: string
  deliveryDate: string
}

export type LandscapingControls = {
  version: 1
  jobId: number
  updatedAt: string
  materials: Record<string, MaterialOrderTracking>
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function cleanStatus(value: unknown): MaterialOrderStatus {
  const text = cleanText(value)
  if (text === 'ordered' || text === 'delivered' || text === 'stock') return text
  return 'not_ordered'
}

function normaliseMaterials(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {} as Record<string, MaterialOrderTracking>
  }

  const result: Record<string, MaterialOrderTracking> = {}

  for (const [item, raw] of Object.entries(value as Record<string, unknown>)) {
    const key = cleanText(item)
    if (!key || !raw || typeof raw !== 'object' || Array.isArray(raw)) continue

    const row = raw as Record<string, unknown>
    result[key] = {
      status: cleanStatus(row.status),
      supplier: cleanText(row.supplier),
      deliveryDate: cleanText(row.deliveryDate),
    }
  }

  return result
}

function parseControls(note: string | null | undefined): LandscapingControls | null {
  if (!note || !note.startsWith(LANDSCAPING_CONTROLS_PREFIX)) return null

  try {
    const raw = JSON.parse(note.slice(LANDSCAPING_CONTROLS_PREFIX.length)) as Record<string, unknown>
    const jobId = Number(raw.jobId)
    if (!Number.isInteger(jobId) || jobId <= 0) return null

    return {
      version: 1,
      jobId,
      updatedAt: cleanText(raw.updatedAt),
      materials: normaliseMaterials(raw.materials),
    }
  } catch {
    return null
  }
}

export async function getLatestLandscapingControls(jobId: number): Promise<LandscapingControls> {
  const notes = await prisma.jobNote.findMany({
    where: {
      jobId,
      note: { startsWith: LANDSCAPING_CONTROLS_PREFIX },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { note: true },
  })

  for (const row of notes) {
    const parsed = parseControls(row.note)
    if (parsed) return parsed
  }

  return {
    version: 1,
    jobId,
    updatedAt: '',
    materials: {},
  }
}

export async function saveLandscapingControls(
  jobId: number,
  materials: unknown,
  createdByWorkerId?: number | null
) {
  const controls: LandscapingControls = {
    version: 1,
    jobId,
    updatedAt: new Date().toISOString(),
    materials: normaliseMaterials(materials),
  }

  await prisma.jobNote.create({
    data: {
      jobId,
      note: `${LANDSCAPING_CONTROLS_PREFIX}${JSON.stringify(controls)}`,
      createdByWorkerId: createdByWorkerId || null,
    },
  })

  return controls
}
