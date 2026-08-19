import prisma from '@/lib/prisma'

export const LANDSCAPING_CONTROLS_PREFIX = 'LANDSCAPING_CONTROLS_JSON:'

export type MaterialOrderStatus = 'not_ordered' | 'ordered' | 'delivered' | 'stock'
export type ExtraItemType = 'material' | 'tool'
export type ExtraItemStatus = 'needed' | 'bought' | 'on_site'

export type MaterialOrderTracking = {
  status: MaterialOrderStatus
  supplier: string
  deliveryDate: string
}

export type LandscapingExtraItem = {
  id: string
  type: ExtraItemType
  item: string
  quantity: string
  status: ExtraItemStatus
  note: string
}

export type LandscapingControls = {
  version: 2
  jobId: number
  updatedAt: string
  materials: Record<string, MaterialOrderTracking>
  customerExtras: string[]
  extraItems: LandscapingExtraItem[]
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function cleanStatus(value: unknown): MaterialOrderStatus {
  const text = cleanText(value)
  if (text === 'ordered' || text === 'delivered' || text === 'stock') return text
  return 'not_ordered'
}

function cleanExtraType(value: unknown): ExtraItemType {
  return cleanText(value) === 'tool' ? 'tool' : 'material'
}

function cleanExtraStatus(value: unknown): ExtraItemStatus {
  const text = cleanText(value)
  if (text === 'bought' || text === 'on_site') return text
  return 'needed'
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

function normaliseCustomerExtras(value: unknown) {
  if (!Array.isArray(value)) return [] as string[]
  return value.map(cleanText).filter(Boolean).slice(0, 30)
}

function normaliseExtraItems(value: unknown): LandscapingExtraItem[] {
  if (!Array.isArray(value)) return []

  return value
    .map((raw, index) => {
      const row = raw && typeof raw === 'object' && !Array.isArray(raw)
        ? raw as Record<string, unknown>
        : {}
      const item = cleanText(row.item)
      if (!item) return null

      return {
        id: cleanText(row.id) || `extra-${Date.now()}-${index}`,
        type: cleanExtraType(row.type),
        item,
        quantity: cleanText(row.quantity),
        status: cleanExtraStatus(row.status),
        note: cleanText(row.note),
      }
    })
    .filter((row): row is LandscapingExtraItem => Boolean(row))
    .slice(0, 50)
}

function parseControls(note: string | null | undefined): LandscapingControls | null {
  if (!note || !note.startsWith(LANDSCAPING_CONTROLS_PREFIX)) return null

  try {
    const raw = JSON.parse(note.slice(LANDSCAPING_CONTROLS_PREFIX.length)) as Record<string, unknown>
    const jobId = Number(raw.jobId)
    if (!Number.isInteger(jobId) || jobId <= 0) return null

    return {
      version: 2,
      jobId,
      updatedAt: cleanText(raw.updatedAt),
      materials: normaliseMaterials(raw.materials),
      customerExtras: normaliseCustomerExtras(raw.customerExtras),
      extraItems: normaliseExtraItems(raw.extraItems),
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
    version: 2,
    jobId,
    updatedAt: '',
    materials: {},
    customerExtras: [],
    extraItems: [],
  }
}

export async function saveLandscapingControls(
  jobId: number,
  input: {
    materials?: unknown
    customerExtras?: unknown
    extraItems?: unknown
  },
  createdByWorkerId?: number | null
) {
  const current = await getLatestLandscapingControls(jobId)

  const controls: LandscapingControls = {
    version: 2,
    jobId,
    updatedAt: new Date().toISOString(),
    materials: input.materials === undefined
      ? current.materials
      : normaliseMaterials(input.materials),
    customerExtras: input.customerExtras === undefined
      ? current.customerExtras
      : normaliseCustomerExtras(input.customerExtras),
    extraItems: input.extraItems === undefined
      ? current.extraItems
      : normaliseExtraItems(input.extraItems),
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
