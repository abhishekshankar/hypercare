# TASK-043 — Schema v2 (consolidated documentation of Sprint 5 schema deltas)

- **Owner:** Cursor
- **Depends on:** TASK-037 (lesson_review_schedule + the bucket/interval table), TASK-038 (care_profile_members + invite_tokens + the share-preference columns), TASK-039 (safety_ft_shadow_decisions + the feedback.safety_relabel column), TASK-042 (model_routing_decisions + users.routing_cohort)
- **Unblocks:** the Sprint 5 quality gate that schema deltas land in `docs/schema-v*.md`; future maintainers reading "what is the data model in April 2026"; Sprint 6 planning, which needs a settled v2 surface to extend
- **Status:** pending (intentionally last in the sprint — captures what shipped, not what was planned)
- **ADR:** none new; this ticket's job is to *document* decisions made under the other Sprint 5 ADRs (0026–0030)

---

## Why this exists

The Sprint 4 quality gate established a convention: schema deltas land in `docs/schema-v1.md`, and we fork into `schema-v2.md` if v1 grows past ~600 lines (`TASKS.md` line 165). Sprint 5 introduces five schema additions across four tickets. Without a consolidating ticket they would each touch `schema-v1.md` independently and the file would balloon past the threshold mid-sprint, with no clean fork point.

This ticket exists to:

