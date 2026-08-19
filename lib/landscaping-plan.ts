import OpenAI from 'openai'
import prisma from '@/lib/prisma'

export const LANDSCAPING_PLAN_PREFIX = 'LANDSCAPING_PLAN_JSON:'
const FIELD_LABOUR_COST_PER_PERSON_DAY = 225
const INSTALL_DAY_MINUTES = 450

type DayPlan = {
  day: number
  heading: string
  target: string
  tasks: string[]
  ifAhead: string[]
  checkpoint: string
}

type MaterialItem = {
  item: string
  quantity: string
  neededQuantity: string
  orderQuantity: string
  orderFor: string
  estimatedCostExVat: number
  actualCostExVat: number | null
  note: string
}

type ActualCosts = {
  labourExVat: number | null
  plantWasteExVat: number | null
  otherExVat: number | null
  updatedAt: string | null
}

export type LandscapingPlan = {
  version: 1 | 2
  generatedAt: string
  jobId: number
  quoteId: number
  scope: string
  totalDays: number
  teamSize: number
  workerSummary: string
  dayPlan: DayPlan[]
  materials: MaterialItem[]
  plantTools: string[]
  siteChecks: string[]
  risks: string[]
  projectedCosts: {
    labourExVat: number
    materialsExVat: number
    plantWasteExVat: number
    otherExVat: number
    totalCostExVat: number
    sellingPriceExVat: number
    projectedGrossProfitExVat: number
    projectedGrossProfitPercent: number
  }
  actualCosts: ActualCosts
  commercialNotes: string[]
}

export type InstallWindow = {
  startDate: string | null
  endDate: string | null
  workerIds: number[]
  workerNames: string[]
  explanation: string
}

export type LandscapingActualCostUpdate = {
  materialProjectedCosts?: Array<number | null>
  materialActualCosts?: Array<number | null>
  labourExVat?: number | null
  plantWasteExVat?: number | null
  otherExVat?: number | null
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function cleanNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function moneyNumber(value: unknown) {
  return Number(cleanNumber(value).toFixed(2))
}

function optionalMoney(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Number(parsed.toFixed(2))
}

function roundTo(value: number, decimals = 2) {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function roundDown(value: number, increment: number) {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.floor((value + 1e-9) / increment) * increment
}

function extractJson(value: string) {
  const text = value.trim()
  try {
    return JSON.parse(text)
  } catch {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start < 0 || end <= start) throw new Error('Planner did not return valid JSON.')
    return JSON.parse(text.slice(start, end + 1))
  }
}

function extractAreaM2(scope: string) {
  const rectangle = scope.match(/(\d+(?:\.\d+)?)\s*(?:m)?\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:m)?/i)
  if (rectangle) {
    const length = Number(rectangle[1])
    const width = Number(rectangle[2])
    if (Number.isFinite(length) && Number.isFinite(width) && length > 0 && width > 0) {
      return roundTo(length * width, 2)
    }
  }

  const area = scope.match(/(\d+(?:\.\d+)?)\s*(?:m2|m²|sqm)/i)
  if (!area) return 0
  const parsed = Number(area[1])
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function extractGravelAreaM2(scope: string) {
  const explicit = scope.match(/gravel[^.]{0,160}?(\d+(?:\.\d+)?)\s*(?:m2|m²|sqm)/i)
  if (explicit) {
    const parsed = Number(explicit[1])
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }

  const dimensions = scope.match(/(\d+(?:\.\d+)?)\s*(?:m)?\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:m)?/i)
  const width = scope.match(/(?:gravel|strip)[^.]{0,120}?(\d+(?:\.\d+)?)\s*mm/i)
  if (!dimensions || !width) return 0

  const length = Number(dimensions[1])
  const patioWidth = Number(dimensions[2])
  const borderWidthM = Number(width[1]) / 1000
  if (![length, patioWidth, borderWidthM].every((value) => Number.isFinite(value) && value > 0)) return 0

  return roundTo(2 * (length + patioWidth) * borderWidthM, 2)
}

