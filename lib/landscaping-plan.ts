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
  checkpoint: string
}

type MaterialItem = {
  item: string
  quantity: string
  orderFor: string
  estimatedCostExVat: number
  note: string
}

export type LandscapingPlan = {
  version: 1
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
  commercialNotes: string[]
}

export type InstallWindow = {
  startDate: string | null
  endDate: string | null
  workerIds: number[]
  workerNames: string[]
  explanation: string
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

function parsePlanNote(note: string | null | undefined): LandscapingPlan | null {
  if (!note || !note.startsWith(LANDSCAPING_PLAN_PREFIX)) return null
  try {
    return JSON.parse(note.slice(LANDSCAPING_PLAN_PREFIX.length)) as LandscapingPlan
  } catch {
    return null
  }
}

export async function getLatestLandscapingPlan(jobId: number) {
  const notes = await prisma.jobNote.findMany({
    where: {
      jobId,
      note: { startsWith: LANDSCAPING_PLAN_PREFIX },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
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

    const finalHalfDay = index === requiredEntries - 1 && totalDays % 1 !== 0

    result.push({
      day: index + 1,
      heading: cleanText(raw.heading) || (finalHalfDay ? 'Finish, snag and handover' : `Installation day ${index + 1}`),
      target: cleanText(raw.target) || (finalHalfDay ? 'Finish the remaining work, snag, clean down and leave the site ready for handover.' : 'Progress the installation safely and leave the job ready for the next stage.'),
      tasks: Array.isArray(raw.tasks)
        ? raw.tasks.map(cleanText).filter(Boolean).slice(0, 8)
        : [],
      checkpoint: cleanText(raw.checkpoint) || 'Photograph progress and flag anything that changes the agreed scope or programme.',
    })
  }

  return result
}

function normaliseMaterials(value: unknown): MaterialItem[] {
  if (!Array.isArray(value)) return []

  return value
    .slice(0, 30)
    .map((raw) => {
      const item = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
      return {
        item: cleanText(item.item),
        quantity: cleanText(item.quantity) || 'TBC before order',
        orderFor: cleanText(item.orderFor) || 'Before job starts',
        estimatedCostExVat: moneyNumber(item.estimatedCostExVat),
        note: cleanText(item.note),
      }
    })
    .filter((item) => item.item)
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

  const totalDays = Math.max(
    1,
    cleanNumber(quote.estimatedDays, job.durationMinutes ? job.durationMinutes / INSTALL_DAY_MINUTES : 1)
  )
  const teamSize = Math.max(1, Math.round(cleanNumber(quote.estimatedTeamSize, 2)))
  const labourExVat = moneyNumber(totalDays * teamSize * FIELD_LABOUR_COST_PER_PERSON_DAY)

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured.')
  const openai = new OpenAI({ apiKey })

  const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    instructions: `You are CHAS creating an INTERNAL landscaping job pack for Furlads after a customer has accepted a quotation. This is not customer wording. Build a practical plan for UK/Shropshire landscaping crews. Do not change the accepted selling price or the approved total duration. The worker day plan must be achievable by humans, safe, practical and sequenced logically. Materials must be items that should genuinely be ordered for the accepted scope. If a quantity cannot be known from the scope, write TBC before order rather than inventing false precision. Include sensible waste/plant/consumable cost allowances for internal profitability planning, but clearly treat them as projected allowances to verify before ordering. Do not include selling prices in the worker wording. Return JSON only.`,
    input: `Accepted landscaping job\nCustomer: ${job.customer.name}\nPostcode: ${job.customer.postcode || ''}\nScope: ${quote.scope}\nInternal quote notes: ${quote.internalNotes || ''}\nCHAS quote working: ${quote.quoteWorking || ''}\nAccepted selling price ex VAT: £${quote.priceExVat.toFixed(2)}\nApproved install allowance: ${totalDays} working days\nRecommended team size: ${teamSize}\n\nReturn this exact JSON shape:\n{\n  "workerSummary": "short plain-English brief for the lads",\n  "dayPlan": [{"day":1,"heading":"","target":"","tasks":[""],"checkpoint":""}],\n  "materials": [{"item":"","quantity":"","orderFor":"Before job starts","estimatedCostExVat":0,"note":""}],\n  "plantTools": [""],\n  "siteChecks": [""],\n  "risks": [""],\n  "plantWasteCostExVat": 0,\n  "otherCostExVat": 0,\n  "commercialNotes": ["Internal assumptions or things Kelly/Trev must verify before order"]\n}\n\nThe dayPlan must contain ${Math.ceil(totalDays)} entries, with the final entry described as a half-day finish if the approved duration ends in .5.`,
  })

  const parsed = extractJson(response.output_text || '') as Record<string, unknown>
  const materials = normaliseMaterials(parsed.materials)
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
    version: 1,
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
    commercialNotes: [
      `Labour uses a provisional internal planning allowance of £${FIELD_LABOUR_COST_PER_PERSON_DAY} per person-day.`,
      'Material, plant and waste costs are projected planning allowances and must be checked against supplier/order costs before relying on final margin.',
      ...(Array.isArray(parsed.commercialNotes) ? parsed.commercialNotes.map(cleanText).filter(Boolean).slice(0, 12) : []),
    ],
  }

  await prisma.jobNote.create({
    data: {
      jobId: job.id,
      note: `${LANDSCAPING_PLAN_PREFIX}${JSON.stringify(plan)}`,
    },
  })

  return plan
}
