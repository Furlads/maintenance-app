import prisma from '@/lib/prisma'
import {
  LANDSCAPING_PLAN_PREFIX,
  type LandscapingPlan,
} from '@/lib/landscaping-plan'
import {
  TRAVIS_PERKINS_BENCHMARKS as TP,
  benchmarkNote,
} from '@/lib/material-cost-benchmarks'

type PlanMaterial = LandscapingPlan['materials'][number]

function money(value: number) {
  return Number((Number.isFinite(value) ? value : 0).toFixed(2))
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function areaM2(scope: string) {
  const explicit = scope.match(/(\d+(?:\.\d+)?)\s*(?:m2|m²|sqm)/i)
  if (explicit) return Number(explicit[1]) || 0
  const dims = scope.match(/(\d+(?:\.\d+)?)\s*(?:m)?\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:m)?/i)
  if (!dims) return 0
  return round(Number(dims[1]) * Number(dims[2]), 2)
}

function runM(scope: string) {
  const match = scope.match(/(?:run|length|fenc(?:e|ing)|retaining|drain(?:age)?)[^\d]{0,35}(\d+(?:\.\d+)?)\s*m\b/i)
  if (match) return Number(match[1]) || 0
  const generic = scope.match(/(\d+(?:\.\d+)?)\s*m\s*(?:run|long|length)/i)
  return generic ? Number(generic[1]) || 0 : 0
}

function widthM(scope: string) {
  const dims = scope.match(/(\d+(?:\.\d+)?)\s*(?:m)?\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:m)?/i)
  return dims ? Number(dims[2]) || 0 : 0
}

function gravelBorderArea(scope: string) {
  const explicit = scope.match(/(?:gravel|stone)[^.]{0,120}?(\d+(?:\.\d+)?)\s*(?:m2|m²|sqm)/i)
  if (explicit) return Number(explicit[1]) || 0
  const dims = scope.match(/(\d+(?:\.\d+)?)\s*(?:m)?\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:m)?/i)
  const border = scope.match(/(?:gravel|strip|border)[^.]{0,120}?(\d+(?:\.\d+)?)\s*mm/i)
  if (!dims || !border) return 0
  const l = Number(dims[1])
  const w = Number(dims[2])
  const b = Number(border[1]) / 1000
  return round(2 * (l + w) * b, 2)
}

function has(scope: string, ...terms: string[]) {
  const text = scope.toLowerCase()
  return terms.some((term) => text.includes(term))
}

function make(item: string, needed: string, order: string, projected: number, note: string, actual: number | null = null): PlanMaterial {
  return {
    item,
    quantity: needed,
    neededQuantity: needed,
    orderQuantity: order,
    orderFor: 'Before job starts',
    estimatedCostExVat: money(projected),
    actualCostExVat: actual,
    note,
  }
}

function actualByWords(source: PlanMaterial[], words: string[]) {
  const row = source.find((material) => {
    const name = material.item.toLowerCase()
    return words.some((word) => name.includes(word)) && material.actualCostExVat != null
  })
  return row?.actualCostExVat ?? null
}

function bulkBagText(value: number) {
  if (value <= 0.5) return '½ bulk bag'
  if (value === 1) return '1 bulk bag'
  if (Number.isInteger(value)) return `${value} bulk bags`
  return `${Math.floor(value)}½ bulk bags`
}

function halfBagUnits(requiredKg: number, bagKg = 800) {
  return Math.max(0.5, Math.ceil(requiredKg / (bagKg / 2)) / 2)
}

function mergeRows(rows: PlanMaterial[]) {
  const result: PlanMaterial[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const key = row.item.trim().toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(row)
  }
  return result
}