function isStandardPatioScope(scope: string) {
  const text = scope.toLowerCase()
  return (
    text.includes('patio') ||
    text.includes('raj green') ||
    text.includes('indian sandstone') ||
    text.includes('indian stone') ||
    text.includes('porcelain')
  )
}

function isWeekend(date: Date) {
  const day = date.getDay()
  return day === 0 || day === 6
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function nextWeekday(date: Date) {
  let next = startOfDay(date)
  while (isWeekend(next)) next = addDays(next, 1)
  return next
}

function addWorkingDays(start: Date, count: number) {
  const dates: Date[] = []
  let cursor = nextWeekday(start)
  while (dates.length < count) {
    if (!isWeekend(cursor)) dates.push(new Date(cursor))
    cursor = addDays(cursor, 1)
  }
  return dates
}

function dateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function normaliseStoredPlan(value: unknown): LandscapingPlan | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, any>
  if (!Number.isFinite(Number(raw.jobId)) || !Array.isArray(raw.materials)) return null

  const materials: MaterialItem[] = raw.materials.map((material: any) => {
    const legacyQuantity = cleanText(material?.quantity) || 'Confirm before order'
    const neededQuantity = cleanText(material?.neededQuantity) || legacyQuantity
    const orderQuantity = cleanText(material?.orderQuantity) || neededQuantity

    return {
      item: cleanText(material?.item),
      quantity: neededQuantity,
      neededQuantity,
      orderQuantity,
      orderFor: cleanText(material?.orderFor) || 'Before job starts',
      estimatedCostExVat: moneyNumber(material?.estimatedCostExVat),
      actualCostExVat: optionalMoney(material?.actualCostExVat),
      note: cleanText(material?.note),
    }
  })

  const dayPlan: DayPlan[] = Array.isArray(raw.dayPlan)
    ? raw.dayPlan.map((day: any, index: number) => ({
        day: Number(day?.day) || index + 1,
        heading: cleanText(day?.heading) || `Installation day ${index + 1}`,
        target: cleanText(day?.target),
        tasks: Array.isArray(day?.tasks) ? day.tasks.map(cleanText).filter(Boolean) : [],
        ifAhead: Array.isArray(day?.ifAhead) ? day.ifAhead.map(cleanText).filter(Boolean) : [],
        checkpoint: cleanText(day?.checkpoint) || 'Photograph progress and flag anything that changes the agreed scope or programme.',
      }))
    : []

  return {
    ...(raw as LandscapingPlan),
    version: raw.version === 2 ? 2 : 1,
    materials,
    dayPlan,
    actualCosts: {
      labourExVat: optionalMoney(raw.actualCosts?.labourExVat),
      plantWasteExVat: optionalMoney(raw.actualCosts?.plantWasteExVat),
      otherExVat: optionalMoney(raw.actualCosts?.otherExVat),
      updatedAt: cleanText(raw.actualCosts?.updatedAt) || null,
    },
  }
}

function parsePlanNote(note: string | null | undefined): LandscapingPlan | null {
  if (!note || !note.startsWith(LANDSCAPING_PLAN_PREFIX)) return null
  try {
    return normaliseStoredPlan(JSON.parse(note.slice(LANDSCAPING_PLAN_PREFIX.length)))
  } catch {
    return null
  }
}

async function savePlanVersion(plan: LandscapingPlan) {
  await prisma.jobNote.create({
    data: {
      jobId: plan.jobId,
      note: `${LANDSCAPING_PLAN_PREFIX}${JSON.stringify(plan)}`,
    },
  })
}

