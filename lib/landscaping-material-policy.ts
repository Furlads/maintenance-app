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
      const initialOrderBags = Math.max(
        1,
        Math.floor((neededTonnes * 0.8) / bagWeightTonnes)
      )
      const initialOrderTonnes = roundTo(initialOrderBags * bagWeightTonnes, 1)
      const projectedCost = roundMoney(
        fullRequirementBags * TRAVIS_PERKINS_BENCHMARKS.motType1BulkBag.priceExVat
      )

      return {
        ...material,
        quantity: `${neededTonnes.toFixed(1)}t total requirement at 100mm compacted depth`,
        neededQuantity: `${neededTonnes.toFixed(1)}t total requirement at 100mm compacted depth`,
        orderQuantity: `${initialOrderBags} × 800kg bulk bags (${initialOrderTonnes.toFixed(1)}t) initially; use existing stock and top up only if needed`,
        estimatedCostExVat: projectedCost,
        note: mergeNote(
          material.note,
          `${benchmarkNote(TRAVIS_PERKINS_BENCHMARKS.motType1BulkBag.label)} Full requirement benchmark uses ${fullRequirementBags} bags, but the initial site order is deliberately smaller to avoid leftover stone.`
        ),
      }
    }

    if (
      name.includes('sharp sand') ||
      name.includes('bedding sand') ||
      name.includes('mortar bed')
    ) {
      const neededTonnes = roundTo(areaM2 * 0.04 * 1.65, 2)
      const bagWeightTonnes = TRAVIS_PERKINS_BENCHMARKS.sharpSandBulkBag.packedWeightKg / 1000
      const fullRequirementBags = Math.ceil(neededTonnes / bagWeightTonnes)
      const initialOrderBags = Math.max(
        1,
        Math.floor((neededTonnes * 0.8) / bagWeightTonnes)
      )
      const initialOrderTonnes = roundTo(initialOrderBags * bagWeightTonnes, 1)
      const projectedCost = roundMoney(
        fullRequirementBags * TRAVIS_PERKINS_BENCHMARKS.sharpSandBulkBag.priceExVat
      )

      return {
        ...material,
        quantity: `Approx ${neededTonnes.toFixed(2)}t sharp sand equivalent for a 40mm full mortar bed`,
        neededQuantity: `Approx ${neededTonnes.toFixed(2)}t sharp sand equivalent for a 40mm full mortar bed`,
        orderQuantity: `${initialOrderBags} × 800kg bulk bags (${initialOrderTonnes.toFixed(1)}t) initially; top up if the bed or levels require more`,
        estimatedCostExVat: projectedCost,
        note: mergeNote(
          material.note,
          `${benchmarkNote(TRAVIS_PERKINS_BENCHMARKS.sharpSandBulkBag.label)} Initial delivery is intentionally lean so excess sand is not left for the lads to move afterwards.`
        ),
      }
    }

    if (name.includes('cement')) {
      const mortarWetM3 = areaM2 * 0.04
      const estimatedCementKg = mortarWetM3 * 1.33 * 0.2 * 1440
      const fullBags = Math.max(1, Math.ceil(estimatedCementKg / 25))
      const initialBags = Math.max(1, Math.floor(fullBags * 0.85))
      const projectedCost = roundMoney(
        fullBags * TRAVIS_PERKINS_BENCHMARKS.generalPurposeCement25Kg.priceExVat
      )

      return {
        ...material,
        quantity: `Approx ${fullBags} × 25kg cement bags for the full mortar allowance`,
        neededQuantity: `Approx ${fullBags} × 25kg cement bags for the full mortar allowance`,
        orderQuantity: `${initialBags} × 25kg bags initially; collect/top up the balance only if required`,
        estimatedCostExVat: projectedCost,
        note: mergeNote(
          material.note,
          `${benchmarkNote(TRAVIS_PERKINS_BENCHMARKS.generalPurposeCement25Kg.label)} Keep dry stock lean and top up locally rather than returning or storing excess bags.`
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
        quantity: `Approx ${neededM2.toFixed(1)}m² including sensible overlaps`,
        neededQuantity: `Approx ${neededM2.toFixed(1)}m² including sensible overlaps`,
        orderQuantity: `Use existing roll first; buy ${rollsForFullRequirement} × 2m × 25m roll only if stock is insufficient`,
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
        quantity: `${areaM2.toFixed(1)}m² finished area; approx ${requiredM2.toFixed(1)}m² including 5% cuts/waste`,
        neededQuantity: `${areaM2.toFixed(1)}m² finished area; approx ${requiredM2.toFixed(1)}m² including 5% cuts/waste`,
        orderQuantity: `Source as close to ${requiredM2.toFixed(1)}m² as possible locally. Avoid over-ordering full packs just for contingency; top up matching stone if needed.`,
        estimatedCostExVat: projectedCost,
        note: mergeNote(
          material.note,
          `${benchmarkNote(TRAVIS_PERKINS_BENCHMARKS.rajGreenSandstonePack.label)} TP fallback would require ${fullPacks} project pack(s), so prefer a local supplier able to supply nearer the actual required quantity where that avoids substantial leftover paving.`
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