function patioRows(plan: LandscapingPlan) {
  const a = areaM2(plan.scope)
  if (!a) return []
  const src = plan.materials
  const rows: PlanMaterial[] = []
  const porcelain = has(plan.scope, 'porcelain')
  const blockPaving = has(plan.scope, 'block paving', 'block-paving')

  if (blockPaving) {
    const packs = Math.max(1, Math.ceil((a * 1.05) / TP.standardBlockPavingPack.coverageM2))
    rows.push(make(
      'Concrete block paving',
      `${round(a * 1.05, 1)}m² including 5% cuts/waste`,
      `${packs} Travis Perkins pack${packs === 1 ? '' : 's'} at ${TP.standardBlockPavingPack.coverageM2}m²/pack`,
      packs * TP.standardBlockPavingPack.priceExVat,
      benchmarkNote(TP.standardBlockPavingPack.label),
      actualByWords(src, ['block paving'])
    ))
  } else if (porcelain) {
    const packs = Math.max(1, Math.ceil((a * 1.05) / TP.porcelainPavingPack.coverageM2))
    rows.push(make(
      'Porcelain paving',
      `${round(a * 1.05, 1)}m² including 5% cuts/waste`,
      `${packs} Travis Perkins pack${packs === 1 ? '' : 's'} at ${TP.porcelainPavingPack.coverageM2}m²/pack`,
      packs * TP.porcelainPavingPack.priceExVat,
      benchmarkNote(TP.porcelainPavingPack.label),
      actualByWords(src, ['porcelain'])
    ))
  } else {
    const packs = Math.max(1, Math.ceil((a * 1.05) / TP.rajGreenSandstonePack.coverageM2))
    rows.push(make(
      has(plan.scope, 'raj green') ? 'Raj Green Indian sandstone paving' : 'Indian sandstone paving',
      `${round(a * 1.05, 1)}m² including 5% cuts/waste`,
      `Buy as close to ${round(a * 1.05, 1)}m² as supplier pack sizes allow; TP fallback = ${packs} project pack${packs === 1 ? '' : 's'}`,
      packs * TP.rajGreenSandstonePack.priceExVat,
      benchmarkNote(TP.rajGreenSandstonePack.label),
      actualByWords(src, ['sandstone', 'raj green', 'paving'])
    ))
  }

  const type1Tonnes = a * 0.1 * 2
  const type1Bags = Math.max(1, Math.ceil(type1Tonnes / 0.8))
  const type1Order = Math.max(1, Math.floor(type1Bags * 0.8))
  rows.push(make(
    'MOT Type 1 sub-base',
    `${type1Bags} × ~800kg bulk bags (${round(type1Tonnes, 1)}t theoretical at 100mm compacted)`,
    `${type1Order} × ~800kg bulk bags initially; top up only if needed`,
    type1Bags * TP.motType1BulkBag.priceExVat,
    `${benchmarkNote(TP.motType1BulkBag.label)} Keep the first delivery lean.`,
    actualByWords(src, ['type 1', 'mot'])
  ))

  if (blockPaving) {
    const kilnBags = Math.max(1, Math.ceil(a / TP.kilnDriedPavingSand20Kg.planningCoverageM2))
    rows.push(make(
      'Kiln-dried jointing sand',
      `${kilnBags} × 20kg bags`,
      `${Math.max(1, kilnBags - 1)} × 20kg bags initially; top up if needed`,
      kilnBags * TP.kilnDriedPavingSand20Kg.priceExVat,
      benchmarkNote(TP.kilnDriedPavingSand20Kg.label),
      actualByWords(src, ['kiln'])
    ))
  } else {
    const sandNeededT = a * 0.04 * 1.33 * (6 / 7) * 1.6
    const sandBags = Math.max(1, Math.ceil(sandNeededT / 0.8))
    const sandOrder = Math.max(1, sandBags - 1)
    rows.push(make(
      'Sharp sand for bedding mortar',
      `${sandBags} × ~800kg bulk bags`,
      `${sandOrder} × ~800kg bulk bags initially; top up only if needed`,
      sandBags * TP.sharpSandBulkBag.priceExVat,
      `${benchmarkNote(TP.sharpSandBulkBag.label)} Furlads ratio is 1 sand bulk bag to 6 × 25kg cement bags.`,
      actualByWords(src, ['sharp sand', 'bedding sand'])
    ))
    const cementNeed = sandBags * 6
    const cementOrder = sandOrder * 6
    rows.push(make(
      'General purpose cement — bedding mortar only',
      `${cementNeed} × 25kg bags`,
      `${cementOrder} × 25kg bags initially; top up with sand in the same 6:1 bag ratio`,
      cementNeed * TP.generalPurposeCement25Kg.priceExVat,
      `${benchmarkNote(TP.generalPurposeCement25Kg.label)} Pointing is separate brush-in grout, never extra cement.`,
      actualByWords(src, ['cement'])
    ))
    const groutNeed = Math.max(1, Math.ceil(a / TP.easyJoint12_5KgTub.planningCoverageM2))
    rows.push(make(
      'Brush-in pointing / jointing grout',
      `${groutNeed} × 12.5kg tubs`,
      `${Math.max(1, groutNeed - 1)} × 12.5kg tubs initially; top up if joint size uses more`,
      groutNeed * TP.easyJoint12_5KgTub.priceExVat,
      benchmarkNote(TP.easyJoint12_5KgTub.label),
      actualByWords(src, ['jointing', 'grout', 'pointing'])
    ))
  }

  const gravelArea = gravelBorderArea(plan.scope)
  const membraneArea = (a + gravelArea) * 1.05
  const membraneRolls = Math.max(1, Math.ceil(membraneArea / TP.heavyDutyLandscapeFabric2x25.coverageM2))
  rows.push(make(
    'Geotextile membrane',
    `${membraneRolls} × 2m × 25m roll (${round(membraneArea, 1)}m² incl. overlap)`,
    `Check stock first; buy ${membraneRolls} roll${membraneRolls === 1 ? '' : 's'} only if needed`,
    membraneRolls * TP.heavyDutyLandscapeFabric2x25.priceExVat,
    benchmarkNote(TP.heavyDutyLandscapeFabric2x25.label),
    actualByWords(src, ['membrane', 'geotextile'])
  ))

  if (gravelArea > 0) {
    const neededUnits = halfBagUnits(gravelArea * 0.04 * 1600, TP.blackBasaltBulkBag.packedWeightKg)
    rows.push(make(
      'Decorative gravel',
      `${bulkBagText(neededUnits)} for approx ${round(gravelArea, 2)}m²`,
      `${bulkBagText(Math.max(0.5, neededUnits - 0.5))} initially; top up by ½ bag if required`,
      neededUnits * TP.blackBasaltBulkBag.priceExVat,
      benchmarkNote(TP.blackBasaltBulkBag.label),
      actualByWords(src, ['decorative gravel', 'black ice', 'black-ice'])
    ))
  }

  return rows
}