export async function getLatestLandscapingPlan(jobId: number) {
  const notes = await prisma.jobNote.findMany({
    where: {
      jobId,
      note: { startsWith: LANDSCAPING_PLAN_PREFIX },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { note: true, createdAt: true },
  })

  for (const note of notes) {
    const parsed = parsePlanNote(note.note)
    if (parsed) return parsed
  }

  return null
}

function normaliseDayPlan(value: unknown, totalDays: number): DayPlan[] {
  const requiredEntries = Math.max(1, Math.ceil(totalDays))
  const input = Array.isArray(value) ? value : []
  const result: DayPlan[] = []

  for (let index = 0; index < requiredEntries; index += 1) {
    const raw = input[index] && typeof input[index] === 'object'
      ? (input[index] as Record<string, unknown>)
      : {}
    const nextRaw = input[index + 1] && typeof input[index + 1] === 'object'
      ? (input[index + 1] as Record<string, unknown>)
      : {}

    const finalHalfDay = index === requiredEntries - 1 && totalDays % 1 !== 0
    const nextTasks = Array.isArray(nextRaw.tasks)
      ? nextRaw.tasks.map(cleanText).filter(Boolean).slice(0, 3)
      : []
    const suppliedIfAhead = Array.isArray(raw.ifAhead)
      ? raw.ifAhead.map(cleanText).filter(Boolean).slice(0, 5)
      : []

    const ifAhead = suppliedIfAhead.length
      ? suppliedIfAhead
      : nextTasks.length
        ? nextTasks
        : [
            finalHalfDay
              ? 'Bring forward final snagging, clean-down, waste loading and completion photos if the installation is ahead of programme.'
              : 'If the planned work is finished early, bring forward safe preparation or installation tasks from the next day rather than stopping early.',
          ]

    result.push({
      day: index + 1,
      heading: cleanText(raw.heading) || (finalHalfDay ? 'Finish, snag and handover' : `Installation day ${index + 1}`),
      target: cleanText(raw.target) || (finalHalfDay ? 'Finish the remaining work, snag, clean down and leave the site ready for handover.' : 'Progress the installation safely and leave the job ready for the next stage.'),
      tasks: Array.isArray(raw.tasks)
        ? raw.tasks.map(cleanText).filter(Boolean).slice(0, 8)
        : [],
      ifAhead,
      checkpoint: cleanText(raw.checkpoint) || 'Photograph progress and flag anything that changes the agreed scope or programme.',
    })
  }

  return result
}

function normaliseMaterials(value: unknown, previousMaterials: MaterialItem[] = []): MaterialItem[] {
  if (!Array.isArray(value)) return []

  return value
    .slice(0, 30)
    .map((raw) => {
      const item = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
      const itemName = cleanText(item.item)
      const previous = previousMaterials.find(
        (material) => material.item.trim().toLowerCase() === itemName.trim().toLowerCase()
      )
      const neededQuantity = cleanText(item.neededQuantity) || cleanText(item.quantity) || 'Confirm before order'
      const orderQuantity = cleanText(item.orderQuantity) || neededQuantity

      return {
        item: itemName,
        quantity: neededQuantity,
        neededQuantity,
        orderQuantity,
        orderFor: cleanText(item.orderFor) || 'Before job starts',
        estimatedCostExVat: moneyNumber(item.estimatedCostExVat),
        actualCostExVat: previous?.actualCostExVat ?? null,
        note: cleanText(item.note),
      }
    })
    .filter((item) => item.item)
}

function applyFurladsMaterialRules(materials: MaterialItem[], scope: string) {
  if (!isStandardPatioScope(scope)) return materials

  const areaM2 = extractAreaM2(scope)
  if (areaM2 <= 0) return materials

  const gravelAreaM2 = extractGravelAreaM2(scope)

  return materials.map((material) => {
    const name = material.item.toLowerCase()

    if (
      name.includes('mot') ||
      name.includes('type 1') ||
      name.includes('type1') ||
      name.includes('sub-base') ||
      name.includes('sub base')
    ) {
      const compactedDepthM = 0.1
      const densityTonnesPerM3 = 2
      const volumeM3 = roundTo(areaM2 * compactedDepthM, 2)
      const tonnesNeeded = roundTo(volumeM3 * densityTonnesPerM3, 1)
      const tonnesToOrder = Math.max(0.5, roundDown(tonnesNeeded * 0.9, 0.5))

      return {
        ...material,
        quantity: `${volumeM3.toFixed(1)} m³ compacted / approx ${tonnesNeeded.toFixed(1)}t needed`,
        neededQuantity: `${volumeM3.toFixed(1)} m³ compacted / approx ${tonnesNeeded.toFixed(1)}t needed`,
        orderQuantity: `${tonnesToOrder.toFixed(1)}t Type 1 — use existing Furlads stock for the balance`,
        note: `Furlads planning assumption: 100mm compacted Type 1 at approx 2.0t/m³. Order quantity is deliberately rounded down to allow usable stock left from previous jobs. ${material.note}`.trim(),
      }
    }

    if (
      name.includes('raj green') ||
      name.includes('sandstone paving') ||
      name.includes('indian sandstone') ||
      name.includes('porcelain') ||
      name.includes('paving slabs')
    ) {
      const requirementM2 = roundTo(areaM2 * 1.05, 1)
      const orderM2 = Math.max(areaM2, roundDown(requirementM2, 0.5))

      return {
        ...material,
        quantity: `${areaM2.toFixed(1)}m² finished area; approx ${requirementM2.toFixed(1)}m² needed incl. 5% cuts/waste`,
        neededQuantity: `${areaM2.toFixed(1)}m² finished area; approx ${requirementM2.toFixed(1)}m² needed incl. 5% cuts/waste`,
        orderQuantity: `${orderM2.toFixed(1)}m² maximum new order — check/use matching stock for cuts and spares`,
        note: `Keep the projected cost allowance based on the full requirement; the smaller order-now figure assumes usable matching stock may already be available. ${material.note}`.trim(),
      }
    }

    if (name.includes('membrane') || name.includes('geotextile')) {
      const neededM2 = roundTo(areaM2 * 1.05, 1)
      const orderM2 = Math.max(areaM2, roundDown(neededM2 * 0.95, 1))

      return {
        ...material,
        quantity: `Approx ${neededM2.toFixed(1)}m² needed including sensible overlaps`,
        neededQuantity: `Approx ${neededM2.toFixed(1)}m² needed including sensible overlaps`,
        orderQuantity: `Approx ${orderM2.toFixed(0)}m² new membrane — top up overlaps from existing stock`,
        note: `Do not add oversized perimeter overlap allowances. Allow roughly 5% for sensible joints/overlap unless the site needs more. ${material.note}`.trim(),
      }
    }

    if (
      name.includes('sharp sand') ||
      name.includes('bedding sand') ||
      name.includes('mortar bed')
    ) {
      const mortarDepthM = 0.04
      const mortarVolumeM3 = roundTo(areaM2 * mortarDepthM, 2)
      const sharpSandTonnes = roundTo(mortarVolumeM3 * 1.65, 1)
      const orderTonnes = Math.max(0.5, roundDown(sharpSandTonnes * 0.9, 0.5))

      return {
        ...material,
        quantity: `${mortarVolumeM3.toFixed(1)}m³ full mortar-bed allowance / approx ${sharpSandTonnes.toFixed(1)}t sharp sand equivalent`,
        neededQuantity: `${mortarVolumeM3.toFixed(1)}m³ full mortar-bed allowance / approx ${sharpSandTonnes.toFixed(1)}t sharp sand equivalent`,
        orderQuantity: `${orderTonnes.toFixed(1)}t sharp sand equivalent — use existing stock for the balance`,
        note: `Furlads planning assumption: roughly 40mm full bed for standard natural-stone patio work unless the accepted specification says otherwise. ${material.note}`.trim(),
      }
    }

    if (
      gravelAreaM2 > 0 &&
      (name.includes('black-ice') || name.includes('black ice') || name.includes('decorative gravel'))
    ) {
      const depthM = 0.04
      const density = 1.6
      const volumeM3 = roundTo(gravelAreaM2 * depthM, 3)
      const tonnesNeeded = roundTo(volumeM3 * density, 2)
      const tonnesToOrder = Math.max(0.05, roundDown(tonnesNeeded * 0.9, 0.05))

      return {
        ...material,
        quantity: `${gravelAreaM2.toFixed(2)}m² at approx 40mm deep = ${volumeM3.toFixed(2)}m³ / approx ${tonnesNeeded.toFixed(2)}t needed`,
        neededQuantity: `${gravelAreaM2.toFixed(2)}m² at approx 40mm deep = ${volumeM3.toFixed(2)}m³ / approx ${tonnesNeeded.toFixed(2)}t needed`,
        orderQuantity: `${tonnesToOrder.toFixed(2)}t new decorative gravel — use matching stock for the balance`,
        note: `Order-now quantity is deliberately rounded down; keep the projected cost allowance unchanged until the supplier invoice is entered. ${material.note}`.trim(),
      }
    }

    return material
  })
}

function hasUsefulMeasurements(value: string) {
  return /\d+(?:\.\d+)?\s*(?:m|m2|m²|sqm|x|×)/i.test(value)
}

function hasTooManyTbcMaterials(materials: MaterialItem[]) {
  if (!materials.length) return false
  const tbcCount = materials.filter(
    (material) => /\bTBC\b/i.test(material.neededQuantity) || /\bTBC\b/i.test(material.orderQuantity)
  ).length
  return tbcCount > Math.max(1, Math.floor(materials.length * 0.25))
}

export async function saveLandscapingActualCosts(
  jobId: number,
  update: LandscapingActualCostUpdate
) {
  const current = await getLatestLandscapingPlan(jobId)
  if (!current) throw new Error('Generate the landscaping pack before entering costs.')

  const materialProjectedCosts = Array.isArray(update.materialProjectedCosts)
    ? update.materialProjectedCosts
    : []
  const materialActualCosts = Array.isArray(update.materialActualCosts)
    ? update.materialActualCosts
    : []

  const materials = current.materials.map((material, index) => ({
    ...material,
    estimatedCostExVat:
      index < materialProjectedCosts.length && optionalMoney(materialProjectedCosts[index]) != null
        ? optionalMoney(materialProjectedCosts[index]) as number
        : material.estimatedCostExVat,
    actualCostExVat:
      index < materialActualCosts.length
        ? optionalMoney(materialActualCosts[index])
        : material.actualCostExVat,
  }))

  const materialsExVat = moneyNumber(
    materials.reduce((sum, material) => sum + material.estimatedCostExVat, 0)
  )
  const totalCostExVat = moneyNumber(
    current.projectedCosts.labourExVat +
      materialsExVat +
      current.projectedCosts.plantWasteExVat +
      current.projectedCosts.otherExVat
  )
  const projectedGrossProfitExVat = moneyNumber(
    current.projectedCosts.sellingPriceExVat - totalCostExVat
  )
  const projectedGrossProfitPercent = current.projectedCosts.sellingPriceExVat > 0
    ? moneyNumber((projectedGrossProfitExVat / current.projectedCosts.sellingPriceExVat) * 100)
    : 0

  const updated: LandscapingPlan = {
    ...current,
    version: 2,
    materials,
    projectedCosts: {
      ...current.projectedCosts,
      materialsExVat,
      totalCostExVat,
      projectedGrossProfitExVat,
      projectedGrossProfitPercent,
    },
    actualCosts: {
      labourExVat: optionalMoney(update.labourExVat),
      plantWasteExVat: optionalMoney(update.plantWasteExVat),
      otherExVat: optionalMoney(update.otherExVat),
      updatedAt: new Date().toISOString(),
    },
  }

  await savePlanVersion(updated)
  return updated
}

export async function findNextAvailableInstallWindow(params: {
  jobId: number
  totalDays: number
  teamSize: number
}): Promise<InstallWindow> {
  const daysNeeded = Math.max(1, Math.ceil(params.totalDays))
  const teamSize = Math.max(1, params.teamSize)
  const today = startOfDay(new Date())
  const searchStart = nextWeekday(addDays(today, 1))
  const searchEnd = addDays(searchStart, 120)

  const allWorkers = await prisma.worker.findMany({
    where: { active: true },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      accessLevel: true,
      jobTitle: true,
    },
  })

  const workers = allWorkers.filter((worker) => {
    const text = `${worker.firstName} ${worker.lastName} ${worker.accessLevel} ${worker.jobTitle}`.toLowerCase()
    return !text.includes('kelly') && !text.includes('office') && !text.includes('admin')
  })

  if (workers.length < teamSize) {
    return {
      startDate: null,
      endDate: null,
      workerIds: [],
      workerNames: [],
      explanation: `Only ${workers.length} active field worker(s) are available in the worker records, but this job needs ${teamSize}.`,
    }
  }

  const workerIds = workers.map((worker) => worker.id)

  const [jobs, blocks] = await Promise.all([
    prisma.job.findMany({
      where: {
        id: { not: params.jobId },
        visitDate: { gte: searchStart, lte: searchEnd },
        status: { notIn: ['done', 'completed', 'cancelled', 'archived'] },
        assignments: { some: { workerId: { in: workerIds } } },
      },
      select: {
        visitDate: true,
        durationMinutes: true,
        jobType: true,
        assignments: { select: { workerId: true } },
      },
    }),
    prisma.workerAvailabilityBlock.findMany({
      where: {
        active: true,
        workerId: { in: workerIds },
        startDate: { lte: searchEnd },
        endDate: { gte: searchStart },
      },
      select: {
        workerId: true,
        startDate: true,
        endDate: true,
      },
    }),
  ])

  const busyByDate = new Map<string, Set<number>>()
  const markBusy = (key: string, workerId: number) => {
    const current = busyByDate.get(key) || new Set<number>()
    current.add(workerId)
    busyByDate.set(key, current)
  }

  for (const job of jobs) {
    if (!job.visitDate) continue
    const isLandscaping = cleanText(job.jobType).toLowerCase().includes('land')
    const spanDays = isLandscaping
      ? Math.max(1, Math.ceil(cleanNumber(job.durationMinutes, INSTALL_DAY_MINUTES) / INSTALL_DAY_MINUTES))
      : 1
    const dates = addWorkingDays(job.visitDate, spanDays)
    for (const date of dates) {
      for (const assignment of job.assignments) markBusy(dateKey(date), assignment.workerId)
    }
  }

  for (const block of blocks) {
    let cursor = startOfDay(block.startDate)
    const end = startOfDay(block.endDate)
    while (cursor <= end) {
      if (!isWeekend(cursor)) markBusy(dateKey(cursor), block.workerId)
      cursor = addDays(cursor, 1)
    }
  }

  for (let offset = 0; offset <= 120; offset += 1) {
    const candidate = addDays(searchStart, offset)
    if (isWeekend(candidate)) continue

    const dates = addWorkingDays(candidate, daysNeeded)
    if (dates[dates.length - 1] > searchEnd) break

    let commonFreeIds = workerIds.slice()
    for (const date of dates) {
      const busy = busyByDate.get(dateKey(date)) || new Set<number>()
      commonFreeIds = commonFreeIds.filter((id) => !busy.has(id))
      if (commonFreeIds.length < teamSize) break
    }

    if (commonFreeIds.length >= teamSize) {
      const selectedIds = commonFreeIds.slice(0, teamSize)
      const selectedWorkers = workers.filter((worker) => selectedIds.includes(worker.id))
      return {
        startDate: dateKey(dates[0]),
        endDate: dateKey(dates[dates.length - 1]),
        workerIds: selectedIds,
        workerNames: selectedWorkers.map((worker) => `${worker.firstName} ${worker.lastName}`.trim()),
        explanation: `Earliest run of ${daysNeeded} working day(s) where the same ${teamSize} active field worker(s) are not already assigned or blocked off. Final booking should still account for deliveries, weather and transport.`,
      }
    }
  }

  return {
    startDate: null,
    endDate: null,
    workerIds: [],
    workerNames: [],
    explanation: 'No suitable continuous install window was found in the next 120 days.',
  }
}

