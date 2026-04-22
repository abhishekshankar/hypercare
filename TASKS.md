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
| TASK-014 | Onboarding E2E: diagnosis `<select>` spec aligned with `step-1-form.tsx` (no TASK-013 coupling); see `tasks/TASK-014-onboarding-e2e-diagnosis-alignment.md` | —          | done      | —   |
| TASK-015 | Web: `tsc --noEmit` green — fix `env.test-runtime.test.ts` mutating readonly `process.env` / `delete` (see `tasks/TASK-015-web-env-test-typecheck.md`)                              | —          | done    | —   |
| TASK-016 | RAG: surface underlying cause on `internal_error` to operator log + eval report (warn hook in `runPipeline` catch; `reason_detail` in answers eval) — see `tasks/TASK-016-rag-internal-error-observability.md` | —          | done   | —   |
| TASK-017 | RAG: thread Bedrock `usage` (input/output tokens) through `runPipeline.AnswerResult` so eval and chat-route can surface real token counts (currently nulled in live mode) — see `tasks/TASK-017-rag-usage-tokens.md` | —          | done   | —   |
| TASK-018 | Safety: short-circuit Layer B classifier on empty/whitespace text (eliminates spurious `safety.llm.invoke_failed` warns) — see `tasks/TASK-018-safety-empty-text-shortcircuit.md` | —          | done   | —   |

**Sprint 1 closed.** Vertical slice plus all four follow-ups (014/016/017/018) are done. Sprint 2 starts below.

## Sprint 2

**Sprint 2 goal:** Prove the **caregiver retention loop** (PRD §3.1, §3.3, §6.3, §6.5). A returning caregiver lands on a personalized "this week's focus" card, takes a 5-minute lesson, completes a weekly check-in, and the system captures the north-star behavior-change signal. Around that loop, the supporting cast: the editable care profile (so the picker reads from something the user actually controls), the full Help & Safety screen (because it backstops the lesson surface and the PRD §6.8 promise), and a Library v0 (so users have a "look something up quietly" mode).

**Sprint 2 explicitly does not** add new modules (content team is parallel — engineering plans for the existing 3 seeded modules and ingests more transparently when they land), expand the red-team set beyond the 20-query seed, build a content authoring/review tool, ship streaming, ship multi-turn conversation memory, or touch mobile-native.

| ID       | Title                                                                                                                                                          | Depends on              | Status  | PR  |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------- | --- |
| TASK-019 | Schema v1: `lesson_progress`, `weekly_checkins`, `module_topics`, evolved `care_profile` change-log; topic taxonomy seeded                                     | 004                     | in_review | —   |
| TASK-020 | Editable care profile UI (Screen 7) — section-by-section edit + "My situation has changed" evolved-state flow + change-log writes                              | 007, 019                | in_review | —   |
| TASK-021 | Help & Safety screen (Screen 8) — full surface per PRD §6.8 + caregiver-burnout self-assessment that emits soft-flag signal into safety log                    | 010                     | in_review | —   |
| TASK-022 | Topic classifier + recent-topics signal: classify the last N user messages into the §7.1 taxonomy; expose `getRecentTopicSignal(userId)` for the lesson picker | 009, 019                | in_review | —   |
| TASK-023 | Library screen (Screen 6) — searchable index over `modules`, organized by §7.1 category with stage filter; works with 3 modules and scales transparently      | 008, 019                | in_review | —   |
| TASK-024 | "This week's focus" picker + Daily Lesson surface (Screen 5) + weekly check-in card on `/app` — the retention loop end-to-end                                  | 011, 019, 020, 022, 023 | done    | —   |

### Sprint 2 success criteria (the demo)

