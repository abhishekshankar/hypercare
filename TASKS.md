# Hypercare — Sprint Board

**Sprint 1 goal:** Thin vertical slice — a signed-in caregiver can complete onboarding, see a home screen, ask one question about a seeded topic, and receive a **grounded** answer that includes the refusal path when sources are thin and the safety path when a crisis phrase is used.

**Sprint 1 is "proof the architecture works," not "the product is done."** Real DB, real Cognito auth (against the main project's pool), real retrieval over 3 seeded modules, real Bedrock calls, real classifier stub with one escalation flow wired.

## Status legend

`pending` → `in_progress` (Cursor owns it) → `in_review` (Cursor reports back, PM checks) → `done`

Cursor works tickets in **ID order**. Never start the next ticket until the previous one is `done`.

## Sprint 1

| ID       | Title                                                                                                                                                                                | Depends on | Status  | PR  |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------- | --- |
| TASK-001 | Monorepo scaffold, lint, typecheck, CI                                                                                                                                               | —          | done | `d2c79d3` |
| TASK-002 | Collect Cognito parameters from user + document                                                                                                                                      | —          | done | `0a26b61`+`e680353`+`02d94b4` |
| TASK-003 | CDK app, Aurora Serverless v2 + pgvector, dev env up                                                                                                                                 | 001        | done | `4eb9926`+`c5f2576`+`b5e4d3d`+`80704cd`+`e6c445c` |
| TASK-004 | Drizzle schema v0: users, care_profile, conversations, messages, modules, module_chunks, safety_flags                                                                                | 003        | pending | —   |
| TASK-005 | Next.js app skeleton, Tailwind, 8-screen route stubs, persistent crisis strip                                                                                                        | 001        | done | `a4d282d` |
| TASK-006 | Cognito auth wired (Amplify Auth v6), protected routes, server-side session                                                                                                          | 002, 005   | done    | —   |
| TASK-007 | Onboarding flow (5 sections from PRD §5), writes to care_profile                                                                                                                     | 004, 006   | done    | —   |
| TASK-008 | Content loader: ingest 3 seeded pilot modules (PRD §7.4), chunk, embed, store in pgvector                                                                                            | 003, 004   | done    | —   |
| TASK-009 | RAG pipeline v0: query classifier (Layer 2) + retrieval (Layer 3) + grounding check (Layer 4) + prompt composition (Layer 5) + post-gen verification (Layer 6) + refusal path (§9.3) | 008        | done    | —   |
| TASK-010 | Safety classifier stub + one escalation flow (caregiver self-harm, PRD §10.3) end-to-end                                                                                             | 009        | done    | —   |
| TASK-011 | Home screen + Ask-anything input + Conversation screen rendering the §6.4 response scaffold + source attribution                                                                     | 009, 010   | done    | —   |
| TASK-012 | Eval harness v0: golden-set scoring for retrieval, safety, and end-to-end answers (see `tasks/TASK-012-eval-harness.md`, ADR 0011)                                                      | 009, 010   | done    | —   |
| TASK-013 | Playwright: no-op canonical-origin redirect in middleware when `PLAYWRIGHT_TEST_BASE_URL` is set (avoids `next dev` loop); see `tasks/TASK-013-playwright-canonical-redirect.md` | —          | done      | —   |
| TASK-014 | Onboarding E2E: diagnosis `<select>` spec aligned with `step-1-form.tsx` (no TASK-013 coupling); see `tasks/TASK-014-onboarding-e2e-diagnosis-alignment.md` | —          | open      | —   |
| TASK-015 | Web: `tsc --noEmit` green — fix `env.test-runtime.test.ts` mutating readonly `process.env` / `delete` (see `tasks/TASK-015-web-env-test-typecheck.md`)                              | —          | done    | —   |
| TASK-016 | RAG: surface underlying cause on `internal_error` to operator log + eval report (warn hook in `runPipeline` catch; `reason_detail` in answers eval) — see `tasks/TASK-016-rag-internal-error-observability.md` | —          | pending   | —   |
| TASK-017 | RAG: thread Bedrock `usage` (input/output tokens) through `runPipeline.AnswerResult` so eval and chat-route can surface real token counts (currently nulled in live mode) — see `tasks/TASK-017-rag-usage-tokens.md` | —          | pending   | —   |
| TASK-018 | Safety: short-circuit Layer B classifier on empty/whitespace text (eliminates spurious `safety.llm.invoke_failed` warns) — see `tasks/TASK-018-safety-empty-text-shortcircuit.md` | —          | pending   | —   |

**Sprint 1 vertical slice (TASK-001 → TASK-015) is done.** Open follow-ups (TASK-014, TASK-016, TASK-017, TASK-018) are scoped, ticketed, and not blocking the slice.

## Out of sprint 1 (explicitly deferred)

- Daily lesson surface (Screen 5) — sprint 2.
- Library screen — sprint 2.
- Editable care profile UI beyond read-only — sprint 2.
- Help & safety screen beyond the persistent crisis strip — sprint 2.
- Full 100-query red-team set — sprint 2 (20-query seed is enough to prove the harness).
- Content review workflow / authoring tool — sprint 3.
- All 50 modules — content team deliverable, parallel track.

## Flow per ticket

1. PM writes `tasks/TASK-NNN-slug.md`, sets status `pending`.
2. User pastes the ticket contents into Cursor.
3. Cursor sets status → `in_progress` (by editing this table in its PR, or reports it back verbally), does the work.
4. Cursor reports back using the format in `PROJECT_BRIEF.md §7`.
5. PM verifies: reads the diff, runs "How to verify," checks acceptance criteria.
6. PM sets status → `done`, unblocks next ticket, or sends revisions.

## Open questions PM is tracking (not blocking sprint 1)

- Pricing model (PRD §14). Does not affect the build.
- Exact wording of the 8 stage-assessment questions (PRD §5.2, §14). We ship the PRD's draft wording; Care Specialist refines in sprint 2.
- Privacy posture / data retention policy. Needed before any real user, not before the dev slice.

## Incident log

- **2026-04-21 — Aurora admin password exposure (TASK-003 verification).** Cursor printed the Secrets Manager `password` field to its tool output while testing `aws secretsmanager get-secret-value`. PM rotated: `aws rds modify-db-cluster --master-user-password …` → new version `9634d385-dee8-4411-bccd-4f8b7b1d9da3` of `HypercareDatadevDatabaseClu-AivEHTsPYQF4-eKhC8O` is `AWSCURRENT`. Old password is dead. `PROJECT_BRIEF.md §8` updated: Cursor must never fetch/print secret values.
