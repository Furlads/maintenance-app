import prisma from '@/lib/prisma'

export const LANDSCAPING_CONTROLS_PREFIX = 'LANDSCAPING_CONTROLS_JSON:'

export type MaterialOrderStatus = 'not_ordered' | 'ordered' | 'delivered' | 'stock'
export type ExtraItemType = 'material' | 'tool'
export type ExtraItemStatus = 'needed' | 'bought' | 'on_site'
export type VariationStatus = 'pending' | 'agreed' | 'declined'
export type CustomerCompletionStatus = '' | 'happy' | 'issue' | 'not_available'

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

export type LandscapingSiteIssue = {
  id: string
  message: string
  reportedBy: string
  reportedAt: string
  resolved: boolean
}

export type LandscapingVariation = {
  id: string
  request: string
  requestedBy: string
  requestedAt: string
  status: VariationStatus
  agreedPriceExVat: number | null
  customerAgreed: boolean
  agreementNote: string
}

export type LandscapingCompletion = {
  qualityChecked: boolean
  workerSignedOff: boolean
  workerSignedOffAt: string
  customerStatus: CustomerCompletionStatus
  customerName: string
  customerSignedOffAt: string
  outstandingItems: string
  completedAt: string
}

export type LandscapingControls = {
  version: 4
  jobId: number
  updatedAt: string
  materials: Record<string, MaterialOrderTracking>
  customerExtras: string[]
  extraItems: LandscapingExtraItem[]
  siteIssues: LandscapingSiteIssue[]
  variations: LandscapingVariation[]
  completion: LandscapingCompletion
}

const EMPTY_COMPLETION: LandscapingCompletion = {
  qualityChecked: false,
  workerSignedOff: false,
  workerSignedOffAt: '',
  customerStatus: '',
  customerName: '',
  customerSignedOffAt: '',
  outstandingItems: '',
  completedAt: '',
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function cleanNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Number(parsed.toFixed(2))
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

function cleanVariationStatus(value: unknown): VariationStatus {
  const text = cleanText(value)
  if (text === 'agreed' || text === 'declined') return text
  return 'pending'
}

function cleanCustomerStatus(value: unknown): CustomerCompletionStatus {
  const text = cleanText(value)
  if (text === 'happy' || text === 'issue' || text === 'not_available') return text
  return ''
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
      const row = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {}
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

function normaliseSiteIssues(value: unknown): LandscapingSiteIssue[] {
  if (!Array.isArray(value)) return []
  return value
    .map((raw, index) => {
      const row = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {}
      const message = cleanText(row.message)
      if (!message) return null
      return {
        id: cleanText(row.id) || `issue-${Date.now()}-${index}`,
        message,
        reportedBy: cleanText(row.reportedBy) || 'Worker',
        reportedAt: cleanText(row.reportedAt) || new Date().toISOString(),
        resolved: Boolean(row.resolved),
      }
    })
    .filter((row): row is LandscapingSiteIssue => Boolean(row))
    .slice(0, 100)
}

function normaliseVariations(value: unknown): LandscapingVariation[] {
  if (!Array.isArray(value)) return []
  return value
    .map((raw, index) => {
      const row = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {}
      const request = cleanText(row.request)
      if (!request) return null
      return {
        id: cleanText(row.id) || `variation-${Date.now()}-${index}`,
        request,
        requestedBy: cleanText(row.requestedBy) || 'Worker',
        requestedAt: cleanText(row.requestedAt) || new Date().toISOString(),
        status: cleanVariationStatus(row.status),
        agreedPriceExVat: cleanNumber(row.agreedPriceExVat),
        customerAgreed: Boolean(row.customerAgreed),
        agreementNote: cleanText(row.agreementNote),
      }
    })
    .filter((row): row is LandscapingVariation => Boolean(row))
    .slice(0, 100)
}

function normaliseCompletion(value: unknown): LandscapingCompletion {
  const row = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}

  const legacyQualityChecked = Boolean(row.levelsFallsChecked) && Boolean(row.finishChecked) && Boolean(row.siteClean)
  const legacyWorkerSignedOff = Boolean(row.toolsMaterialsCollected) && Boolean(row.issueReportedIfNeeded)
  const legacyCustomerChecked = Boolean(row.customerChecked)

  return {
    qualityChecked: row.qualityChecked === undefined ? legacyQualityChecked : Boolean(row.qualityChecked),
    workerSignedOff: row.workerSignedOff === undefined ? legacyWorkerSignedOff : Boolean(row.workerSignedOff),
    workerSignedOffAt: cleanText(row.workerSignedOffAt),
    customerStatus: row.customerStatus === undefined && legacyCustomerChecked ? 'happy' : cleanCustomerStatus(row.customerStatus),
    customerName: cleanText(row.customerName),
    customerSignedOffAt: cleanText(row.customerSignedOffAt),
    outstandingItems: cleanText(row.outstandingItems),
    completedAt: cleanText(row.completedAt),
  }
}

function parseControls(note: string | null | undefined): LandscapingControls | null {
  if (!note || !note.startsWith(LANDSCAPING_CONTROLS_PREFIX)) return null
  try {
    const raw = JSON.parse(note.slice(LANDSCAPING_CONTROLS_PREFIX.length)) as Record<string, unknown>
    const jobId = Number(raw.jobId)
    if (!Number.isInteger(jobId) || jobId <= 0) return null
    return {
      version: 4,
      jobId,
      updatedAt: cleanText(raw.updatedAt),
      materials: normaliseMaterials(raw.materials),
      customerExtras: normaliseCustomerExtras(raw.customerExtras),
      extraItems: normaliseExtraItems(raw.extraItems),
      siteIssues: normaliseSiteIssues(raw.siteIssues),
      variations: normaliseVariations(raw.variations),
      completion: normaliseCompletion(raw.completion),
    }
  } catch {
    return null
  }
}

export async function getLatestLandscapingControls(jobId: number): Promise<LandscapingControls> {
  const notes = await prisma.jobNote.findMany({
    where: { jobId, note: { startsWith: LANDSCAPING_CONTROLS_PREFIX } },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { note: true },
  })

  for (const row of notes) {
    const parsed = parseControls(row.note)
    if (parsed) return parsed
  }

  return {
    version: 4,
    jobId,
    updatedAt: '',
    materials: {},
    customerExtras: [],
    extraItems: [],
    siteIssues: [],
    variations: [],
    completion: { ...EMPTY_COMPLETION },
  }
}

export async function saveLandscapingControls(
  jobId: number,
  input: {
    materials?: unknown
    customerExtras?: unknown
    extraItems?: unknown
    siteIssues?: unknown
    variations?: unknown
    completion?: unknown
  },
  createdByWorkerId?: number | null
) {
  const current = await getLatestLandscapingControls(jobId)
  const controls: LandscapingControls = {
    version: 4,
    jobId,
    updatedAt: new Date().toISOString(),
    materials: input.materials === undefined ? current.materials : normaliseMaterials(input.materials),
    customerExtras: input.customerExtras === undefined ? current.customerExtras : normaliseCustomerExtras(input.customerExtras),
    extraItems: input.extraItems === undefined ? current.extraItems : normaliseExtraItems(input.extraItems),
    siteIssues: input.siteIssues === undefined ? current.siteIssues : normaliseSiteIssues(input.siteIssues),
    variations: input.variations === undefined ? current.variations : normaliseVariations(input.variations),
    completion: input.completion === undefined ? current.completion : normaliseCompletion(input.completion),
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