1. A returning caregiver opens `/app`. The greeting is personalized. The "This week's focus" card shows a module that is **not random** — it reflects their stage and what they've been asking about.
2. Tapping the card opens a 5-minute lesson with the §6.5 structure (60s setup → 2–3 min cards → 30s "try this today" → close).
3. After the lesson closes, a `lesson_progress` row exists for that user + module with `completed_at`.
4. Within 7 days of any lesson, the home screen surfaces a one-question weekly check-in ("Did you try something this week that helped?"). The answer writes a `weekly_checkins` row.
5. The user can navigate to `/app/library`, search for "bathing", filter to middle-stage, and see the seeded modules with the right metadata.
6. The user can navigate to `/app/profile`, change "What's the hardest thing right now?" from "sleep" to "guilt," save, and the next "this week's focus" pick reflects the change.
7. The user can navigate to `/help` and see the full §6.8 surface, including a caregiver-burnout self-assessment that, when scored high, surfaces in the safety-flag log as a soft flag (PRD §10.4).
8. **Three** lessons completed by the same user in a 14-day window do not surface the same module twice unless the user explicitly opens it from the library.

### Sprint 2 quality gates

- `pnpm lint && pnpm typecheck && pnpm test` green at every PR merge (per `PROJECT_BRIEF.md §6`).
- `EVAL_LIVE=1 pnpm --filter @hypercare/eval start -- answers` does not regress on retrieval / safety pass rates from the sprint-1 baseline. The check-in and lesson surfaces are not graded by the eval harness but should not break it.
- ADR per ticket where a new design surface is introduced (TASK-019 schema v1, TASK-022 topic classifier, TASK-024 picker policy at minimum).
- No new `any`s, no new top-level `eslint-disable` lines; new schema columns documented in `docs/schema-v0.md` (or rolled into `docs/schema-v1.md` if the file grows).

### Out of sprint 2 (explicitly deferred to sprint 3)

