# ADR 0033: Caregiver surfaces for heavy modules and branch-aware RAG

## Status

Accepted (SPRINT-SURFACES, April 2026)

## Context

Heavy Hermes bundles already persist branches, tools, evidence, and typed relations in Postgres (see ADR 0031). The product still behaved like a single flat article: branch selection was silent, tools and evidence were invisible on module pages, the weeks-focus picker ignored `weeks_focus_eligible`, SRS scheduling ignored per-module difficulty, and RAG retrieval only considered canonical `module_chunks`.

## Decision

1. **Module page surfaces (`apps/web`)** — For published modules, the authed module route loads tools, evidence for the rendered body, and `module_relations` edges. Heavy modules show a branch bar (tailored pill, optional `?branch=` preview), prerequisite / contradicts / follow-up / deeper blocks, inline citation affordances on markdown bodies, a collapsible evidence panel, and interactive tool renderers keyed by `tool_type`.

2. **Client-safe tool schemas** — Next client components must not import `@alongside/content` main entry (it re-exports Node-only CLI). The package exposes **`@alongside/content/tools`**, which only pulls Zod schemas and `getToolSchemaForType`. Tool components import types and validation from that subpath.

3. **`module_branch_chunks`** — Branch markdown is chunked and embedded at heavy publish time into **`module_branch_chunks`** (linked to `module_branches`), with JSON metadata including branch and axis keys for fit scoring.

4. **RAG retrieval (`packages/rag`)** — Search runs against canonical chunks and branch chunks in parallel, merges results, and applies care-profile axis fit. Layer 5 composition may include a `[branch: …]` attribution line when branch context is used.

5. **Picker / home** — Weeks-focus candidate query treats `weeks_focus_eligible` as eligible when `true` or `NULL` (legacy rows). Lesson start scheduling passes `srs_difficulty_bucket` into `scheduleOnLessonStart` (bucket mapping per sprint spec). Burnout soft-flag density (7-day) can surface a **`soft_flag_companion`** target module on the home screen as a warm appendix card.

## Consequences

- Operators must run migration **`0024_module_branch_chunks.sql`** and re-publish (or backfill) heavy modules so branch chunks exist before expecting branch-aware answers in production.
- Smoke / CI that runs `screens.smoke.test.ts` needs a prior **`pnpm --filter web build`** so `.next/BUILD_ID` exists and `next start` can boot.
- Per-user persisted tool state, Playwright visual regression, and eval pass-rate gates remain **follow-up tickets** unless explicitly added to CI.

## References

- Sprint plan: `SPRINT-SURFACES.md`
- Prior bundle contract: ADR 0031
