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

function applyPatioBenchmarks(plan: LandscapingPlan): LandscapingPlan {
  if (!isPatio(plan.scope)) return plan

  const areaM2 = extractAreaM2(plan.scope)
  if (areaM2 <= 0) return plan

  const gravelAreaM2 = extractGravelAreaM2(plan.scope)

  const mortarBedDepthM = 0.04
  const wetMortarM3 = areaM2 * mortarBedDepthM
  const dryMortarM3 = wetMortarM3 * 1.33
  const sandShare = 4 / 5
  const cementShare = 1 / 5
  const sandDensityTPerM3 = 1.6
  const cementDensityKgPerM3 = 1440
  const sharpSandNeededTonnes = roundTo(dryMortarM3 * sandShare * sandDensityTPerM3, 2)
  const cementNeededKg = dryMortarM3 * cementShare * cementDensityKgPerM3
  const cementNeededBags = Math.max(1, Math.ceil(cementNeededKg / 25))

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

    if (
      name.includes('sharp sand') ||
      name.includes('bedding sand') ||
      name.includes('mortar bed')
    ) {
      const bagWeightTonnes = TRAVIS_PERKINS_BENCHMARKS.sharpSandBulkBag.packedWeightKg / 1000
      const fullRequirementBags = Math.max(1, Math.ceil(sharpSandNeededTonnes / bagWeightTonnes))
      const initialOrderBags = Math.max(1, Math.floor(fullRequirementBags * 0.8))
      const projectedCost = roundMoney(
        fullRequirementBags * TRAVIS_PERKINS_BENCHMARKS.sharpSandBulkBag.priceExVat
      )

      return {
        ...material,
        quantity: `${fullRequirementBags} bulk bags needed for the full 4:1 mortar-bed allowance`,
        neededQuantity: `${fullRequirementBags} × ~800kg sharp-sand bulk bags`,
        orderQuantity: `${initialOrderBags} × ~800kg sharp-sand bulk bags initially; top up only if levels/bed thickness need more`,
        estimatedCostExVat: projectedCost,
        note: mergeNote(
          material.note,
          `${benchmarkNote(TRAVIS_PERKINS_BENCHMARKS.sharpSandBulkBag.label)} Sand and cement are calculated together from the same 4:1 sand:cement mix at a 40mm average full bed.`
        ),
      }
    }

    if (name.includes('cement')) {
      const fullBags = cementNeededBags
      const initialBags = Math.max(1, Math.floor(fullBags * 0.85))
      const projectedCost = roundMoney(
        fullBags * TRAVIS_PERKINS_BENCHMARKS.generalPurposeCement25Kg.priceExVat
      )

      return {
        ...material,
        quantity: `${fullBags} × 25kg bags needed for the same 4:1 mortar mix`,
        neededQuantity: `${fullBags} × 25kg cement bags`,
        orderQuantity: `${initialBags} × 25kg bags initially; top up only if required`,
        estimatedCostExVat: projectedCost,
        note: mergeNote(
          material.note,
          `${benchmarkNote(TRAVIS_PERKINS_BENCHMARKS.generalPurposeCement25Kg.label)} Cement is tied directly to the sharp-sand quantity using the same 4:1 mortar calculation, so impossible sand/cement ratios are avoided.`
        ),
      }
    }

    if (
      name.includes('jointing') ||
      name.includes('grout') ||
      name.includes('easyjoint') ||
      name.includes('easy joint')
    ) {
      const tub = TRAVIS_PERKINS_BENCHMARKS.easyJoint12_5KgTub
      const tubsNeeded = Math.max(1, Math.ceil(areaM2 / tub.planningCoverageM2))
      const tubsToOrder = Math.max(1, Math.floor(tubsNeeded * 0.8))
      const projectedCost = roundMoney(tubsNeeded * tub.priceExVat)

      return {
        ...material,
        quantity: `${tubsNeeded} × 12.5kg tubs needed`,
        neededQuantity: `${tubsNeeded} × 12.5kg jointing-compound tubs`,
        orderQuantity: `${tubsToOrder} × 12.5kg tubs initially; top up if joint widths/depth use more`,
        estimatedCostExVat: projectedCost,
        note: mergeNote(
          material.note,
          `${benchmarkNote(tub.label)} Planning coverage uses about ${tub.planningCoverageM2}m² per tub within the manufacturer's typical ${tub.coverageRangeM2}m² range; actual coverage depends heavily on joint size.`
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
      const gravel = TRAVIS_PERKINS_BENCHMARKS.blackBasaltTradePack20Kg
      const volumeM3 = gravelAreaM2 * 0.04
      const requiredKg = volumeM3 * 1600
      const fullBags = Math.max(1, Math.ceil(requiredKg / gravel.packedWeightKg))
      const initialBags = Math.max(1, Math.floor(fullBags * 0.8))
      const projectedCost = roundMoney(fullBags * gravel.priceExVat)

      return {
        ...material,
        quantity: `${fullBags} × 20kg bags needed for approx ${gravelAreaM2.toFixed(2)}m² at 40mm`,
        neededQuantity: `${fullBags} × 20kg decorative-gravel bags`,
        orderQuantity: `${initialBags} × 20kg bags initially; use matching stock/top up only if needed`,
        estimatedCostExVat: projectedCost,
        note: mergeNote(
          material.note,
          `${benchmarkNote(gravel.label)} Use the actual local decorative-stone pack size if buying elsewhere.`
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
