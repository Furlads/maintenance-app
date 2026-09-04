# LOCKED BASELINE (do not break)

This repo is locked at tag: locked-baseline-auth-v1

Do NOT change:
- /proxy.ts auth + admin gating rules
- session cookie name ma_session behavior
- /api/auth/* routes logic
- role/admin rules (Trevor Fudger + Kelly Darby are admin)
- admin-only routes (/admin, /admin/workers, /settings)

## Quotes page behavior locked in
Do NOT regress the admin quotes page pricing display:
- Multi-option/package quotes must show each customer option as a separate price box.
- Where a combined package exists, show a separate highlighted `All together` box.
- Do not replace those boxes with one headline total for an open multi-option quote.
- Accepted quotes show the actual accepted total only.
- The Pipeline figure must use the `All together` combined price for every open package quote that has one.
- If an open quote has no all-together/combined price, use its normal commercial reference total as the fallback.
- The Booked in figure must continue to use actual accepted quote totals.

All UI/design work must be done on branch: design-phase-v1

If auth breaks, restore baseline:
git checkout locked-baseline-auth-v1
