# TASK-014 — Onboarding Playwright: keep diagnosis select aligned with the form fixture

- **Status:** open
- **Blocks:** None (quality / flake prevention)
- **Related:** TASK-007 (onboarding), TASK-013 (E2E infra — do not conflate with this task)

---

## Problem

The onboarding E2E spec (`apps/web/test/e2e/onboarding.spec.ts`) drives the step-1 diagnosis `<select>` via `selectOption(...)`. If `<option value="...">` or visible labels in `apps/web/src/components/onboarding/step-1-form.tsx` drift from what the spec assumes, the test fails opaquely or selects the wrong row. That is **test-vs-fixture drift**, a different bug class than canonical-redirect / middleware plumbing (TASK-013).

---

## Preferred fix

- Align the spec with the canonical option **values** in `step-1-form.tsx` (prefer value-based `selectOption` over brittle label text where possible).
- Optionally add a one-line comment in the spec pointing at `step-1-form.tsx` so the next copy change updates both places.

---

## Acceptance

- `pnpm --filter web exec playwright test onboarding` passes against `next dev` with the same `e2e-server-env` / `DATABASE_URL` setup as other E2E specs.
- No changes to TASK-013 files required for this task.
