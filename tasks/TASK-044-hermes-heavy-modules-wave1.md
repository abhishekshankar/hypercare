# TASK-044 — Hermes wave 1: heavy module schema, validation, publish, library read

**Status:** `in_review`  
**Branch:** `task/TASK-044-hermes-heavy-wave1`  
**Depends on:** — (HERMES-03 corpus out of scope)

## Scope (bundled HERMES-01 / 02 / 02b / 04)

1. **HERMES-01** — SQL migration `0023_heavy_modules.sql` (0022 already used), Drizzle tables `module_branches`, `module_tools`, `module_relations`; extend `modules`, `module_evidence`; journal + exports.
2. **HERMES-02** — `validateHeavyModule` + disk parse; fixture copy under `packages/content/test/fixtures/` only (do not edit `content/modules/transitions-first-two-weeks/`).
3. **HERMES-02b** — Zod tool schemas in `packages/content/src/tools/` + `getToolSchemaForType`.
4. **HERMES-04** — `publishHeavyModulePayload` / disk path; `POST /api/internal/content/publish-bundle` with internal auth; library module page uses `selectHeavyBranchMarkdown` when `modules.heavy` and session user.

## Acceptance criteria

- [x] Migration applies cleanly; Drizzle matches SQL — `packages/db/migrations/0023_heavy_modules.sql`, `packages/db/src/schema/module-*.ts`.
- [x] `pnpm --filter @alongside/content test` includes fixture parse + validate + branch selection — `packages/content/test/heavy-bundle.test.ts`.
- [x] `pnpm --filter @alongside/content load -- --heavy <slug>` publishes fixture counts (6 branches, 2 tools, 8 evidence, 5 relations) when DB has relation targets or `--seed-relation-targets` — `packages/content/src/cli.ts`.
- [x] `POST /api/internal/content/publish-bundle` accepts Hermes JSON bundle shape — `apps/web/src/app/api/internal/content/publish-bundle/route.ts`.
- [x] `docs/schema-v2.md` documents new tables (schema-doc-coverage green).
- [x] `pnpm lint && pnpm typecheck && pnpm test` green.

## How to verify

1. Apply migrations; set `DATABASE_URL_ADMIN`.
2. `pnpm --filter @alongside/content load -- --heavy transitions-first-two-weeks` (from repo root; add `--seed-relation-targets` if related modules are absent).
3. SQL: one `modules` row with `heavy = true`; counts on child tables as in sprint brief.
4. Signed-in user with care profile `(early, parent, with_caregiver)` opens `/app/modules/transitions-first-two-weeks` — body matches co-resident parent branch.

## Out of scope

- HERMES-03 corpus ingestion / `packages/content/corpus/*`.