export async function generateLandscapingPlan(jobId: number): Promise<LandscapingPlan> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      customer: true,
      quotes: { orderBy: [{ acceptedAt: 'desc' }, { updatedAt: 'desc' }] },
    },
  })

  if (!job) throw new Error('Job not found.')
  if (!cleanText(job.jobType).toLowerCase().includes('land')) {
    throw new Error('Landscaping plans are only generated for landscaping jobs.')
  }

  const quote = job.quotes[0]
  if (!quote) throw new Error('This landscaping job is not linked to a quote.')

  const previousPlan = await getLatestLandscapingPlan(jobId)
  const totalDays = Math.max(
    1,
    cleanNumber(quote.estimatedDays, job.durationMinutes ? job.durationMinutes / INSTALL_DAY_MINUTES : 1)
  )
  const teamSize = Math.max(1, Math.round(cleanNumber(quote.estimatedTeamSize, 2)))
  const labourExVat = moneyNumber(totalDays * teamSize * FIELD_LABOUR_COST_PER_PERSON_DAY)

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured.')
  const openai = new OpenAI({ apiKey })

  const instructions = `You are CHAS creating an INTERNAL landscaping job pack for Furlads after a customer has accepted a quotation. This is not customer wording. Build a practical plan for UK/Shropshire landscaping crews. Do not change the accepted selling price or the approved total duration. The worker day plan must be achievable by humans, safe, practical and sequenced logically.

MATERIAL PLANNING — IMPORTANT:
- Every material has TWO quantities: neededQuantity and orderQuantity.
- neededQuantity is the realistic total requirement for completing the job, including only sensible cuts/waste/overlap.
- orderQuantity is what Furlads should actually buy now.
- Furlads deliberately rounds orderQuantity DOWN because usable leftover stock from previous jobs can often cover the balance. Do not round orders up just to be safe.
- The projected cost must stay based on the full/conservative material requirement. Do NOT reduce estimatedCostExVat just because orderQuantity is rounded down.
- TBC is the exception, not the default. If measurements are supplied, calculate a useful provisional quantity and state the assumption.
- Do not create excessive contingency or waste allowances.

STANDARD FURLADS PATIO PLANNING ASSUMPTIONS UNLESS THE ACCEPTED SCOPE SAYS OTHERWISE:
- Type 1 sub-base: 100mm compacted, not 150mm. Use approx 2.0 tonnes per compacted m³ for planning. A 30m² patio is therefore about 3.0m³ / 6.0t needed — it must NOT become 9t.
- Natural-stone full mortar bed: plan around 40mm average bed, not an arbitrary 50mm.
- Paving: around 5% cuts/waste is normally enough for planning unless the layout genuinely needs more.
- Membrane: allow sensible joints/overlap, roughly 5%; do not add 300mm or 600mm around every outer edge unless the actual installation needs it.
- Decorative gravel: calculate from the accepted border area/width and use a sensible decorative depth, normally around 40mm unless specified otherwise.
- For fencing, calculate bays/posts/gravel boards from the accepted run length and specification where practical.

PROJECTED COSTS:
- estimatedCostExVat is an internal conservative allowance for the FULL requirement, not the deliberately smaller order-now quantity.
- Do not lowball supplier/material costs simply to make gross margin look good.
- Do not include the customer selling-price markup as a material cost; this is the expected Furlads purchase cost/allowance ex VAT.
- If you are genuinely uncertain, use a conservative plausible allowance and flag it for Kelly/Trev to edit before ordering.

DAY PLAN — IMPORTANT:
- Every day must include an ifAhead list.
- ifAhead tells the crew exactly what safe work can be brought forward from the NEXT day if today's target is completed early.
- Pull forward preparation, setting out, excavation, sub-base, cuts, material moves, edging, snagging or other logical next-stage tasks where dependencies allow.
- Do not tell the crew to stop early just because the day's target is complete.
- Do not bring forward work that depends on curing, missing deliveries, customer approval or another unsafe/unready dependency.
- On the final day, ifAhead should focus on snagging, cleaning, waste loading, photos and handover preparation.

Include sensible waste, plant and consumable cost allowances for internal profitability planning. Do not include selling prices in worker wording. Return JSON only.`

  const input = `Accepted landscaping job\nCustomer: ${job.customer.name}\nPostcode: ${job.customer.postcode || ''}\nScope: ${quote.scope}\nInternal quote notes: ${quote.internalNotes || ''}\nCHAS quote working: ${quote.quoteWorking || ''}\nAccepted selling price ex VAT: £${quote.priceExVat.toFixed(2)}\nApproved install allowance: ${totalDays} working days\nRecommended team size: ${teamSize}\n\nReturn this exact JSON shape:\n{\n  "workerSummary": "short plain-English brief for the lads",\n  "dayPlan": [{"day":1,"heading":"","target":"","tasks":[""],"ifAhead":["safe task to bring forward from next day"],"checkpoint":""}],\n  "materials": [{"item":"","neededQuantity":"realistic total job requirement","orderQuantity":"smaller practical order-now amount, rounded down where sensible","orderFor":"Before job starts","estimatedCostExVat":0,"note":"calculation/assumption and anything to verify"}],\n  "plantTools": [""],\n  "siteChecks": [""],\n  "risks": [""],\n  "plantWasteCostExVat": 0,\n  "otherCostExVat": 0,\n  "commercialNotes": ["Internal assumptions or things Kelly/Trev must verify before order"]\n}\n\nThe dayPlan must contain ${Math.ceil(totalDays)} entries, with the final entry described as a half-day finish if the approved duration ends in .5.`

  let response = await openai.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    instructions,
    input,
  })

  let parsed = extractJson(response.output_text || '') as Record<string, unknown>
  let materials = normaliseMaterials(parsed.materials, previousPlan?.materials || [])

  if (hasUsefulMeasurements(quote.scope) && hasTooManyTbcMaterials(materials)) {
    response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      instructions: `${instructions}\n\nQUALITY CORRECTION: The first material list used too many TBC quantities even though measurements are available. Recalculate neededQuantity and orderQuantity. Use practical provisional quantities with clearly stated assumptions. Keep TBC only where a quantity genuinely cannot be derived.`,
      input,
    })
    parsed = extractJson(response.output_text || '') as Record<string, unknown>
    materials = normaliseMaterials(parsed.materials, previousPlan?.materials || [])
  }

  materials = applyFurladsMaterialRules(materials, quote.scope)

  const materialsExVat = moneyNumber(materials.reduce((sum, item) => sum + item.estimatedCostExVat, 0))
  const plantWasteExVat = moneyNumber(parsed.plantWasteCostExVat)
  const otherExVat = moneyNumber(parsed.otherCostExVat)
  const totalCostExVat = moneyNumber(labourExVat + materialsExVat + plantWasteExVat + otherExVat)
  const sellingPriceExVat = moneyNumber(quote.priceExVat)
  const projectedGrossProfitExVat = moneyNumber(sellingPriceExVat - totalCostExVat)
  const projectedGrossProfitPercent = sellingPriceExVat > 0
    ? moneyNumber((projectedGrossProfitExVat / sellingPriceExVat) * 100)
    : 0

  const plan: LandscapingPlan = {
    version: 2,
    generatedAt: new Date().toISOString(),
    jobId: job.id,
    quoteId: quote.id,
    scope: quote.scope,
    totalDays,
    teamSize,
    workerSummary: cleanText(parsed.workerSummary) || quote.scope,
    dayPlan: normaliseDayPlan(parsed.dayPlan, totalDays),
    materials,
    plantTools: Array.isArray(parsed.plantTools) ? parsed.plantTools.map(cleanText).filter(Boolean).slice(0, 20) : [],
    siteChecks: Array.isArray(parsed.siteChecks) ? parsed.siteChecks.map(cleanText).filter(Boolean).slice(0, 20) : [],
    risks: Array.isArray(parsed.risks) ? parsed.risks.map(cleanText).filter(Boolean).slice(0, 20) : [],
    projectedCosts: {
      labourExVat,
      materialsExVat,
      plantWasteExVat,
      otherExVat,
      totalCostExVat,
      sellingPriceExVat,
      projectedGrossProfitExVat,
      projectedGrossProfitPercent,
    },
    actualCosts: previousPlan?.actualCosts || {
      labourExVat: null,
      plantWasteExVat: null,
      otherExVat: null,
      updatedAt: null,
    },
    commercialNotes: [
      `Labour uses a provisional internal planning allowance of £${FIELD_LABOUR_COST_PER_PERSON_DAY} per person-day.`,
      'Order-now quantities are deliberately rounded down to allow for usable Furlads stock left from previous jobs; projected cost allowances remain based on the full requirement until edited or replaced by actual costs.',
      'Material, plant and waste costs remain editable planning allowances until supplier/order costs are confirmed.',
      ...(Array.isArray(parsed.commercialNotes) ? parsed.commercialNotes.map(cleanText).filter(Boolean).slice(0, 12) : []),
    ],
  }

  await savePlanVersion(plan)
  return plan
}