function fencingRows(plan: LandscapingPlan) {
  if (!has(plan.scope, 'fence', 'fencing', 'fence panel', 'gravel board')) return []
  const length = runM(plan.scope)
  if (!length) return []
  const src = plan.materials
  const bay = TP.fencePanel6x5.widthM
  const panels = Math.max(1, Math.ceil(length / bay))
  const posts = panels + 1
  const rows = [
    make('Fence panels', `${panels} × 6ft wide panels`, `${panels} panels`, panels * TP.fencePanel6x5.priceExVat, benchmarkNote(TP.fencePanel6x5.label), actualByWords(src, ['panel'])),
    make('Concrete slotted fence posts', `${posts} × 2440mm posts`, `${posts} posts`, posts * TP.concreteFencePost2440.priceExVat, benchmarkNote(TP.concreteFencePost2440.label), actualByWords(src, ['post'])),
    make('Concrete gravel boards', `${panels} × 1830mm gravel boards`, `${panels} gravel boards`, panels * TP.concreteGravelBoard6in.priceExVat, benchmarkNote(TP.concreteGravelBoard6in.label), actualByWords(src, ['gravel board'])),
    make('Postcrete', `${posts * 2} × 20kg bags (2 per post)`, `${posts * 2} bags`, posts * 2 * TP.postcrete20Kg.priceExVat, benchmarkNote(TP.postcrete20Kg.label), actualByWords(src, ['postcrete', 'post mix'])),
  ]
  if (has(plan.scope, 'trellis')) rows.push(make('Trellis', `${panels} × 6ft sections`, `${panels} sections`, panels * TP.trellis6x1.priceExVat, benchmarkNote(TP.trellis6x1.label), actualByWords(src, ['trellis'])))
  if (has(plan.scope, 'gate')) {
    rows.push(make('Timber gate', '1 × 900mm gate', '1 gate', TP.timberGate900x1800.priceExVat, benchmarkNote(TP.timberGate900x1800.label), actualByWords(src, ['gate'])))
    rows.push(make('Gate ironmongery', '1 hinge pair + 1 latch', '1 hinge pack + 1 latch', TP.gateHingesPair350.priceExVat + TP.gateLatch.priceExVat, `${benchmarkNote(TP.gateHingesPair350.label)} ${benchmarkNote(TP.gateLatch.label)}`, actualByWords(src, ['hinge', 'latch'])))
  }
  return rows
}

