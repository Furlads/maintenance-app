# LOCKED BASELINE (do not break)

This repo is locked at tag: locked-baseline-auth-v1

Do NOT change:
- /proxy.ts auth + admin gating rules
- session cookie name ma_session behavior
- /api/auth/* routes logic
- role/admin rules (Trevor Fudger + Kelly Darby are admin)
- admin-only routes (/admin, /admin/workers, /settings)

All UI/design work must be done on branch: design-phase-v1

If auth breaks, restore baseline:
git checkout locked-baseline-auth-v1