1. Decide the fork: stay on v1 or open `schema-v2.md`. The default given the Sprint 5 surface area is to fork.
2. Land all Sprint 5 schema additions in one place after the underlying tickets ship, so the PR diff is reviewable as a single coherent v2 surface.
3. Update cross-references in `prd.md`, `ARCHITECTURE.md`, and the affected ADRs to point at the new schema-of-record location.
4. Mark for-removal columns (per TASK-038's `care_profile.user_id` deprecation) explicitly so the Sprint 6 cleanup ticket has a clear scope.

This is documentation work, not migration work. Each underlying ticket ships its own migration (0013–0015). This ticket adds no migrations.

---

## Context to read first

1. `docs/schema-v1.md` — the current document; its size determines the fork decision.
2. `docs/schema-v0.md` — for the historical "how we wrote v0/v1 transitions" tone; keep the same voice.
3. The four upstream tickets: TASK-037, TASK-038, TASK-039, TASK-042. Specifically the data-model sections.
4. The four ADRs: 0026 (SRS), 0027 (family sharing), 0028 (fine-tuned classifier), 0030 (model routing). 0029 (streaming for lessons + library) does not introduce schema; included for completeness in cross-references.

---

## What "done" looks like

### 1. Decide the fork

Open `docs/schema-v2.md` if `schema-v1.md` is at or above ~600 lines after the upstream tickets land. Otherwise extend `schema-v1.md` in place and add a "Sprint 5 additions" section header.

The strawman, given Sprint 5's five new tables and one column addition, is to **fork** even if v1 lands at 540 lines. Forking gives Sprint 6 a clean baseline; staying in v1 saves a file but adds friction every time someone needs to find a Sprint 5 column. Confirm the call in the PR description.

If forking, `schema-v1.md` keeps everything currently in it and gains a one-line top note: *"Schema v2 in `docs/schema-v2.md` extends this. v1 remains accurate; v2 adds without modifying."* No content moves between files.

### 2. Document the new tables

Each table gets a section in the same shape as v1's existing entries: name, columns + types + constraints, indexes, relationships, retention notes, and a "why" paragraph cross-referencing the originating ticket and ADR.

Tables to document (the `CREATE TABLE` SQL is sourced from the upstream tickets; this doc is the prose-explained version, not a migration script):

- `lesson_review_schedule` (TASK-037 / ADR 0026): per-user-per-module bucket + due_at; bucket interval table inlined for reference; the unique constraint and the upsert semantics.
- `care_profile_members` (TASK-038 / ADR 0027): the join table, the partial unique index, the role enum, the per-member share preference columns. The default-share posture table from TASK-038 §2 copied verbatim into the schema doc — that table is a load-bearing description of how the data is *read*, not just *stored*.
- `invite_tokens` (TASK-038 / ADR 0027): single-use, 7-day TTL, consumed-on-accept; the lifecycle states.
- `safety_ft_shadow_decisions` (TASK-039 / ADR 0028): hash + verdicts + latencies; 30-day retention.
- `model_routing_decisions` (TASK-042 / ADR 0030): the decision log; 90-day retention; the `cost_estimate_usd` methodology cross-referenced to ADR 0030.

### 3. Document the column additions

- `feedback.safety_relabel` (TASK-039 / ADR 0028): nullable text; values are the bucket enum from TASK-039 §1; populated by Care Specialist via `/internal/feedback`.
- `users.routing_cohort` (TASK-042 / ADR 0030): nullable text; values `routing_v1_control | routing_v1_treatment`; backfilled 50/50 deterministically per the migration.

### 4. Document the deprecation

`care_profile.user_id` (since pre-Sprint-1) is deprecated in favor of `care_profile_members` (TASK-038). Document:

- The column still exists and is still populated by legacy write paths during Sprint 5.
- All read paths in Sprint 5 read from `care_profile_members`; `care_profile.user_id` is not read by application code post-TASK-038 merge.
- Removal scheduled for Sprint 6 in a follow-up ticket once a verification window confirms zero application reads (a one-line query log search across the period).

### 5. Document the relationships

A relationship section (matches v1's "Relationships" subsection) updated for v2:

- A `users` row can be a member of zero or one `care_profile` (multi-membership not supported in v1; documented here for the future).
- A `care_profile` has 1..4 members (cap from TASK-038 §"Decisions"); exactly one with `role='owner'` at any time.
- A `messages` row may have a `model_routing_decisions` row (1:0..1); routing is recorded post-stream and may be absent for refusal-path turns.
- A `feedback` row may have a `safety_relabel` value if the originating turn had a `safety_flags` row.
- A `lesson_progress` row corresponds to at most one `lesson_review_schedule` row per (user, module).

### 6. Cross-reference updates

- `prd.md`: where the PRD references "the care profile is single-user" or similar v0 framings, add a footnote pointing at `schema-v2.md` and TASK-038. Do not rewrite the PRD; the PRD's narrative is preserved.
- `ARCHITECTURE.md`: update the data-model section to point at v2 as the current schema-of-record.
- ADRs 0026, 0027, 0028, 0030: each gets a one-line "schema documented in `docs/schema-v2.md` §<table>" footer.
- `docs/safety/` content unchanged — those docs reference behavior, not schema.
- `CONTRIBUTING.md`: update the "schema deltas land in" guidance to name v2 (or v1 §"Sprint 5 additions" if no fork).

### 7. The retention table

A consolidated retention table at the end of v2 (matches the v1 retention summary), updated:

| Table                          | Retention | Source       |
| ------------------------------ | --------- | ------------ |
| messages                       | indefinite (per ADR 0021) | v0          |
| safety_flags                   | 90 days   | ADR 0021     |
| safety_ft_shadow_decisions     | 30 days   | ADR 0028     |
| model_routing_decisions        | 90 days   | ADR 0021 (matched), ADR 0030 (justified) |
| feedback                       | indefinite (PII redacted per ADR 0021) | TASK-036 |
| lesson_review_schedule         | indefinite (no PII)        | ADR 0026 |
| care_profile_members           | indefinite                  | ADR 0027 |
| invite_tokens (consumed)       | 30 days post-consumption    | ADR 0027 |
| invite_tokens (unconsumed expired) | pruned daily             | ADR 0027 |

If any retention is wrong against the upstream ticket, the ticket wins and this doc is patched.

---

## Tests

This ticket ships documentation, not code. The "tests" are:

- A doc-lint pass (`pnpm docs:lint`) ensures all internal `[…](docs/…)` links resolve, including the new v2 file and the cross-references.
- A small `packages/db/test/schema-doc-coverage.test.ts` (new): for every table referenced by application code (via Drizzle's introspected schema), assert the table appears in either `schema-v1.md` or `schema-v2.md`. Catches "we shipped a table but forgot to document it" — a real Sprint 4 footgun (the `safety_flags` table was undocumented for two weeks before someone noticed). The test reads the markdown files as text and grep-asserts on `### <table_name>` headings.
- A README badge or summary line in `docs/README.md` (if present, otherwise top of `docs/schema-v2.md`) indicating the schema-of-record version.

---

## Acceptance criteria

- `docs/schema-v2.md` exists (or `schema-v1.md` is updated with a clearly-marked Sprint 5 section, per the §1 decision).
- All five new tables and two new columns documented with the same shape as existing v1 entries.
- `care_profile.user_id` deprecation is called out with the Sprint 6 removal plan.
- Cross-references updated in `prd.md`, `ARCHITECTURE.md`, and ADRs 0026–0030.
- Retention table consolidated and accurate against the underlying tickets.
- `pnpm docs:lint` passes; the new `schema-doc-coverage.test.ts` passes.
- `pnpm lint typecheck test` green.

---

## Out of scope

- Migrations. Each upstream ticket owns its migration. This ticket adds no migration scripts.
- ADRs. This ticket references the four Sprint 5 ADRs but does not author a new one.
- Refactoring `schema-v1.md`. We add and cross-reference; we do not move existing v1 content.
- A schema diagram. The text is the source of truth; if a future ticket wants an ER diagram, that's its problem.
- Application code changes. If a documentation pass surfaces a missing index or wrong type, file a follow-up ticket; do not patch in this PR.
- The `care_profile.user_id` removal itself. Documented here as deprecated; Sprint 6 removes it.

---

## Decisions to make in the PR

- **Fork or extend.** The §1 strawman says fork. PR description records the line count of `schema-v1.md` post-upstream-merges and confirms the call.
- **Whether the share-posture table from TASK-038 §2 lives in v2's schema doc, in ADR 0027, or both.** Strawman: both. The schema doc is where someone reading the data model needs to see how it's *interpreted*; the ADR is where the decision is *recorded*. Duplication is acceptable when the duplicated content is the load-bearing privacy posture.
- **Cost-estimate methodology placement.** The `model_routing_decisions.cost_estimate_usd` column needs a methodology somewhere. Strawman: in ADR 0030 (the routing ADR), referenced from the schema doc. Avoids embedding pricing tables in the schema-of-record.

---

## Questions for PM before starting

1. **Fork confirmation.** Strawman is to fork to v2 even if v1 stays under 600 lines. Confirm.
2. **Whether to rename `feedback.safety_relabel`** to `feedback.safety_relabel_bucket` for clarity. Trivially renameable now (column was added in TASK-039); painful to rename later. PM call.
3. **Whether the schema-doc-coverage test is a Sprint 5 ship** or a Sprint 6 follow-up. Strawman: ship now; the cost is small and it prevents the Sprint 4-style undocumented-table footgun. Confirm.
4. **Whether to backport the schema-doc-coverage test** to flag any v0/v1 tables that are referenced by code but undocumented. Strawman: yes, in this PR; it might surface latent gaps.

---

## How PM verifies

1. Open `docs/schema-v2.md`. Confirm the five new tables and two new columns are present with the v1-style sections.
2. Spot-check three cross-references — open `prd.md`, `ARCHITECTURE.md`, and ADR 0027 — confirm each points at v2 in the right place.
3. Confirm `care_profile.user_id` is documented as deprecated with the Sprint 6 removal plan.
4. Run `pnpm docs:lint` locally; confirm green.
5. Run `pnpm --filter @hypercare/db test packages/db/test/schema-doc-coverage.test.ts`; confirm green. Then mutate `schema-v2.md` to remove one table heading and confirm the test fails — proves the coverage assertion is real.
6. Confirm the retention table matches the ticket-level retention claims for all five new tables.
