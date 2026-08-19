import prisma from '@/lib/prisma'
import {
  LANDSCAPING_PLAN_PREFIX,
  type LandscapingPlan,
} from '@/lib/landscaping-plan'
import {
  TRAVIS_PERKINS_BENCHMARKS,
  benchmarkNote,
} from '@/lib/material-cost-benchmarks'

function roundMoney(value: number) {
  return Number(value.toFixed(2))
}

function roundTo(value: number, decimals = 2) {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function extractAreaM2(scope: string) {
  const dimensions = scope.match(
    /(\d+(?:\.\d+)?)\s*(?:m)?\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:m)?/i
  )

  if (dimensions) {
    const length = Number(dimensions[1])
    const width = Number(dimensions[2])
    if (Number.isFinite(length) && Number.isFinite(width) && length > 0 && width > 0) {
      return roundTo(length * width, 2)
    }
  }

  const area = scope.match(/(\d+(?:\.\d+)?)\s*(?:m2|m²|sqm)/i)
  const parsed = area ? Number(area[1]) : 0
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function extractGravelAreaM2(scope: string) {
  const explicit = scope.match(/gravel[^.]{0,180}?(\d+(?:\.\d+)?)\s*(?:m2|m²|sqm)/i)
  if (explicit) {
    const parsed = Number(explicit[1])
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }

  const dimensions = scope.match(/(\d+(?:\.\d+)?)\s*(?:m)?\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:m)?/i)
  const width = scope.match(/(?:gravel|strip)[^.]{0,140}?(\d+(?:\.\d+)?)\s*mm/i)
  if (!dimensions || !width) return 0

  const length = Number(dimensions[1])
  const patioWidth = Number(dimensions[2])
  const borderWidthM = Number(width[1]) / 1000
  if (![length, patioWidth, borderWidthM].every((value) => Number.isFinite(value) && value > 0)) return 0

  return roundTo(2 * (length + patioWidth) * borderWidthM, 2)
}

function isPatio(scope: string) {
  const value = scope.toLowerCase()
  return (
    value.includes('patio') ||
    value.includes('raj green') ||
    value.includes('indian sandstone') ||
    value.includes('indian stone') ||
    value.includes('porcelain')
  )
}

type PlanMaterial = LandscapingPlan['materials'][number]
type MaterialCategory =
  | 'paving'
  | 'type1'
  | 'sharpSand'
  | 'cement'
  | 'jointing'
  | 'membrane'
  | 'decorativeGravel'
  | 'other'

function categoryFor(itemName: string): MaterialCategory {
  const name = String(itemName || '').toLowerCase()

  if (name.includes('membrane') || name.includes('geotextile') || name.includes('landscape fabric')) {
    return 'membrane'
  }

  if (
    name.includes('jointing') ||
    name.includes('pointing') ||
    name.includes('grout') ||
    name.includes('easyjoint') ||
    name.includes('easy joint') ||
    name.includes('polymeric')
  ) {
    return 'jointing'
  }

  if (name.includes('cement')) return 'cement'

  if (
    name.includes('sharp sand') ||
    name.includes('bedding sand') ||
    name.includes('mortar bed')
  ) {
    return 'sharpSand'
  }

  if (
    name.includes('mot') ||
    name.includes('type 1') ||
    name.includes('type1') ||
    name.includes('sub-base') ||
    name.includes('sub base')
  ) {
    return 'type1'
  }

  if (
    name.includes('black-ice') ||
    name.includes('black ice') ||
    name.includes('decorative gravel') ||
    name.includes('decorative stone')
  ) {
    return 'decorativeGravel'
  }

  if (
    name.includes('raj green') ||
    name.includes('indian sandstone') ||
    name.includes('indian stone') ||
    name.includes('sandstone paving') ||
    name.includes('porcelain') ||
    name.includes('paving slab')
  ) {
    return 'paving'
  }

  return 'other'
}

function actualFromCategory(materials: PlanMaterial[], category: MaterialCategory) {
  const actual = materials.find(
    (material) => categoryFor(material.item) === category && material.actualCostExVat != null
  )?.actualCostExVat
  return actual ?? null
}