function artificialGrassRows(plan: LandscapingPlan) {
  if (!has(plan.scope, 'artificial grass', 'artificial lawn')) return []
  const a = areaM2(plan.scope)
  if (!a) return []
  const src = plan.materials
  const w = widthM(plan.scope) || 4
  const rollWidth = TP.artificialGrass30mm4m.widthM
  const runs = Math.max(1, Math.ceil(w / rollWidth))
  const lengthNeeded = round((a / w) * 1.05, 1)
  const linearM = round(runs * lengthNeeded, 1)
  const type1Bags = Math.max(1, Math.ceil((a * 0.075 * 2) / 0.8))
  const granoBags = Math.max(1, Math.ceil((a * 0.025 * 1.8) / 0.8))
  const membraneRolls = Math.max(1, Math.ceil((a * 1.05) / TP.heavyDutyLandscapeFabric2x25.coverageM2))
  const pinPacks = Math.max(1, Math.ceil((a / 5) / TP.artificialGrassUPins10.packQuantity))
  return [
    make('Artificial grass 30mm', `${round(a * 1.05, 1)}m² incl. cuts`, `${linearM} linear metres of 4m-wide roll`, linearM * TP.artificialGrass30mm4m.priceExVatPerLinearM, benchmarkNote(TP.artificialGrass30mm4m.label), actualByWords(src, ['artificial grass'])),
    make('MOT Type 1 sub-base', `${type1Bags} × ~800kg bulk bags`, `${Math.max(1, type1Bags - 1)} bulk bags initially; top up if needed`, type1Bags * TP.motType1BulkBag.priceExVat, benchmarkNote(TP.motType1BulkBag.label), actualByWords(src, ['type 1', 'mot'])),
    make('Grano dust laying course', `${granoBags} × ~800kg bulk bags`, `${Math.max(1, granoBags - 1)} bulk bags initially; top up if needed`, granoBags * TP.granoDustBulkBag.priceExVat, benchmarkNote(TP.granoDustBulkBag.label), actualByWords(src, ['grano'])),
    make('Geotextile membrane', `${membraneRolls} × 2m × 25m roll`, `Check stock first; buy ${membraneRolls} roll${membraneRolls === 1 ? '' : 's'} if needed`, membraneRolls * TP.heavyDutyLandscapeFabric2x25.priceExVat, benchmarkNote(TP.heavyDutyLandscapeFabric2x25.label), actualByWords(src, ['membrane'])),
    make('Artificial grass jointing tape', `${Math.max(1, runs - 1)} seam run${runs - 1 === 1 ? '' : 's'}`, `${Math.max(1, Math.ceil(((runs - 1) * lengthNeeded) / TP.artificialGrassJointingTape20m.lengthM))} × 20m roll`, Math.max(1, Math.ceil(((runs - 1) * lengthNeeded) / TP.artificialGrassJointingTape20m.lengthM)) * TP.artificialGrassJointingTape20m.priceExVat, benchmarkNote(TP.artificialGrassJointingTape20m.label), actualByWords(src, ['jointing tape'])),
    make('Artificial grass adhesive', `${Math.max(1, runs - 1)} seam allowance`, `${Math.max(1, runs - 1)} × 310ml tubes`, Math.max(1, runs - 1) * TP.artificialGrassAdhesive310ml.priceExVat, benchmarkNote(TP.artificialGrassAdhesive310ml.label), actualByWords(src, ['adhesive'])),
    make('Artificial grass U-pins', `${pinPacks} pack${pinPacks === 1 ? '' : 's'} of 10`, `${pinPacks} pack${pinPacks === 1 ? '' : 's'}`, pinPacks * TP.artificialGrassUPins10.priceExVat, benchmarkNote(TP.artificialGrassUPins10.label), actualByWords(src, ['u-pin', 'pins'])),
  ]
}

