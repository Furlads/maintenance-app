export type CrewCostingInput = {
  id: number
  slug: string
  name: string
  dayRate: number
  durationMultiplier: number
  skillLevel: string
  suitableJobTypes: string[]
  technicalSpecialist: boolean
  summary?: string | null
  members?: Array<{
    worker: {
      firstName: string
      lastName: string
      transportRequired: boolean
    }
  }>
}

export type CrewCostOption = {
  crewId: number
  slug: string
  name: string
  dayRate: number
  expectedDays: number
  totalLabourCost: number
  skillLevel: string
  suitability: 'Best fit' | 'Good fit' | 'Use with care'
  transportWarning: string | null
  summary: string
  recommended: boolean
  reason: string
}

const TECHNICAL_TERMS = [
  'porcelain',
  'drainage',
  'retaining',
  'finished level',
  'levels',
  'steps',
  'wall',
  'specialist',
  'technical',
  'finish-critical',
  'detailed finish',
  'complex',
]

const STANDARD_TERMS = [
  'landscaping',
  'groundworks',
  'groundwork',
  'fencing',
  'fence',
  'clearance',
  'excavation',
  'turf',
  'artificial grass',
  'sandstone',
  'patio preparation',
]

function roundUpHalfDay(value: number) {
  return Math.max(0.5, Math.ceil(value * 2) / 2)
}

function money(value: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(value)
}

export function compareCrewCosts({
  scope,
  internalNotes,
  estimatedDays,
  crews,
}: {
  scope: string
  internalNotes?: string | null
  estimatedDays?: number | null
  crews: CrewCostingInput[]
}) {
  const text = `${scope} ${internalNotes || ''}`.toLowerCase()
  const technical = TECHNICAL_TERMS.some((term) => text.includes(term))
  const standard = STANDARD_TERMS.some((term) => text.includes(term))
  const baseDays = estimatedDays && estimatedDays > 0 ? estimatedDays : 1

  const options: CrewCostOption[] = crews
    .map((crew) => {
      const expectedDays = roundUpHalfDay(baseDays * Math.max(0.25, crew.durationMultiplier || 1))
      const totalLabourCost = Number((expectedDays * crew.dayRate).toFixed(2))
      const suitableTypes = crew.suitableJobTypes.map((item) => item.toLowerCase())
      const standardMatch = standard && suitableTypes.some((item) =>
        STANDARD_TERMS.some((term) => item.includes(term) || term.includes(item))
      )
      const suitability: CrewCostOption['suitability'] = technical
        ? crew.technicalSpecialist ? 'Best fit' : 'Use with care'
        : standardMatch ? 'Best fit' : 'Good fit'
      const transportRequired = crew.members?.find((member) => member.worker.transportRequired)
      const transportWarning = transportRequired
        ? `${transportRequired.worker.firstName} requires transport to be arranged.`
        : null

      return {
        crewId: crew.id,
        slug: crew.slug,
        name: crew.name,
        dayRate: crew.dayRate,
        expectedDays,
        totalLabourCost,
        skillLevel: crew.skillLevel,
        suitability,
        transportWarning,
        summary: crew.summary || '',
        recommended: false,
        reason: '',
      }
    })
    .sort((a, b) => a.totalLabourCost - b.totalLabourCost || a.expectedDays - b.expectedDays)

  if (!options.length) {
    return { jobProfile: technical ? 'technical' : standard ? 'standard' : 'general', options }
  }

  const recommended = technical
    ? options.find((option) => {
        const crew = crews.find((item) => item.id === option.crewId)
        return crew?.technicalSpecialist
      }) || options[0]
    : options.find((option) => option.suitability === 'Best fit') || options[0]

  const alternative = options.find((option) => option.crewId !== recommended.crewId)
  recommended.recommended = true
  if (technical) {
    recommended.reason = `${recommended.name} is recommended because this looks technical or finish-critical. The higher skill level reduces workmanship and remedial risk${alternative ? `; estimated labour is ${money(recommended.totalLabourCost)} versus ${money(alternative.totalLabourCost)} for ${alternative.name}` : ''}.`
  } else {
    recommended.reason = `${recommended.name} is recommended because the crew suits this type of work and the expected ${recommended.expectedDays}-day programme gives an estimated labour cost of ${money(recommended.totalLabourCost)}${alternative ? ` versus ${money(alternative.totalLabourCost)} for ${alternative.name}` : ''}.`
  }

  for (const option of options) {
    if (!option.reason) {
      option.reason = `${option.expectedDays} days × ${money(option.dayRate)} per day = ${money(option.totalLabourCost)}.`
    }
  }

  return {
    jobProfile: technical ? 'technical' : standard ? 'standard' : 'general',
    basedOnDefaultDuration: !(estimatedDays && estimatedDays > 0),
    options,
  }
}