function makeMaterial(params: {
  item: string
  neededQuantity: string
  orderQuantity: string
  estimatedCostExVat: number
  actualCostExVat?: number | null
  note: string
  orderFor?: string
}): PlanMaterial {
  return {
    item: params.item,
    quantity: params.neededQuantity,
    neededQuantity: params.neededQuantity,
    orderQuantity: params.orderQuantity,
    orderFor: params.orderFor || 'Before job starts',
    estimatedCostExVat: roundMoney(params.estimatedCostExVat),
    actualCostExVat: params.actualCostExVat ?? null,
    note: params.note,
  }
}

function patioPavingLabel(scope: string) {
  const value = scope.toLowerCase()
  if (value.includes('raj green')) return 'Raj Green Indian sandstone paving'
  if (value.includes('porcelain')) return 'Porcelain paving'
  if (value.includes('indian sandstone') || value.includes('indian stone')) return 'Indian sandstone paving'
  return 'Paving'
}

function formatBulkBagUnits(value: number) {
  if (value === 0.5) return '½ bulk bag'
  if (value === 1) return '1 bulk bag'
  if (Number.isInteger(value)) return `${value} bulk bags`
  return `${Math.floor(value)}½ bulk bags`
}

function applyPatioBenchmarks(plan: LandscapingPlan): LandscapingPlan {
  if (!isPatio(plan.scope)) return plan

  const areaM2 = extractAreaM2(plan.scope)
  if (areaM2 <= 0) return plan

  const sourceMaterials = plan.materials
  const gravelAreaM2 = extractGravelAreaM2(plan.scope)

  const pavingRequirementM2 = roundTo(areaM2 * 1.05, 1)
  const pavingPack = TRAVIS_PERKINS_BENCHMARKS.rajGreenSandstonePack
  const pavingPacksAtFallbackMerchant = Math.max(1, Math.ceil(pavingRequirementM2 / pavingPack.coverageM2))
  const pavingProjectedCost = roundMoney(pavingPacksAtFallbackMerchant * pavingPack.priceExVat)

  const paving = makeMaterial({
    item: patioPavingLabel(plan.scope),
    neededQuantity: `${pavingRequirementM2.toFixed(1)}m² total including 5% cuts/waste`,
    orderQuantity: `Order as close to ${pavingRequirementM2.toFixed(1)}m² as the chosen supplier's pack sizes allow — no full extra pack just for contingency`,
    estimatedCostExVat: pavingProjectedCost,
    actualCostExVat: actualFromCategory(sourceMaterials, 'paving'),
    note: `${benchmarkNote(pavingPack.label)} Travis Perkins is the fallback price only. Prefer a cheaper local/trade supplier that can supply close to the actual square meterage and matching batch/colour.`,
  })

  const type1Bag = TRAVIS_PERKINS_BENCHMARKS.motType1BulkBag
  const type1NeededTonnes = roundTo(areaM2 * 0.1 * 2, 1)
  const type1BagTonnes = type1Bag.packedWeightKg / 1000
  const type1FullBags = Math.max(1, Math.ceil(type1NeededTonnes / type1BagTonnes))
  const type1OrderBags = Math.max(1, Math.floor(type1FullBags * 0.8))
  const type1 = makeMaterial({
    item: 'MOT Type 1 sub-base',
    neededQuantity: `${type1FullBags} × ~800kg bulk bags (${type1NeededTonnes.toFixed(1)}t theoretical requirement at 100mm compacted)`,
    orderQuantity: `${type1OrderBags} × ~800kg bulk bags initially; top up only if levels/ground conditions genuinely require it`,
    estimatedCostExVat: type1FullBags * type1Bag.priceExVat,
    actualCostExVat: actualFromCategory(sourceMaterials, 'type1'),
    note: `${benchmarkNote(type1Bag.label)} Calculated at 100mm compacted and approx 2.0t/m³. Initial delivery stays lean because topping up is easier than removing surplus.`,
  })

  // Furlads fixed ordering ratio: 1 sharp-sand bulk bag to 6 x 25kg cement bags.
  // Work out required sand bulk bags from a 40mm bed, then derive cement only from that count.
  const sharpSandBag = TRAVIS_PERKINS_BENCHMARKS.sharpSandBulkBag
  const mortarWetVolumeM3 = areaM2 * 0.04
  const mortarDryVolumeM3 = mortarWetVolumeM3 * 1.33
  const sandShareByVolume = 6 / 7
  const sharpSandDensityTonnesPerM3 = 1.6
  const sharpSandNeededTonnes = mortarDryVolumeM3 * sandShareByVolume * sharpSandDensityTonnesPerM3
  const sharpSandBagTonnes = sharpSandBag.packedWeightKg / 1000
  const sharpSandFullBags = Math.max(1, Math.ceil(sharpSandNeededTonnes / sharpSandBagTonnes))
  const sharpSandOrderBags = Math.max(1, sharpSandFullBags - 1)

  const sharpSand = makeMaterial({
    item: 'Sharp sand for bedding mortar',
    neededQuantity: `${sharpSandFullBags} × ~800kg bulk bags for the full patio allowance`,
    orderQuantity: `${sharpSandOrderBags} × ~800kg bulk bags initially; top up only if bed thickness/levels use more`,
    estimatedCostExVat: sharpSandFullBags * sharpSandBag.priceExVat,
    actualCostExVat: actualFromCategory(sourceMaterials, 'sharpSand'),
    note: `${benchmarkNote(sharpSandBag.label)} Furlads ordering ratio is fixed at 1 sharp-sand bulk bag to 6 × 25kg cement bags. Sand allowance is based on an approx 40mm full mortar bed.`,
  })

  const cementBag = TRAVIS_PERKINS_BENCHMARKS.generalPurposeCement25Kg
  const cementNeededBags = sharpSandFullBags * 6
  const cementOrderBags = sharpSandOrderBags * 6
  const cement = makeMaterial({
    item: 'General purpose cement — bedding mortar only',
    neededQuantity: `${cementNeededBags} × 25kg bags (${sharpSandFullBags} sand bulk bags × 6)`,
    orderQuantity: `${cementOrderBags} × 25kg bags initially (${sharpSandOrderBags} sand bulk bags × 6); top up sand and cement together`,
    estimatedCostExVat: cementNeededBags * cementBag.priceExVat,
    actualCostExVat: actualFromCategory(sourceMaterials, 'cement'),
    note: `${benchmarkNote(cementBag.label)} This cement is for bedding mortar only. Pointing/jointing is brush-in grout and must never add cement bags.`,
  })

  const groutTub = TRAVIS_PERKINS_BENCHMARKS.easyJoint12_5KgTub
  const groutTubsNeeded = Math.max(1, Math.ceil(areaM2 / groutTub.planningCoverageM2))
  const groutTubsToOrder = Math.max(1, groutTubsNeeded - 1)
  const jointing = makeMaterial({
    item: 'Brush-in pointing / jointing grout',
    neededQuantity: `${groutTubsNeeded} × 12.5kg tubs`,
    orderQuantity: `${groutTubsToOrder} × 12.5kg tubs initially; top up another tub only if joint width/depth uses more`,
    estimatedCostExVat: groutTubsNeeded * groutTub.priceExVat,
    actualCostExVat: actualFromCategory(sourceMaterials, 'jointing'),
    note: `${benchmarkNote(groutTub.label)} Furlads uses brush-in jointing compound here. Do not allocate sand or cement to pointing/jointing.`,
  })

  const membrane = TRAVIS_PERKINS_BENCHMARKS.heavyDutyLandscapeFabric2x25
  const membraneAreaNeeded = roundTo((areaM2 + gravelAreaM2) * 1.05, 1)
  const membraneRollsNeeded = Math.max(1, Math.ceil(membraneAreaNeeded / membrane.coverageM2))
  const membraneItem = makeMaterial({
    item: 'Geotextile membrane — patio and gravel strip',
    neededQuantity: `${membraneRollsNeeded} × 2m × 25m roll (${membraneAreaNeeded.toFixed(1)}m² incl. 5% overlap)`,
    orderQuantity: `Check existing roll stock first; buy ${membraneRollsNeeded} × 2m × 25m roll only if stock is insufficient`,
    estimatedCostExVat: membraneRollsNeeded * membrane.priceExVat,
    actualCostExVat: actualFromCategory(sourceMaterials, 'membrane'),
    note: `${benchmarkNote(membrane.label)} One membrane row covers the measured patio and decorative-gravel strip where required. Duplicate membrane rows are removed.`,
  })

  const canonicalMaterials: PlanMaterial[] = [
    paving,
    type1,
    sharpSand,
    cement,
    jointing,
    membraneItem,
  ]

  if (gravelAreaM2 > 0) {
    const gravel = TRAVIS_PERKINS_BENCHMARKS.blackBasaltBulkBag
    const gravelDepthM = 0.04
    const gravelDensityKgPerM3 = 1600
    const requiredKg = gravelAreaM2 * gravelDepthM * gravelDensityKgPerM3
    const halfBagKg = gravel.packedWeightKg / 2
    const halfBagUnitsNeeded = Math.max(1, Math.ceil(requiredKg / halfBagKg))
    const bulkBagEquivalentNeeded = halfBagUnitsNeeded / 2
    const orderBulkBagEquivalent = bulkBagEquivalentNeeded <= 0.5 ? 0.5 : bulkBagEquivalentNeeded - 0.5

    canonicalMaterials.push(
      makeMaterial({
        item: 'Decorative black-ice gravel',
        neededQuantity: `${formatBulkBagUnits(bulkBagEquivalentNeeded)} for approx ${gravelAreaM2.toFixed(2)}m² at 40mm depth`,
        orderQuantity: `${formatBulkBagUnits(orderBulkBagEquivalent)} initially; top up by another ½ bulk bag only if required`,
        estimatedCostExVat: gravel.priceExVat * bulkBagEquivalentNeeded,
        actualCostExVat: actualFromCategory(sourceMaterials, 'decorativeGravel'),
        note: `${benchmarkNote(gravel.label)} Decorative gravel is always shown in half-bulk-bag or full-bulk-bag increments.`,
      })
    )
  }

  // Keep only genuine non-standard extras. Every normal patio material above is rebuilt
  // canonically so duplicates and cross-matched rows cannot survive regeneration.
  const extras = sourceMaterials.filter((material) => categoryFor(material.item) === 'other')
  const materials = [...canonicalMaterials, ...extras]

  const materialsExVat = roundMoney(materials.reduce((sum, material) => sum + material.estimatedCostExVat, 0))
  const totalCostExVat = roundMoney(
    plan.projectedCosts.labourExVat +
      materialsExVat +
      plan.projectedCosts.plantWasteExVat +
      plan.projectedCosts.otherExVat
  )
  const projectedGrossProfitExVat = roundMoney(plan.projectedCosts.sellingPriceExVat - totalCostExVat)
  const projectedGrossProfitPercent = plan.projectedCosts.sellingPriceExVat > 0
    ? roundMoney((projectedGrossProfitExVat / plan.projectedCosts.sellingPriceExVat) * 100)
    : 0

  return {
    ...plan,
    version: 2,
    materials,
    projectedCosts: {
      ...plan.projectedCosts,
      materialsExVat,
      totalCostExVat,
      projectedGrossProfitExVat,
      projectedGrossProfitPercent,
    },
    commercialNotes: Array.from(
      new Set([
        ...plan.commercialNotes,
        'Standard patio packs use one canonical row each for paving, Type 1, sharp sand, cement, brush-in grout and membrane, plus decorative gravel where specified. Duplicate CHAS material rows are removed before saving.',
        'Furlads mortar ordering is fixed at 1 sharp-sand bulk bag to 6 × 25kg cement bags. Pointing/jointing is brush-in grout tubs and never adds cement.',
        'Decorative gravel is ordered only in half-bulk-bag or full-bulk-bag increments.',
        'Material purchase costs use Travis Perkins public ex-VAT prices as a fallback benchmark where a better local/trade price is not already known.',
        'Keep initial deliveries lean. It is preferable to top up during the job than leave excess material for the crew to move or dispose of.',
      ])
    ),
  }
}

export async function applyAndSaveMaterialPolicy(plan: LandscapingPlan) {
  const adjusted = applyPatioBenchmarks(plan)

  await prisma.jobNote.create({
    data: {
      jobId: adjusted.jobId,
      note: `${LANDSCAPING_PLAN_PREFIX}${JSON.stringify(adjusted)}`,
    },
  })

  return adjusted
}
