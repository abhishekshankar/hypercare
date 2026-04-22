# ADR 0023 — Onboarding stage questions v1 (TASK-034)

## Context

Sprint 2 shipped eight yes/no/unsure questions in `care_profile.stage_answers` (ADR 0005). The PRD §5.2 / §14 calls for Care Specialist–signed behavioral wording, ordinal answer shapes, and a validation study. TASK-034 lands v1 columns, unified inference, and a deterministic v0→v1 mapping for existing rows.

## Decision — question set and storage

- **Wording** lives in `apps/web/src/lib/onboarding/questions-v1.ts` (must match `docs/content/stage-questions-v1.md` when PM adds the signed file).
- **Persistence**: typed columns on `care_profile` with CHECK constraints; `stage_questions_version` (`0` = legacy JSON, `1` = v1). Legacy `stage_answers` is retained (empty for new v1 rows) for the migration window.
- **Alone-safety (Q3)**: multi-select `text[]` with allowed chips `nothing | wandering | falls | cooking | medication_mistakes | other`. Only the sole selection `['nothing']` is treated as “safe to leave alone” for inference; any other set implies supervision concerns.

## Decision — v1 inference (summary)

Behaviorally aligned with ADR 0005:

- **Late**: at least two of {recognition `rarely`, bathing `hands_on_help`, conversation `rarely_makes_sense`, wandering in `once | few_times | often`} **and** alone-safety is not “only nothing”.
- **Middle**: any of: meds not `self`, bathing not `on_own`, alone-safety not only `nothing`, any wandering frequency, conversation `only_short`, sleep not `sleep_through`.
- **Early**: not late, not middle, and at least 5/8 “answered” (same bar as v0 for minimum signal).
- **Driving** is captured for the caregiver read-back; it is **not** a primary inference input (matches v0, which only surfaced driving in the summary copy).

`inferInferredStage` in `@hypercare/content` reads `stage_questions_version` and either runs v0 on `stage_answers` or v1 on typed columns. RAG and the picker use the same helper.

## Decision — v0 → v1 mapping (migration)

Documented in code: `mapStageAnswersV0ToV1` in `@hypercare/content`. Conservative where v0 is ambiguous (e.g. `manages_meds: no` → `reminders`, not `hands_on_help`).

One-shot script: `pnpm --filter @hypercare/db migrate:stage-v1` (dry-run default; `--commit` to write). The script reports how many `inferred_stage` values differ from the prior value; if the flip rate is high, pause and review rules with the Care Specialist before committing.

## Consequences

- **Sprint 5 (planned)**: remove the v0 inference path and optionally clear denormalized `stage_answers` for v1-only rows.
- **i18n**: strings are English-only; `questions-v1.ts` is structured for future translation.

## Related

- ADR 0005 (original rules)
- `docs/content/stage-questions-v1.md` (signed copy)
- `docs/content/stage-questions-validation.md` (session notes, redacted)