function turfRows(plan: LandscapingPlan) {
  if (!has(plan.scope, 'turf', 'turfing', 'new lawn') || has(plan.scope, 'artificial')) return []
  const a = areaM2(plan.scope)
  if (!a) return []
  const src = plan.materials
  const turfRolls = Math.max(1, Math.ceil(a * 1.03))
  const topsoilM3 = a * 0.05
  const topsoilBags = Math.max(1, Math.ceil(topsoilM3 / TP.topsoilBulkBag600L.volumeM3))
  return [
    make('Turf rolls', `${turfRolls} × 1m² rolls`, `${turfRolls} rolls`, turfRolls * TP.turfRoll1M2.priceExVat, benchmarkNote(TP.turfRoll1M2.label), actualByWords(src, ['turf'])),
    make('Topsoil', `${topsoilBags} × 600L bulk bags for approx 50mm improvement layer`, `${Math.max(1, topsoilBags - 1)} bulk bags initially; top up if levels require`, topsoilBags * TP.topsoilBulkBag600L.priceExVat, benchmarkNote(TP.topsoilBulkBag600L.label), actualByWords(src, ['topsoil'])),
  ]
}

function gravelDriveRows(plan: LandscapingPlan) {
  if (!has(plan.scope, 'gravel driveway', 'gravel drive', 'gravel area') || has(plan.scope, 'patio')) return []
  const a = areaM2(plan.scope)
  if (!a) return []
  const src = plan.materials
  const type1Bags = Math.max(1, Math.ceil((a * 0.15 * 2) / 0.8))
  const gravelUnits = halfBagUnits(a * 0.05 * 1600, TP.gravelShingle20mmBulkBag.packedWeightKg)
  const membraneRolls = Math.max(1, Math.ceil((a * 1.05) / TP.heavyDutyLandscapeFabric2x25.coverageM2))
  return [
    make('MOT Type 1 sub-base', `${type1Bags} × ~800kg bulk bags at 150mm compacted`, `${Math.max(1, type1Bags - 1)} bulk bags initially; top up if needed`, type1Bags * TP.motType1BulkBag.priceExVat, benchmarkNote(TP.motType1BulkBag.label), actualByWords(src, ['type 1', 'mot'])),
    make('Geotextile membrane', `${membraneRolls} × 2m × 25m roll`, `Check stock first; buy ${membraneRolls} roll${membraneRolls === 1 ? '' : 's'} if needed`, membraneRolls * TP.heavyDutyLandscapeFabric2x25.priceExVat, benchmarkNote(TP.heavyDutyLandscapeFabric2x25.label), actualByWords(src, ['membrane'])),
    make('Decorative gravel / shingle', `${bulkBagText(gravelUnits)} at approx 50mm`, `${bulkBagText(Math.max(0.5, gravelUnits - 0.5))} initially; top up by ½ bag if required`, gravelUnits * TP.gravelShingle20mmBulkBag.priceExVat, benchmarkNote(TP.gravelShingle20mmBulkBag.label), actualByWords(src, ['gravel', 'shingle'])),
  ]
}

function deckingRows(plan: LandscapingPlan) {
  if (!has(plan.scope, 'decking', 'deck ')) return []
  const a = areaM2(plan.scope)
  if (!a) return []
  const src = plan.materials
  const composite = has(plan.scope, 'composite')
  const joistLengthM = Math.ceil((a / 0.4) * 1.1)
  if (composite) {
    const boardCoverage = TP.compositeDeckBoard3600.lengthM * TP.compositeDeckBoard3600.widthM
    const boards = Math.max(1, Math.ceil((a * 1.05) / boardCoverage))
    const joists = Math.max(1, Math.ceil(joistLengthM / TP.compositeJoist4000.lengthM))
    const clips = Math.max(1, Math.ceil((boards * 12) / TP.compositeClips100.packQuantity))
    return [
      make('Composite decking boards', `${boards} × 3.6m boards`, `${boards} boards`, boards * TP.compositeDeckBoard3600.priceExVat, benchmarkNote(TP.compositeDeckBoard3600.label), actualByWords(src, ['composite', 'deck board'])),
      make('Composite joists', `${joists} × 4m joists`, `${joists} joists`, joists * TP.compositeJoist4000.priceExVat, benchmarkNote(TP.compositeJoist4000.label), actualByWords(src, ['joist'])),
      make('Composite clips & screws', `${clips} pack${clips === 1 ? '' : 's'} of 100`, `${clips} pack${clips === 1 ? '' : 's'}`, clips * TP.compositeClips100.priceExVat, benchmarkNote(TP.compositeClips100.label), actualByWords(src, ['clip'])),
    ]
  }
  const boardCoverage = TP.timberDeckBoard4200.lengthM * TP.timberDeckBoard4200.finishedWidthM
  const boards = Math.max(1, Math.ceil((a * 1.05) / boardCoverage))
  const joists = Math.max(1, Math.ceil(joistLengthM / TP.treatedC16Joist47x100x4800.lengthM))
  const screws = Math.max(1, Math.ceil((boards * 20) / TP.timberDeckScrews1000.packQuantity))
  return [
    make('Timber decking boards', `${boards} × 4.2m boards`, `${boards} boards`, boards * TP.timberDeckBoard4200.priceExVat, benchmarkNote(TP.timberDeckBoard4200.label), actualByWords(src, ['decking board'])),
    make('Treated timber joists', `${joists} × 4.8m joists`, `${joists} joists`, joists * TP.treatedC16Joist47x100x4800.priceExVat, benchmarkNote(TP.treatedC16Joist47x100x4800.label), actualByWords(src, ['joist'])),
    make('Decking screws', `${screws} tub${screws === 1 ? '' : 's'} of 1000`, `${screws} tub${screws === 1 ? '' : 's'}`, screws * TP.timberDeckScrews1000.priceExVat, benchmarkNote(TP.timberDeckScrews1000.label), actualByWords(src, ['screw'])),
  ]
}