- Spaced repetition / SRS over lesson techniques (PRD §1.3 — already deferred at the product level).
- Content review / authoring tool.
- Conversation memory threaded into retrieval (each `rag.answer()` is still a fresh call — TASK-024's picker reads conversation messages but the answer pipeline does not).
- Streaming responses, voice input, dark mode.
- Family / multi-caregiver sharing (PRD §4.1).
- Spanish content (PRD §1.3).
- Full 100-query red-team set — still the 20-query seed.
- Push notifications / reminders for the weekly check-in (in-app surface only).

## Sprint 3

**Sprint 3 goal:** **Get Hypercare ready to put in front of a first cohort of real caregivers.** That means closing the launch gates the PRD names explicitly: the full set of escalation flows (PRD §10.3 — today only caregiver self-harm is wired end-to-end), the 100-query red-team eval (PRD §10.5 — today 20), and conversation memory threaded into retrieval (PRD §9 — today every answer is a fresh call and returning users re-explain their situation every turn). Around those, two enabling surfaces: a content authoring/review tool v0 so the content team can ship the next batch of modules without dev handholding (PRD §8, unblocks the 30–50 module ramp), and an internal metrics surface that reports the north-star trio (helpfulness / return / behavior-change) from real data.

**Sprint 3 explicitly does not** ship new modules beyond what the content team delivers through the new authoring tool (engineering ingests, does not write), pursue spaced repetition, build family/multi-caregiver sharing, ship streaming/voice/dark-mode, touch mobile-native, or add Spanish content. It also does not replace the lesson picker policy — TASK-024's picker stays as-is; TASK-027 only feeds it richer signal.

| ID       | Title                                                                                                                                                                 | Depends on                   | Status  | PR  |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------- | --- |
| TASK-025 | Escalation flows v1 — ship the 5 remaining PRD §10.3 flows (CR-in-danger, elder-abuse / caregiver-breaking-point, dangerous-request, medical-emergency, financial-exploitation) end-to-end with pre-scripted UI, versioned scripts, per-category 48h follow-up suppression | 010, 021                     | done | —   |
| TASK-026 | Red-team eval expansion to 100 queries (PRD §10.5) — 6 category buckets + soft-flag gray zone + external-reviewer round; `EVAL_LIVE=1` gate at ≥90% pass, block merge below threshold on the new set | 012, 025                     | pending | —   |
| TASK-027 | Conversation memory into retrieval — rolling caregiver-state summary per conversation, threaded into Layer 5 prompt composition; invalidated on profile change-log entries; capped + observability for leakage | 009, 019, 022                | pending | —   |
| TASK-028 | Content authoring / review tool v0 (PRD §8.3 pipeline surfaced as an internal web tool) — draft → edit → expert review → lived-experience review → publish, with evidence-table entry, review-metadata writes, and auto-ingest into `module_chunks` on publish | 008, 021                     | pending | —   |
| TASK-029 | Internal metrics surface (PRD §12) — `/internal/metrics` route behind admin role showing helpfulness rate, W2/W4/W8 return, weekly check-in yes-rate, refusal rate, safety-flag counts by category, retrieval Tier-1 share; reads Postgres directly, no new warehouse | 011, 019, 024                | pending | —   |
| TASK-030 | Saved answers + "Things I want to revisit" surface on `/app` (PRD §6.3, §6.4 "Save this" button already renders but doesn't persist) — persistence, home-screen section, unsave, search across saves | 011, 019                     | pending | —   |

### Sprint 3 success criteria (the demo)

The demo is the **closed-beta readiness walkthrough.** Run it end-to-end:

1. **Escalation coverage.** For each of the 5 remaining PRD §10.3 categories, send a representative red-team query. Each routes to the correct pre-scripted UI with the right primary resource (911 / APS / doctor-callback flow / helpline). Each writes a `safety_flags` row with the correct category and `source`. For 24h after a caregiver-self-harm or caregiver-breaking-point flag, the home screen's "this week's focus" and daily-lesson prompts are suppressed in favor of the gentle "I'm here when you're ready" surface (PRD §10.3).
2. **Red-team pass rate.** `EVAL_LIVE=1 pnpm --filter @hypercare/eval start -- redteam` runs the full 100-query set and reports ≥ 90%. The run is reproducible — same seed, same result within ± 1 query.
3. **Conversation memory.** A caregiver has a 4-turn conversation about sundowning, then asks "what about the nighttime pacing?" 6 hours later. The answer references what was discussed earlier ("Since we were just talking about Margaret's sundowning…") without the user re-stating context. The memory is observable in the conversation-debug view; it is bounded (≤ 400 tokens) and invalidated within 60s of a profile change-log write.
4. **Content tool.** The Content Lead logs into `/internal/content`, drafts a new module from a brief, routes it through expert and lived-experience review, and hits publish. The module appears in `/app/library` within a minute and becomes retrievable — a question that matches its topic pulls it as the top Tier-1 chunk.
5. **Metrics dashboard.** `/internal/metrics` shows live counts for the sprint-2 cohort: ≥ 1 completed lesson, ≥ 1 weekly check-in, ≥ 1 helpful thumbs-up, refusal rate, flag counts. Every tile links to the SQL behind it (transparency).
6. **Saved answers.** A caregiver saves two answers from `/app/conversation/…`, sees them on `/app` under "Things to revisit," searches across them, and unsaves one. Persistence survives reload.

### Sprint 3 quality gates

- `pnpm lint && pnpm typecheck && pnpm test` green at every PR merge (per `PROJECT_BRIEF.md §6`).
- `EVAL_LIVE=1 pnpm --filter @hypercare/eval start -- answers` stays ≥ sprint-2 baseline on retrieval and safety. The new `redteam` mode (TASK-026) gates at ≥ 90%.
- **Safety / escalation content is versioned and expert-signed.** Each script in `packages/safety/src/scripts/*.md` carries a `reviewed_by`, `reviewed_on`, `next_review_due` frontmatter; CI fails if a script body changes without bumping `reviewed_on` (TASK-025).
- ADRs: 0015 (escalation-scripts + suppression), 0016 (red-team set structure), 0017 (conversation memory), 0018 (content-authoring tool), 0019 (metrics surface).
- No new `any`s, no new top-level `eslint-disable` lines; schema deltas documented in `docs/schema-v1.md`.

### Out of sprint 3 (explicitly deferred to sprint 4 or later)

- Spaced repetition / SRS — still deferred at the PRD level (§1.3).
- Streaming answer rendering, voice input, dark mode.
- Family / multi-caregiver sharing (PRD §4.1).
- Spanish content (PRD §1.3).
- Push notifications, email reminders, any out-of-app nudge.
- Native mobile apps.
- Real-user analytics warehouse (posthog / amplitude). TASK-029 reads Postgres directly; a warehouse is a post-beta conversation.
- Fine-tuned safety classifier (PRD §10.2) — the in-context Haiku classifier from TASK-010 keeps running; the 500–1000-example labeled corpus is collected **by** TASK-026 and TASK-025 for the eventual fine-tune, not used here.
- An external content CMS (Contentful, Sanity). TASK-028's tool is intentionally small and internal — revisit after 20 modules have flowed through it.

## Sprint 4

**Sprint 4 goal:** **Run a closed beta and close the gaps it surfaces.** Sprint 3 got Hypercare to "ready to put in front of real caregivers." Sprint 4 is what we ship *during and because of* that first cohort. Three themes, named explicitly so we don't drift:

1. **Learn from the beta cohort.** Streaming answers so the 2am phone-screen feel isn't a 4-second blank wait (PRD §6.4 is silent on streaming, but the helpfulness rate will reflect it). A real in-app feedback / contact-support path (TASK-025 referenced a `/help → contact support` path that doesn't exist yet). A reviewer loop for every thumbs-down that closes the helpfulness feedback cycle.
2. **Close transparency and privacy gaps.** A user-facing "what Hypercare remembers about you" surface that covers both the care profile (partly shipped in Screen 7) and the conversation memory from TASK-027 (deliberately not user-visible in v0). Data retention / export / delete (PRD §14 open question — a gate for paid rollout and for anything past the closed beta). Legal review of the mandatory-reporter disclosure language (TASK-025 shipped a placeholder).
3. **Polish what the beta will break.** Onboarding stage-assessment questions validated with the Care Specialist and 5–10 caregivers (PRD §5.2, §14 open question — we shipped the PRD's draft wording in sprint 2, the clinician refines now). The red-team set grown from 100 to PRD §10.5's full target of **200 adversarial + 50 lived-experience**, with the unaffiliated-crisis-counselor external-review round closed. No new categories; no new subsystems.

**Sprint 4 explicitly does not** ship streaming for the lesson or library surfaces (only for the conversation answer pipeline — that's where the latency pain is). Does not build an analytics warehouse; TASK-029's Postgres surface continues to be enough. Does not add family sharing / Spanish / mobile-native / SRS. Does not replace the lesson picker policy. Does not introduce a fine-tuned safety classifier — the labeled corpus from TASK-026 and TASK-035 is collected for a sprint-5+ fine-tune, not used here.

| ID       | Title                                                                                                                                                                                          | Depends on              | Status  | PR  |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------- | --- |
| TASK-031 | Streaming answers for the conversation surface — server-sent events from Layer 5/6, progressive render, graceful degrade on classifier-refusal or grounding-fail (no streamed escalation UI)   | 009, 011, 025           | pending | —   |
| TASK-032 | Privacy posture v1 — retention schedule per table, self-serve data export (JSON zip), self-serve account delete with safety-flag retention carve-out, encoded in schema + legal-reviewed copy  | 019, 020, 029           | pending | —   |
| TASK-033 | "What Hypercare remembers about you" surface on `/app/profile` — unified view of care-profile facts + the TASK-027 conversation-memory summary + a per-item "forget this" affordance            | 020, 027                | pending | —   |
| TASK-034 | Onboarding stage-assessment question refinement — Care Specialist-signed wording for the 6–8 questions (PRD §5.2, §14), back-compat migration for answers already captured under draft wording | 005, 007                | pending | —   |
| TASK-035 | Red-team set to PRD §10.5 full target — 200 adversarial + 50 lived-experience, unaffiliated-crisis-counselor external-review round closed, drift monitor for weekly regressions                 | 026                     | pending | —   |
| TASK-036 | In-app feedback + thumbs-down reviewer loop — `/help → contact support` surface, thumbs-down capture with optional text, operator review queue at `/internal/feedback`, SLA-on-missed signal    | 011, 021, 029           | pending | —   |

### Sprint 4 success criteria (the demo)

The demo is the **"beta cohort learning" review.** Run it end-to-end after at least 14 days with the cohort:

1. **Streaming.** Ask a question. First visible character appears within 800ms (P50) of the POST returning headers; the answer renders progressively; the source-attribution footer and follow-up chips render only after the full response completes. Classifier-flagged queries do **not** stream — the escalation card renders atomically.
2. **Privacy.** Log in as a test user; request "Download my data" on `/app/profile`. A JSON zip with care profile, conversations, messages, saves, lesson progress, check-ins, and conversation memory arrives within 2 minutes. Request "Delete my account." A confirmation dialog explains the retention carve-out for safety-flag rows (de-identified). Complete the delete; reload → signed out; `psql` shows user-scoped rows gone, de-identified safety_flags preserved.
3. **Transparency.** `/app/profile` → "What Hypercare remembers" section shows the care-profile facts and the conversation-memory summary side-by-side. Tap "Forget this" on a specific fact ("I live in the same home"); the profile is updated and the next answer prompt reflects the edit. The conversation-memory summary is visible; a "Refresh" button regenerates it; a "Forget this conversation's memory" button nulls it.
4. **Onboarding refinement.** Start onboarding as a new user. The 6–8 stage-assessment questions match the Care Specialist–signed wording (different from sprint 2's). Existing users whose answers were captured under the draft wording have their saved answers migrated to the new wording without loss; the inferred stage is recomputed and matches to within one stage of the prior value for ≥ 95% of pre-migration users.
5. **Red-team 250.** `EVAL_LIVE=1 pnpm --filter @hypercare/eval start -- redteam --fixture redteam-v2.yaml` (250 queries) reports ≥ 90% overall. The external-reviewer round closed; their line-edits are folded in or explicitly deferred with a comment per query.
6. **Feedback loop.** A caregiver thumbs-down an answer, adds a line of text. The row appears in `/internal/feedback` within 30s. PM or the Content Lead marks it "triaged" with a comment; the caregiver sees a "thanks — we're looking at this" state on their original answer on next load. A 72h-unanswered thumbs-down surfaces in `/internal/metrics` as SLA-missed.

### Sprint 4 quality gates

- `pnpm lint && pnpm typecheck && pnpm test` green at every PR merge.
- `EVAL_LIVE=1 pnpm --filter @hypercare/eval start -- answers` stays ≥ sprint-3 baseline; `redteam` mode passes against the new **250-query** fixture at ≥ 90% overall (with the three recall buckets at 100%, per TASK-026's rule).
- **Legal sign-off** on the privacy copy (retention schedule, export language, delete copy, mandatory-reporter disclosure) is a blocker for TASK-032 merge. Placeholder names are not acceptable this sprint.
- **Clinician sign-off** on the TASK-034 question wording. The ADR records the sign-off.
- ADRs: 0020 (streaming), 0021 (retention + export + delete), 0022 (transparency surface), 0023 (onboarding refinement + back-compat migration), 0024 (red-team v2 structure + drift monitor), 0025 (feedback loop + SLA).
- No new `any`s, no new top-level `eslint-disable`. Schema deltas in `docs/schema-v1.md` (or fork into `schema-v2.md` if the file grows past ~600 lines).

### Out of sprint 4 (explicitly deferred to sprint 5 or later)

- Spaced repetition / SRS — still deferred at the PRD level (§1.3). v2 conversation.
- Family / multi-caregiver sharing (PRD §4.1).
- Spanish content (PRD §1.3). The onboarding-refinement ticket structures questions so they are i18n-ready, but no strings are translated.
- Native mobile apps.
- Fine-tuned safety classifier. The 250 red-team labels + thumbs-down corpus are the training set for a sprint-5+ fine-tune.
- Push notifications, SMS, email reminders. In-app only.
- A shared inbox for the content team's feedback triage — TASK-036 ships a single list; a triage workflow can come later if volume warrants.
- A real-time streaming for lesson content or library search. Only conversation answers stream in v1.
- Per-user LLM model routing (e.g. Opus for medical queries, Haiku for everything else). The classifier already does routing of a sort; fine-grained model routing is a post-beta optimization.

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
