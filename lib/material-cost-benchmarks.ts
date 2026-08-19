export const MATERIAL_BENCHMARK_UPDATED = '2026-08-19'

export const TRAVIS_PERKINS_BENCHMARKS = {
  motType1BulkBag: {
    label: 'Travis Perkins MOT Type 1 bulk bag',
    packedWeightKg: 800,
    priceExVat: 62.7,
  },
  sharpSandBulkBag: {
    label: 'Travis Perkins grit/sharp sand bulk bag',
    packedWeightKg: 800,
    priceExVat: 62.7,
  },
  generalPurposeCement25Kg: {
    label: 'Travis Perkins general purpose cement 25kg',
    packedWeightKg: 25,
    priceExVat: 6.78,
  },
  heavyDutyLandscapeFabric2x25: {
    label: 'Travis Perkins 4Trade heavy duty landscape fabric 2m x 25m',
    coverageM2: 50,
    priceExVat: 24.16,
  },
  rajGreenSandstonePack: {
    label: 'Travis Perkins Raj Green/Lakeland sandstone 22.2m2 project pack',
    coverageM2: 22.2,
    priceExVat: 466.2,
  },
} as const

export function benchmarkNote(label: string) {
  return `${label} public retail ex-VAT benchmark checked ${MATERIAL_BENCHMARK_UPDATED}. Use a cheaper local/trade supplier price when known.`
}