function retainingRows(plan: LandscapingPlan) {
  if (!has(plan.scope, 'retaining wall', 'sleeper wall', 'sleepers')) return []
  const length = runM(plan.scope)
  if (!length) return []
  const src = plan.materials
  const sleeperRows = Math.max(1, Number(plan.scope.match(/(\d+)\s*(?:sleepers?|courses?|rows?)\s*(?:high)?/i)?.[1] || 1))
  const sleepers = Math.max(1, Math.ceil((length / TP.timberSleeper2400.lengthM) * sleeperRows * 1.05))
  const posts = Math.max(2, Math.ceil(length / 1.2) + 1)
  const postcrete = posts * 2
  return [
    make('Treated timber sleepers', `${sleepers} × 2.4m sleepers`, `${sleepers} sleepers`, sleepers * TP.timberSleeper2400.priceExVat, benchmarkNote(TP.timberSleeper2400.label), actualByWords(src, ['sleeper'])),
    make('Treated support posts', `${posts} × 100×100×2400mm posts`, `${posts} posts`, posts * TP.treatedTimberPost100x100x2400.priceExVat, benchmarkNote(TP.treatedTimberPost100x100x2400.label), actualByWords(src, ['post'])),
    make('Postcrete', `${postcrete} × 20kg bags`, `${postcrete} bags`, postcrete * TP.postcrete20Kg.priceExVat, benchmarkNote(TP.postcrete20Kg.label), actualByWords(src, ['postcrete'])),
  ]
}

function drainageRows(plan: LandscapingPlan) {
  if (!has(plan.scope, 'drainage', 'aco', 'channel drain', 'soakaway', 'drain pipe')) return []
  const length = runM(plan.scope) || Math.max(1, widthM(plan.scope))
  const src = plan.materials
  const channelM = Math.max(1, Math.ceil(length))
  const pipeM = Math.max(3, Math.ceil(length))
  const pipeLengths = Math.max(1, Math.ceil(pipeM / TP.drainagePipe110x3m.lengthM))
  const gravelUnits = halfBagUnits(Math.max(400, pipeM * 0.25 * 0.25 * 1600), TP.gravelShingle10mmBulkBag.packedWeightKg)
  return [
    make('ACO channel drain', `${channelM} × 1m channels`, `${channelM} channels`, channelM * TP.acoHexDrain1m.priceExVat, benchmarkNote(TP.acoHexDrain1m.label), actualByWords(src, ['aco', 'channel'])),
    make('110mm drainage pipe', `${pipeLengths} × 3m lengths`, `${pipeLengths} lengths`, pipeLengths * TP.drainagePipe110x3m.priceExVat, benchmarkNote(TP.drainagePipe110x3m.label), actualByWords(src, ['drainage pipe', '110mm'])),
    make('Drainage gravel', `${bulkBagText(gravelUnits)}`, `${bulkBagText(Math.max(0.5, gravelUnits - 0.5))} initially; top up by ½ bag if required`, gravelUnits * TP.gravelShingle10mmBulkBag.priceExVat, benchmarkNote(TP.gravelShingle10mmBulkBag.label), actualByWords(src, ['drainage gravel', 'pea gravel'])),
  ]
}

