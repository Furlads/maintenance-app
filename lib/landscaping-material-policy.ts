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

function mergeNote(existing: string, addition: string) {
  const cleanExisting = String(existing || '').trim()
  if (!cleanExisting) return addition
  if (cleanExisting.includes(addition)) return cleanExisting
  return `${addition} ${cleanExisting}`
}

function isJointingMaterial(name: string) {
  return (
    name.includes('jointing') ||
    name.includes('pointing') ||
    name.includes('grout') ||
    name.includes('easyjoint') ||
    name.includes('easy joint') ||
    name.includes('polymeric')
  )
}

function halfBagUnits(requiredTonnes: number, bagTonnes: number) {
  if (!Number.isFinite(requiredTonnes) || requiredTonnes <= 0) return 0.5
  const halfBagTonnes = bagTonnes / 2
  return Math.max(0.5, Math.ceil(requiredTonnes / halfBagTonnes) * 0.5)
}

function formatBulkBagUnits(value: number) {
  if (value === 0.5) return '½ bulk bag'
  if (Number.isInteger(value)) return `${value} bulk bag${value === 1 ? '' : 's'}`
  return `${value.toFixed(1)} bulk bags`
}

function applyPatioBenchmarks(plan: LandscapingPlan): LandscapingPlan {
  if (!isPatio(plan.scope)) return plan

  const areaM2 = extractAreaM2(plan.scope)
  if (areaM2 <= 0) return plan

  const gravelAreaM2 = extractGravelAreaM2(plan.scope)

  // Furlads site-order rule: use six 25kg cement bags per bulk bag of sharp sand.
  // Work out how many sand bulk bags the full mortar-bed allowance needs, then derive
  // cement directly from that count so the two order lines can never contradict each other.
  const mortarBedDepthM = 0.04
  const wetMortarM3 = areaM2 * mortarBedDepthM
  const dryMortarM3 = wetMortarM3 * 1.33
  const sandShare = 4 / 5
  const sandDensityTPerM3 = 1.6
  const sharpSandNeededTonnes = roundTo(dryMortarM3 * sandShare * sandDensityTPerM3, 2)
  const sharpSandBagWeightTonnes = TRAVIS_PERKINS_BENCHMARKS.sharpSandBulkBag.packedWeightKg / 1000
  const sharpSandFullBags = Math.max(1, Math.ceil(sharpSandNeededTonnes / sharpSandBagWeightTonnes))
  const sharpSandInitialBags = Math.max(1, sharpSandFullBags - 1)
  const cementBagsPerSandBulkBag = 6
  const cementFullBags = sharpSandFullBags * cementBagsPerSandBulkBag
  const cementInitialBags = sharpSandInitialBags * cementBagsPerSandBulkBag

  const materials = plan.materials.map((material) => {
    const name = material.item.toLowerCase()

    if (
      name.includes('mot') ||
      name.includes('type 1') ||
      name.includes('type1') ||
      name.includes('sub-base') ||
      name.includes('sub base')
    ) {
      const neededTonnes = roundTo(areaM2 * 0.1 * 2, 1)
      const bagWeightTonnes = TRAVIS_PERKINS_BENCHMARKS.motType1BulkBag.packedWeightKg / 1000
      const fullRequirementBags = Math.ceil(neededTonnes / bagWeightTonnes)
      const initialOrderBags = Math.max(1, Math.floor(fullRequirementBags * 0.8))
      const initialOrderTonnes = roundTo(initialOrderBags * bagWeightTonnes, 1)
      const projectedCost = roundMoney(
        fullRequirementBags * TRAVIS_PERKINS_BENCHMARKS.motType1BulkBag.priceExVat
      )

      return {
        ...material,
        quantity: `${fullRequirementBags} bulk bags needed (${neededTonnes.toFixed(1)}t theoretical total)`,
        neededQuantity: `${fullRequirementBags} × ~800kg Type 1 bulk bags`,
        orderQuantity: `${initialOrderBags} × ~800kg Type 1 bulk bags initially (${initialOrderTonnes.toFixed(1)}t); top up only if required`,
        estimatedCostExVat: projectedCost,
        note: mergeNote(
          material.note,
          `${benchmarkNote(TRAVIS_PERKINS_BENCHMARKS.motType1BulkBag.label)} Listed in merchant bulk-bag units so ordering is simple. Initial site order is deliberately lean.`
        ),
      }
    }

    // Pointing/jointing is always brush-in grout tubs. This must be checked before
    // the cement rule because old CHAS labels may contain words like “sand/cement”.
    if (isJointingMaterial(name)) {
      const tub = TRAVIS_PERKINS_BENCHMARKS.easyJoint12_5KgTub
      const tubsNeeded = Math.max(1, Math.ceil(areaM2 / tub.planningCoverageM2))
      const tubsToOrder = Math.max(1, tubsNeeded - 1)
      const projectedCost = roundMoney(tubsNeeded * tub.priceExVat)

      return {
        ...material,
        item: 'Brush-in pointing / jointing grout',
        quantity: `${tubsNeeded} × 12.5kg tubs needed`,
        neededQuantity: `${tubsNeeded} × 12.5kg brush-in grout tubs`,
        orderQuantity: `${tubsToOrder} × 12.5kg tubs initially; top up only if joint widths/depth use more`,
        estimatedCostExVat: projectedCost,
        note: mergeNote(
          material.note,
          `${benchmarkNote(tub.label)} Furlads uses brush-in jointing/grout tubs for pointing; do not allocate cement bags to pointing/jointing.`
        ),
      }
    }

    if (
      name.includes('sharp sand') ||
      name.includes('bedding sand') ||
      name.includes('mortar bed')
    ) {
      const projectedCost = roundMoney(
        sharpSandFullBags * TRAVIS_PERKINS_BENCHMARKS.sharpSandBulkBag.priceExVat
      )

      return {
        ...material,
        quantity: `${sharpSandFullBags} bulk bag${sharpSandFullBags === 1 ? '' : 's'} needed for the full mortar-bed allowance`,
        neededQuantity: `${sharpSandFullBags} × ~800kg sharp-sand bulk bag${sharpSandFullBags === 1 ? '' : 's'}`,
        orderQuantity: `${sharpSandInitialBags} × ~800kg sharp-sand bulk bag${sharpSandInitialBags === 1 ? '' : 's'} initially; top up only if required`,
        estimatedCostExVat: projectedCost,
        note: mergeNote(
          material.note,
          `${benchmarkNote(TRAVIS_PERKINS_BENCHMARKS.sharpSandBulkBag.label)} Furlads order ratio is fixed at 6 × 25kg cement bags per sharp-sand bulk bag.`
        ),
      }
    }

    if (name.includes('cement')) {
      const projectedCost = roundMoney(
        cementFullBags * TRAVIS_PERKINS_BENCHMARKS.generalPurposeCement25Kg.priceExVat
      )

      return {
        ...material,
        item: 'Cement for bedding mortar',
        quantity: `${cementFullBags} × 25kg cement bags needed (${cementBagsPerSandBulkBag} per sharp-sand bulk bag)`,
        neededQuantity: `${cementFullBags} × 25kg cement bags`,
        orderQuantity: `${cementInitialBags} × 25kg bags initially — exactly ${cementBagsPerSandBulkBag} per ordered sharp-sand bulk bag`,
        estimatedCostExVat: projectedCost,
        note: mergeNote(
          material.note,
          `${benchmarkNote(TRAVIS_PERKINS_BENCHMARKS.generalPurposeCement25Kg.label)} Cement is for the bedding mortar only. Furlads uses a fixed site-order ratio of 6 × 25kg cement bags to every 1 bulk bag of sharp sand.`
        ),
      }
    }

    if (name.includes('membrane') || name.includes('geotextile')) {
      const neededM2 = roundTo(areaM2 * 1.05, 1)
      const coverageM2 = TRAVIS_PERKINS_BENCHMARKS.heavyDutyLandscapeFabric2x25.coverageM2
      const rollsForFullRequirement = Math.max(1, Math.ceil(neededM2 / coverageM2))
      const projectedCost = roundMoney(
        rollsForFullRequirement *
          TRAVIS_PERKINS_BENCHMARKS.heavyDutyLandscapeFabric2x25.priceExVat
      )

      return {
        ...material,
        quantity: `${rollsForFullRequirement} roll needed (${neededM2.toFixed(1)}m² requirement)`,
        neededQuantity: `${rollsForFullRequirement} × 2m × 25m membrane roll`,
        orderQuantity: `Check existing roll first; buy ${rollsForFullRequirement} × 2m × 25m roll only if stock is insufficient`,
        estimatedCostExVat: projectedCost,
        note: mergeNote(
          material.note,
          benchmarkNote(TRAVIS_PERKINS_BENCHMARKS.heavyDutyLandscapeFabric2x25.label)
        ),
      }
    }

    if (
      name.includes('raj green') ||
      name.includes('indian sandstone') ||
      name.includes('sandstone paving')
    ) {
      const requiredM2 = roundTo(areaM2 * 1.05, 1)
      const coverage = TRAVIS_PERKINS_BENCHMARKS.rajGreenSandstonePack.coverageM2
      const fullPacks = Math.max(1, Math.ceil(requiredM2 / coverage))
      const projectedCost = roundMoney(
        fullPacks * TRAVIS_PERKINS_BENCHMARKS.rajGreenSandstonePack.priceExVat
      )

      return {
        ...material,
        quantity: `${requiredM2.toFixed(1)}m² needed incl. cuts/waste`,
        neededQuantity: `${requiredM2.toFixed(1)}m² Raj Green / equivalent project-pack coverage`,
        orderQuantity: `Buy as close to ${requiredM2.toFixed(1)}m² as supplier pack sizes allow; avoid a whole extra pack purely as contingency`,
        estimatedCostExVat: projectedCost,
        note: mergeNote(
          material.note,
          `${benchmarkNote(TRAVIS_PERKINS_BENCHMARKS.rajGreenSandstonePack.label)} Prefer a local supplier that can get closer to the actual required square meterage if that avoids substantial leftover paving.`
        ),
      }
    }

    if (
      gravelAreaM2 > 0 &&
      (name.includes('black-ice') || name.includes('black ice') || name.includes('decorative gravel'))
    ) {
      const gravel = TRAVIS_PERKINS_BENCHMARKS.blackBasaltBulkBag
      const bagTonnes = gravel.packedWeightKg / 1000
      const volumeM3 = gravelAreaM2 * 0.04
      const requiredTonnes = roundTo(volumeM3 * 1.6, 2)
      const requiredBagUnits = halfBagUnits(requiredTonnes, bagTonnes)
      const orderBagUnits = requiredBagUnits <= 0.5 ? 0.5 : Math.max(0.5, requiredBagUnits - 0.5)
      const projectedCost = roundMoney(requiredBagUnits * gravel.priceExVat)

      return {
        ...material,
        quantity: `${formatBulkBagUnits(requiredBagUnits)} needed for approx ${gravelAreaM2.toFixed(2)}m² at 40mm`,
        neededQuantity: `${formatBulkBagUnits(requiredBagUnits)} decorative gravel`,
        orderQuantity: `${formatBulkBagUnits(orderBagUnits)} initially; top up by another ½ bag only if required`,
        estimatedCostExVat: projectedCost,
        note: mergeNote(
          material.note,
          `${benchmarkNote(gravel.label)} Decorative gravel is always shown in half-bulk-bag or full-bulk-bag increments so the order sheet is quick to use.`
        ),
      }
    }

    return material
  })

  const materialsExVat = roundMoney(
    materials.reduce((sum, material) => sum + material.estimatedCostExVat, 0)
  )
  const totalCostExVat = roundMoney(
    plan.projectedCosts.labourExVat +
      materialsExVat +
      plan.projectedCosts.plantWasteExVat +
      plan.projectedCosts.otherExVat
  )
  const projectedGrossProfitExVat = roundMoney(
    plan.projectedCosts.sellingPriceExVat - totalCostExVat
  )
  const projectedGrossProfitPercent =
    plan.projectedCosts.sellingPriceExVat > 0
      ? roundMoney(
          (projectedGrossProfitExVat / plan.projectedCosts.sellingPriceExVat) * 100
        )
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
        'Furlads patio ordering rule: 1 sharp-sand bulk bag = 6 × 25kg cement bags for bedding mortar.',
        'Pointing/jointing is brush-in grout supplied in tubs; it must never be calculated as cement bags.',
        'Decorative gravel is ordered/displayed only in half-bulk-bag or full-bulk-bag increments.',
        'All material quantities should be displayed in normal orderable merchant units: bulk bags, 25kg cement bags, jointing tubs, rolls, packs or supplier units — not just abstract tonnes/m³.',
        'Material purchase costs use Travis Perkins public ex-VAT prices as a fallback benchmark where a better local/trade price is not already known.',
        'Keep initial deliveries lean. It is preferable to top up a little material during the job than to leave the crew with excess aggregate, sand, paving or other stock to move/dispose of at completion.',
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
