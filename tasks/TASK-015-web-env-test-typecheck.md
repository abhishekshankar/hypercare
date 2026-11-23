# TASK-015 — Web: `typecheck` green for `env.test-runtime` tests

- **Owner:** Cursor
- **Depends on:** —
- **Status:** done
- **Unblocks:** TASK-011 acceptance (`pnpm --filter web typecheck` in that ticket’s criteria)

---

## Problem

`pnpm --filter web typecheck` fails on `apps/web/test/lib/env.test-runtime.test.ts`: TypeScript treats `process.env.NODE_ENV` as read-only and rejects `delete process.env.NODE_ENV` and assignments. Vitest still runs the file successfully; `tsc --noEmit` does not.

---

## Done when

- `pnpm --filter web typecheck` passes.
- `pnpm --filter web test` still passes (same behavioral coverage for `isE2ETestRuntime()`).
- No production/runtime code changes unless strictly required; keep the fix scoped to the test harness (e.g. `vi.stubEnv` / `vi.unstubAllEnvs`, or another pattern that satisfies both Vitest and `tsc`).

**Verification:** Implementation uses `vi.stubEnv` / `vi.unstubAllEnvs` in `apps/web/test/lib/env.test-runtime.test.ts`. Run `pnpm --filter web build` before `pnpm --filter web test` locally (same order as CI: build then test) so `src/screens.smoke.test.ts` can spawn `next start` against a fresh `.next` output.

---

## Files

- `apps/web/test/lib/env.test-runtime.test.ts` (primary)
- Optionally `apps/web/vitest.config.*` / tsconfig only if the chosen pattern needs it

---

## Out of scope

- Cosmetic copy in TriageCard / `Composer` TODO (tracked as nits on TASK-011).
- Any other typecheck debt outside this test file.
