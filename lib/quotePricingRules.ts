export const FURLADS_QUOTE_PRICING_RULES = `
FURLADS QUOTE PRICING RULES

CORE PRINCIPLE
Price the real work, not the measurement alone, and do not turn every difficulty into a surcharge.

Direct Job Cost = materials + labour + plant + waste + deliveries + subcontractors + directly attributable logistics + sensible contingency.
Selling Price = Direct Job Cost / (1 - desired gross margin).
Default minimum gross margin: 30%.
Also show 35% and 40% references internally.

MOST IMPORTANT CALIBRATION RULE
Never charge twice for the same difficulty.
If access has already added extra man-days, do not also apply a blanket access percentage.
If a retaining wall is priced separately, do not also heavily uplift the patio because that wall creates the level change.
If demolition is priced separately, do not add another generic demolition complexity allowance.
If contingency covers an unknown, do not also inflate labour and materials for that same unknown.

Use explicit pounds and man-days wherever possible. Broad multipliers are a fallback, not the default.

HARD COSTS
Estimated hard costs must be actual expected Furlads costs, never selling rates.
Do not use benchmark customer rates such as £170/m2 as hard costs.
Do not put gross profit, markup or generic complexity percentages inside hard costs.
If hard costs look high, re-check them before the 30% margin floor is applied.

LABOUR
Calculate in man-days.
Build the programme from tasks first, then add only genuine extra time for logistics.
Typical sequence: strip-out, excavation/base prep, walling, paving, decking, finishing.
Do not assume every stage needs the same crew size.
A third person may help demolition and material movement but is often unnecessary for all finishing days.

ACCESS
Access changes productivity, not material purchase prices.
Use these as gentle guidance only:
- normal access: no uplift
- moderately restricted: roughly +5-10% to affected labour
- difficult: roughly +10-20% to affected labour
- through-house / under 700mm: usually roughly +15-25% to affected labour, plus protection and handling
Use more only when the route is long, stepped, fragile or genuinely severe.
Do not automatically apply the maximum because a doorway is narrow.

PORCELAIN
£170/m2 ex VAT is a useful straightforward customer selling benchmark for a normal complete installation.
For standard domestic porcelain, a sensible effective selling range is commonly about £160-£220/m2 before separately priced structural walls, major concrete breakout or specialist drainage.
Restricted access normally adds a modest labour/handling allowance, not another full percentage to the whole paving value.
If horizontal porcelain exceeds about £230-£240/m2, manually review for duplicated labour, duplicated groundworks or inflated hard costs.

As a calibration example, around 50-60m2 of porcelain on two levels with one step and awkward access should not automatically become an 11-day two-person paving package unless the excavation/base conditions genuinely justify that duration. Start from the actual work sequence and justify each extra day.

PATHS
Small narrow paths have a minimum-job effect because setup and cutting do not scale perfectly with area.
However, do not price a 5-6m2 path as though it were a major standalone patio unless it truly requires a separate mobilisation.
When completed with the main patio, share setup, delivery, mixer, cutting station and cleanup.

WALLS
Classify decorative vs retaining.
Retaining walls need suitable foundations, drainage/weep provision, blockwork and facing.
Price from actual quantities and man-days.
Do not over-engineer by assumption. Piled or engineered foundations are separate only where genuinely required.
For modest domestic retaining walls around 400-800mm high, use normal strip-foundation construction assumptions unless site evidence says otherwise.
Porcelain facing is slower than floor laying, but should be priced from actual face area and cutting rather than a broad structural multiplier.
If a pair of modest garden walls prices disproportionately close to the cost of the entire patio, review hard costs and labour days.

COMPOSITE DECKING
Include removal, disposal, new standard subframe unless confirmed reusable, boards, clips, trims and labour.
Multiple areas add cutting and finishing time, but do not stack a high m2 rate plus a separate complexity multiplier.
Sense-check against actual board/subframe costs and realistic crew days.
A domestic deck around 25-30m2 should not be pushed excessively high merely because it is split into a few rectangles.

EXCAVATION AND WASTE
Calculate expected volume where possible.
Poor access increases labour moving spoil, not the grab company's charge.
A provisional single grab should be priced close to the real expected supplier/disposal cost plus only directly related booking/admin if applicable.
Do not inflate a grab price because garden access is awkward.
Old decking waste should not automatically be treated as heavy inert spoil.

PLANT
If a machine cannot access, add the realistic replacement labour once.
Do not add both 'no digger labour' and another full access multiplier for the same lost productivity.

CONTINGENCY
Use only for residual unknown risk:
- straightforward: 2-3%
- moderate: 3-5%
- genuinely high-risk unknowns: 5-7%
Use 8-10% only where there are significant hidden structural/ground uncertainties.
Do not apply contingency to fully defined materials or known labour twice.

COMBINED JOBS
Standalone options can include fair standalone setup/mobilisation.
A combined package should remove only duplicated setup, delivery, protection and mobilisation costs.
Do not simply sum every standalone package and call that the combined price.
Do not create token savings such as a few hundred pounds on a £25k-£30k multi-package job if the separate options each include duplicated setup.
For several substantial packages completed together, a genuine combined saving often lands in the rough region of 3-8% of the separate total, but calculate it from real duplicated costs rather than forcing a percentage.

COMBINED PROGRAMME
Do not add all standalone durations and then only shave a little off.
Standalone durations contain duplicated setup and tidy time.
Build the combined programme fresh from the actual sequence and crew usage.
Shared excavation, material handling, wall/patio interfaces, deliveries and cleanup can materially reduce total days.

SANITY CHECKS
Before accepting the quote ask:
1. What are the actual hard costs?
2. What are the actual man-days?
3. Which difficulty has increased those costs?
4. Have I already charged for that difficulty elsewhere?
5. Does the effective £/m2 or £/m still look commercially sensible?
6. Is a margin floor inflating the quote only because the hard-cost estimate itself is wrong?

If a final price differs by more than about 15% from the first benchmark sense-check, explain the specific real costs causing the difference. If the explanation is only 'complexity' or 'restricted access', recalculate with explicit man-days and handling costs.

AUTOMATIC REVIEW FLAGS
- horizontal porcelain above about £240/m2 without major exceptional scope
- through-house access charged both as extra man-days and a blanket percentage
- retaining wall cost duplicated in patio complexity
- combined package saving below about 2% despite multiple standalone mobilisations
- grab/disposal allowance far above expected supplier cost without multiple loads
- combined duration close to the sum of every standalone duration
- labour duration cannot be explained by task sequence
- estimated hard costs appear to contain selling-rate assumptions

OUTPUT INTERNALLY
Show measurements, materials cost, labour man-days and labour cost, plant, waste, logistics, contingency, total hard cost, 30/35/40% margin prices, effective unit-rate sanity checks, recommended price and any review flags.

CUSTOMER OUTPUT
Keep internal costing hidden unless requested. Show clear scope, measurements, finish, important assumptions, ex-VAT price, VAT and total.

FINAL INTERNAL QUESTION
What will genuinely cost Furlads more on this site, and have I priced that actual cost once - not twice?
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