function concreteBaseRows(plan: LandscapingPlan) {
  if (!has(plan.scope, 'concrete base', 'shed base', 'concrete slab')) return []
  const a = areaM2(plan.scope)
  if (!a) return []
  const src = plan.materials
  const type1Bags = Math.max(1, Math.ceil((a * 0.075 * 2) / 0.8))
  const concreteM3 = a * 0.1
  const readyBags = Math.max(1, Math.ceil((concreteM3 * 2200) / TP.readyConcrete20Kg.packedWeightKg))
  return [
    make('MOT Type 1 sub-base', `${type1Bags} × ~800kg bulk bags`, `${Math.max(1, type1Bags - 1)} bulk bags initially; top up if needed`, type1Bags * TP.motType1BulkBag.priceExVat, benchmarkNote(TP.motType1BulkBag.label), actualByWords(src, ['type 1', 'mot'])),
    make('Ready-mix concrete equivalent', `${round(concreteM3, 2)}m³ concrete at 100mm slab depth`, `${readyBags} × 20kg bags only for small/bagged jobs; use delivered concrete where more economical`, readyBags * TP.readyConcrete20Kg.priceExVat, benchmarkNote(TP.readyConcrete20Kg.label), actualByWords(src, ['concrete'])),
  ]
}

function applyCommonLandscapingPolicy(plan: LandscapingPlan) {
  const scope = plan.scope.toLowerCase()
  const generated: PlanMaterial[] = []

  if (has(scope, 'patio', 'paving', 'porcelain', 'sandstone', 'raj green', 'block paving')) generated.push(...patioRows(plan))
  generated.push(...fencingRows(plan))
  generated.push(...artificialGrassRows(plan))
  generated.push(...turfRows(plan))
  generated.push(...gravelDriveRows(plan))
  generated.push(...deckingRows(plan))
  generated.push(...retainingRows(plan))
  generated.push(...drainageRows(plan))
  generated.push(...concreteBaseRows(plan))

  if (!generated.length) {
    return {
      ...plan,
      commercialNotes: Array.from(new Set([
        ...plan.commercialNotes,
        'No canonical Furlads material template matched this scope. CHAS materials remain in place; projected costs should still be treated as Travis Perkins fallback allowances and actual costs entered from invoices.',
      ])),
    }
  }

  const rows = mergeRows(generated)
  const materialsExVat = money(rows.reduce((sum, row) => sum + row.estimatedCostExVat, 0))
  const totalCostExVat = money(
    plan.projectedCosts.labourExVat + materialsExVat + plan.projectedCosts.plantWasteExVat + plan.projectedCosts.otherExVat
  )
  const gp = money(plan.projectedCosts.sellingPriceExVat - totalCostExVat)
  const gpPercent = plan.projectedCosts.sellingPriceExVat > 0
    ? money((gp / plan.projectedCosts.sellingPriceExVat) * 100)
    : 0

  return {
    ...plan,
    version: 2 as const,
    materials: rows,
    projectedCosts: {
      ...plan.projectedCosts,
      materialsExVat,
      totalCostExVat,
      projectedGrossProfitExVat: gp,
      projectedGrossProfitPercent: gpPercent,
    },
    commercialNotes: Array.from(new Set([
      ...plan.commercialNotes,
      'Common Furlads landscaping jobs use deterministic merchant-unit order lists rather than free-form CHAS material rows.',
      'Travis Perkins public ex-VAT prices are the frozen projected-cost baseline. Actual supplier invoices are entered separately and do not rewrite the projection.',
      'Initial deliveries stay deliberately lean where a same-job top-up is practical, because leftover stock creates labour and disposal problems.',
    ])),
  }
}

export async function applyAndSaveMaterialPolicy(plan: LandscapingPlan) {
  const adjusted = applyCommonLandscapingPolicy(plan)

  await prisma.jobNote.create({
    data: {
      jobId: adjusted.jobId,
      note: `${LANDSCAPING_PLAN_PREFIX}${JSON.stringify(adjusted)}`,
    },
  })

  return adjusted
}
