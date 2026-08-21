export const FURLADS_QUOTE_PRICING_RULES = `
FURLADS QUOTE PRICING RULES

CORE PRINCIPLE
Price the whole job, not the measurement alone.

For every quote consider:
- materials
- labour
- plant / machinery
- waste disposal
- deliveries
- specialist / subcontractor costs
- access and handling
- contingency / risk

Base square-metre and linear-metre rates are benchmarks only. They must never be used as the final quote calculation on their own.

INTERNAL SELLING-PRICE FORMULA
Direct Job Cost = all expected job costs before gross profit.
Selling Price = Direct Job Cost / (1 - desired gross margin).

Default minimum gross margin: 30%.
Always calculate and show internal selling-price references at:
- 30% GP
- 35% GP
- 40% GP

Never recommend below 30% GP without a clear warning.

LABOUR
Calculate labour in man-days.
workers x working days = man-days.
Use the true cost of the actual workers where known.
For employed workers include employment burden where available.
For subcontractors use the real agreed day rate.

ACCESS / PRODUCTIVITY
Start from normal productivity, then adjust labour for access and handling.
- Standard access: 1.00 labour multiplier
- Moderate restricted access: 1.10-1.20
- Difficult access: 1.20-1.35
- Very difficult / through-house access: 1.30-1.50

Do not increase material purchase prices just because access is poor. Increase handling labour, protection, duration and relevant breakage/risk allowance.

Automatic access flags:
- under 900mm: restricted
- under 750mm: severely restricted
- under 700mm: very difficult
- through house: property protection + extra handling + reduced productivity

WORK-SPECIFIC RULES
Porcelain:
- £170/m2 ex VAT is a straightforward-install benchmark, not the quote formula.
- separately consider removal, levels, steps, cuts, drainage, retaining structures and restricted access.
- vertical porcelain facing has different productivity from floor laying.

Existing patio removal:
Assess separately from installation. Distinguish loose/dry-bed, mortar-laid and heavy concrete/reinforced breakout.

Walls:
Classify decorative, low retaining or significant/structural retaining before pricing.
Retaining walls require foundation, drainage, backfill and added labour/risk allowances.

Composite decking:
Include removal, waste, new subframe unless inspected and confirmed sound, boards, clips/fixings, trims, steps, edge detailing and labour.
Multiple separate areas are slower than one rectangle of equal area.

Turf / seed:
Include removal, ground preparation, levelling, topsoil where needed, labour, waste and access.
Do not price purely by m2.

Gravel / gravel-grid driveways:
Include excavation, membrane, sub-base where required, grids where required, decorative gravel, edging, plant, labour and waste.

Fencing:
Price from bays/specification, posts, gravel boards, postcrete, gates, removal, waste, access, difficult digging and cuts. Do not rely on linear metres alone.

Sleepers:
Consider sleeper count/type, height, posts/stakes, fixings, excavation, backfill, retained pressure, waste and labour.

EXCAVATION / WASTE
Calculate excavation from area x average depth = m3, then allow for bulking/expansion.
Estimate likely disposal loads from volume and material type.
Never assume one grab load without calculating likely volume first.
If waste must be double-handled, add handling labour.

PLANT
Consider whether the site physically allows suitable digger, dumper, breaker, saw, compactor, mixer, stump grinder or rotavator.
No digger access means more labour; it does not mean the same job with the digger cost simply removed.

DRAINAGE
For patios check falls, DPC relationship, existing drains, channels, soakaway need, level changes and retaining-wall drainage.
Price specialist drainage or clearly identify it as an unresolved item.

MATERIAL WASTE ALLOWANCES
Use sensible ordering waste allowances, typically:
- porcelain 10%, rising to 12-15% for complex cuts / multiple areas / steps / cladding / narrow paths
- turf about 5%
- composite decking about 5-10%
- blocks about 5%

COMBINED JOBS
Each standalone package includes its fair share of mobilisation, deliveries, waste, setup, protection, travel and plant mobilisation.
When packages are completed together, reduce only the duplicated costs actually saved.
Never apply an arbitrary package discount.

CONTINGENCY
Suggested internal contingency:
- straightforward: 2-3%
- moderate complexity: 5%
- high complexity / restricted access: 5-8%
- significant unknown ground / structural conditions: 8-10%

UNKNOWN CONDITIONS
Never ignore significant unknowns. Either:
A. include contingency,
B. use a clearly labelled provisional allowance, or
C. exclude it clearly and require approval before extra work.

COMPLEXITY
Low: 1.00 labour.
Medium: 1.10-1.20 labour.
High: 1.25-1.40 labour.
Very high: manual review before quote is issued.

AUTOMATIC WARNING FLAGS
Warn/review if any apply:
- access below 700mm
- access through house
- retaining wall supporting patio
- more than 500mm level difference
- large concrete breakout
- digger cannot access
- unknown drainage on large paved area
- deck subframe condition unknown
- more than 10 tonnes estimated excavation
- selling price below 30% GP
- labour estimate inconsistent with scope
- customer-supplied material specification unknown

LABOUR SANITY CHECK
Compare total scope against total man-days before accepting the programme. If the programme is aggressive, say so and use a safer realistic duration.

INTERNAL QUOTE OUTPUT
Show internally where information supports it:
- measurements: m2 / linear metres / m3
- expected materials cost
- expected labour: man-days and cost
- plant
- waste
- logistics / access
- contingency
- estimated total job cost
- selling price at 30% GP
- selling price at 35% GP
- selling price at 40% GP
- recommended customer price ex VAT

CUSTOMER OUTPUT
Do not expose internal costing unless requested. Normally show clear works, measurements, materials/finish, preparation included, waste included, important assumptions, price ex VAT, VAT and total inc VAT.

QUESTION BEHAVIOUR
Do not turn the site visit into a giant questionnaire.
Use the written description, measurements, photos and notes first.
Only stop to ask a question when the missing answer could materially change price, programme or safe specification.
When possible, make a sensible provisional assumption and label it clearly instead of blocking the quote.

Before recommending a price, ask internally:
What will actually make this job take longer or cost more than the measurements suggest?
`;

export function sellingPriceForMargin(jobCost: number, margin: number) {
  if (!Number.isFinite(jobCost) || jobCost < 0) return 0;
  if (!Number.isFinite(margin) || margin <= 0 || margin >= 1) return 0;
  return Number((jobCost / (1 - margin)).toFixed(2));
}

export function grossMarginPercent(price: number, jobCost: number) {
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(jobCost) || jobCost < 0) return 0;
  return Number((((price - jobCost) / price) * 100).toFixed(1));
}
