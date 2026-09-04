# LOCKED BASELINE (do not break)

This repo has a protected working baseline. Treat the current production behaviour and visual rules below as non-negotiable unless Trevor explicitly asks to change them.

Existing auth recovery tag: `locked-baseline-auth-v1`

## Authentication and access — LOCKED
Do NOT change:
- `/proxy.ts` auth + admin gating rules.
- Session cookie name `ma_session` behaviour.
- `/api/auth/*` route logic, except additive profile/read-only helpers that preserve existing login behaviour.
- Role/admin rules: Trevor Fudger + Kelly Darby are admin.
- Admin-only access rules for `/admin`, `/admin/workers`, `/settings` and other protected admin routes.

## Quotes page behaviour — LOCKED
Do NOT regress the admin quotes page pricing display:
- Multi-option/package quotes must show each customer option as a separate price box.
- Where a combined package exists, show a separate highlighted `All together` box.
- Do not replace those boxes with one headline total for an open multi-option quote.
- Accepted quotes show the actual accepted total only.
- The Pipeline figure must use the `All together` combined price for every open package quote that has one.
- If an open quote has no all-together/combined price, use its normal commercial reference total as the fallback.
- The Booked in figure must continue to use actual accepted quote totals only.

## Admin / office visual system — LOCKED
The current direction is based on Trev's dashboard and must be preserved across admin pages:
- Light page background with clean white content cards.
- Dark/black readable body text as the default.
- Furlads yellow used as the primary accent.
- Rounded cards/panels and clear spacing similar to `/trev`.
- Do not reintroduce the old full dark/navy admin page treatment.
- No white body text on admin content pages. Avoid `text-white` in content areas so white-on-white cannot occur.
- Dark buttons are allowed, but their label colour should use Furlads yellow or another high-contrast non-white colour.
- Logged-in-user identity must remain visible in the admin header.
- Show the logged-in person's photo when a known profile image exists.
- Existing known profile images include Trevor, Kelly, Steve and Jacob; preserve that mapping unless deliberately replaced with a proper profile-photo system.

## General regression rule — LOCKED
Before changing an already-working area, preserve its current behaviour unless Trevor explicitly requests a change. New work should be additive and should not undo previously approved UI, pricing, authentication, scheduling or role behaviour.

Do not interpret a later broad instruction such as "make it nicer", "tidy it up" or "carry on" as permission to remove or reverse any rule in this file.

If a requested change conflicts with a locked rule, keep the locked behaviour and only change it when Trevor explicitly identifies that specific rule/feature for alteration.

If auth breaks, the historical auth recovery point is:
`git checkout locked-baseline-auth-v1`
