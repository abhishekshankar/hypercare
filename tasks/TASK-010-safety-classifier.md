# TASK-010 — Safety classifier v0: crisis detection + escalation path

- **Owner:** Cursor
- **Depends on:** TASK-004 (schema — `safety_flags` table), TASK-009 (the layer-0 hook where the classifier plugs in)
- **Status:** pending
- **ADR:** `docs/adr/0009-safety-classifier-v0.md` (new, written as part of this task)

---

## Why this exists

From PRD §10: Hypercare users are caregivers under load. A non-trivial fraction of real questions will contain signals of crisis — suicidal ideation (self or care-recipient), abuse/neglect, acute medical emergencies, elder maltreatment, caregiver violence. The product's response to those signals cannot be "here is a grounded answer about sundowning." It must be a triage step that routes the user to real help (988 / emergency services / the persistent crisis strip), and it must log the signal so downstream review (not in v1) can improve recall.

The crisis strip already exists on every route (TASK-005). This task adds the **detection** layer so the answering pipeline can recognize a crisis message and short-circuit to refusal + resource pointer before RAG retrieval even runs.

This is safety-critical surface area. The classifier is intentionally **high-recall, low-precision**: we accept false positives (showing a crisis card on a non-crisis message) far more than false negatives (generating a generic RAG answer over a real crisis). False positives look like over-caution; false negatives are a headline.

---

## Context to read first

1. `PROJECT_BRIEF.md` §7, §8.
2. `prd.md` §10 (safety classifier — read the whole section, especially the categories and the "err on recall" principle), §6.1 (crisis strip — already built).
3. `packages/rag/src/layers/0-safety.ts` — the stub hook from TASK-009. This task replaces its body.
4. `packages/db/src/schema/safety-flags.ts` — the persistence target.
5. `apps/web/src/components/CrisisStrip.tsx` (or wherever TASK-005 placed it) — the user-facing resource surface. Do **not** duplicate; the classifier's job is to set a flag the UI already knows how to render.
6. `tasks/TASK-009-rag-pipeline.md` — for how `packages/safety/` plugs into the pipeline via `refuseReason.code === "safety_triaged"`.

---

## What "done" looks like

1. `packages/safety/` is populated — no longer an empty stub.
2. Public entry: `classify(input): Promise<SafetyResult>` where
   - `input = { userId: string, text: string }`
   - `SafetyResult = { triaged: true, category: SafetyCategory, severity: "high" | "medium", suggestedAction: SuggestedAction, matchedSignals: string[] } | { triaged: false }`
3. Classifier is a **layered rule + LLM** system, in that order:
   - **Layer A: keyword / regex rules.** Fast, deterministic, always runs first. Catches the obvious cases ("I want to kill myself", "he has stopped breathing", "she hit me"). Patterns live in `packages/safety/src/rules/<category>.ts` as named exports so they can be unit-tested.
   - **Layer B: LLM classifier.** Runs only if Layer A did not trigger. Calls Bedrock with the model id in `packages/safety/src/config.ts` (`CLASSIFIER_MODEL_ID`, default `us.anthropic.claude-haiku-4-5-20251001-v1:0` — same Haiku 4.5 used by the answerer in TASK-009, same `us.` inference profile). Structured prompt that returns strict JSON. Haiku, not Sonnet — this runs on every question and must be cheap.
4. `packages/rag/src/layers/0-safety.ts` is updated (new in this task, not new file) to call `classify()`. If `triaged: true`, the pipeline returns a refusal with `code: "safety_triaged"` carrying the category and suggestedAction.
5. Every triage (whether from Layer A or Layer B) writes a row to `safety_flags` with `(user_id, message_text, category, severity, source: "rule" | "llm", matched_signals jsonb, created_at)`. **Message text is stored.** This is PII-adjacent but necessary for downstream human review of misses.
6. Unit tests for every rule file. LLM tests are gated on `SAFETY_LIVE=1`.
7. ADR 0009 captures: categories, recall-over-precision stance, why rules-then-LLM, why Haiku, what is and isn't logged.
8. Integration into RAG layer 0 is wired and tested — TASK-009's golden-question smoke test must now also include two crisis questions that short-circuit at layer 0.

---

## Categories

`SafetyCategory` (exact strings — constrained union, matches `safety_flags.category` CHECK — see "Schema constraint" below):

| Category | Definition | Example trigger words/phrases |
|---|---|---|
| `self_harm_user` | Caregiver expressing suicidal ideation, self-harm intent | "kill myself", "end it all", "can't go on", "better off dead" |
| `self_harm_cr` | Caregiver reports care recipient expressing same | "mom said she wants to die", "he tried to hurt himself" |
| `acute_medical` | Life-threatening current medical situation | "not breathing", "unresponsive", "chest pain", "stroke symptoms", "fell and can't move" |
| `abuse_cr_to_caregiver` | Care recipient physically harming caregiver | "he hit me", "she pushed me down the stairs" |
| `abuse_caregiver_to_cr` | Caregiver admitting to harming care recipient | "I slapped her", "I lost it and hit him" |
| `neglect` | Signs of neglect (often in "what if I just…" framings) | "leave her alone all day", "stop feeding him" |

`severity`:
- `"high"` — immediate-threat categories (`self_harm_*`, `acute_medical`, `abuse_caregiver_to_cr`).
- `"medium"` — `abuse_cr_to_caregiver`, `neglect` (serious, but not always immediate).

`suggestedAction`:
- `"call_988"` — self-harm categories.
- `"call_911"` — acute medical, in-progress violence.
- `"call_adult_protective_services"` — abuse, neglect.
- `"show_crisis_strip_emphasis"` — always included regardless of category; this tells UI to pulse / highlight the existing strip rather than add a new modal.

---

## Schema constraint

The `safety_flags.category` column is `text` in TASK-004. **Add a CHECK constraint** in this task's migration that restricts it to the 6 category strings above. Same discipline as the other CHECKs in the schema.

Also add:
- `severity text` CHECK in `("high", "medium")`
- `source text` CHECK in `("rule", "llm")`
- `matched_signals jsonb NOT NULL DEFAULT '[]'::jsonb`
- Index on `(user_id, created_at DESC)` for "most recent flags for this user" queries.

This is a **migration only**, not a full schema redesign. Use `drizzle-kit generate` and commit the generated SQL; review it for sanity before applying.

---

## Rule-based layer (A)

Rule files live under `packages/safety/src/rules/`, one per category. Each exports:

```ts
export const selfHarmUserRules: SafetyRule[] = [
  { id: "sh_user_kill_myself", pattern: /\b(kill|killing|hurt|hurting)\s+(myself|me)\b/i, severity: "high" },
  // ...
];
```

- Rules are regex-based. No ML models in layer A.
- Each rule has a stable `id` string so evals can track which rule fired.
- Running all rules over a message must return *all* matches, not short-circuit on first hit. If multiple rules fire, the highest severity wins; if tied, the first-listed category wins.
- Patterns must be reviewed by PM before merge — **flag the PR**. This is a safety-critical surface.

Start with a small curated list (~4–8 patterns per category). Don't try to be exhaustive. Document in the ADR that the rule set will grow via TASK-012 eval failures.

---

## LLM layer (B)

- Runs only if Layer A returned no match.
- Model: **read from `packages/safety/src/config.ts` (`CLASSIFIER_MODEL_ID`).** Default `us.anthropic.claude-haiku-4-5-20251001-v1:0` on Bedrock in `ca-central-1`, via the `us.` system inference profile (bare `anthropic.*` on-demand calls are rejected in this account). Override with the `BEDROCK_CLASSIFIER_MODEL_ID` env var. Haiku, not Sonnet — cost envelope matters because this runs on every question.
- Temperature: 0.
- Max tokens: 200.
- Prompt: a system prompt describing the six categories verbatim + few-shot examples (3 per category + 3 clearly non-crisis) + instruction to return strict JSON:
  ```json
  { "triaged": true, "category": "self_harm_user", "severity": "high", "evidence": "..." }
  ```
  or `{ "triaged": false }`.
- Parse with zod. If parse fails → `triaged: false` with a warning log (do not refuse on parse failure; we'd rather a Layer B miss than a pipeline stall).
- Cache: none in v0. Do not add an in-memory LRU or a Redis layer.

Prompt and few-shots live in `packages/safety/src/prompts/classifier.md`, checked in, PM-reviewed.

---

## Acceptance criteria

- `pnpm --filter @alongside/safety typecheck lint test` green.
- Calling `classify({ userId, text: "I want to kill myself, I can't do this anymore" })` returns `triaged: true, category: "self_harm_user", severity: "high", suggestedAction: "call_988"` **without** hitting Bedrock (Layer A catches it).
- Calling `classify({ userId, text: "Things have been really hard and I don't see the point some days" })` — a subtler signal — returns `triaged: true` via Layer B when `SAFETY_LIVE=1`. Offline test mocks this.
- Calling `classify({ userId, text: "how do I help my mom with bathing" })` returns `triaged: false` via Layer A (no match) AND Layer B (when live). This is the most important negative test — do not over-trigger on routine caregiver questions.
- Every `triaged: true` result writes a row to `safety_flags` with the right category + source.
- The RAG pipeline smoke test (from TASK-009) now covers:
  - "my mom said she wishes she were dead" → refused with `safety_triaged`, never reaches retrieval.
  - "how do I help with sundowning" → answered normally, no safety flag.
- Migration runs cleanly; existing `safety_flags` rows (none yet in v0) remain intact.
- ADR 0009 exists.

---

## Files to create / modify

### Create

```
packages/safety/src/index.ts                    # re-export classify()
packages/safety/src/types.ts                    # SafetyResult, SafetyCategory, SuggestedAction, SafetyRule
packages/safety/src/classify.ts                 # orchestrator: Layer A → Layer B → persist
packages/safety/src/persist.ts                  # writes to safety_flags
packages/safety/src/rules/self-harm-user.ts
packages/safety/src/rules/self-harm-cr.ts
packages/safety/src/rules/acute-medical.ts
packages/safety/src/rules/abuse-cr-to-caregiver.ts
packages/safety/src/rules/abuse-caregiver-to-cr.ts
packages/safety/src/rules/neglect.ts
packages/safety/src/config.ts                   # CLASSIFIER_MODEL_ID + region + defaults, mirrors packages/rag/src/config.ts shape
packages/safety/src/llm/classifier.ts           # Bedrock wrapper, Zod parse (model-agnostic name — reads CLASSIFIER_MODEL_ID)
packages/safety/src/prompts/classifier.md
packages/safety/test/*.test.ts                  # one per rule file + classify.test.ts
packages/db/migrations/NNNN_safety_flags_constraints.sql   # CHECKs + index + matched_signals column
docs/adr/0009-safety-classifier-v0.md
```

### Modify

```
packages/rag/src/layers/0-safety.ts             # replace stub body with classify() call
packages/rag/src/types.ts                       # refusal reason "safety_triaged" now carries category + suggestedAction
packages/safety/package.json                    # deps: @alongside/db, @aws-sdk/client-bedrock-runtime, zod, drizzle-orm
packages/db/src/schema/safety-flags.ts          # reflect the new columns + CHECKs
TASKS.md
```

### Do **not** touch

- `apps/web/**` — the CrisisStrip component already exists; this task sets a flag, UI reads it in TASK-011.
- The crisis phone numbers / copy — those live in the UI component and are not in scope.
- `packages/content/**`.

---

## Out of scope

- A full moderation policy (hate / adult / etc.). v0 is crisis-only.
- Rate-limiting the LLM classifier. We'll add that under load.
- A review / triage dashboard for flagged messages. That's post-v1.
- Anonymizing `message_text` before storage. Full text is stored in v0 for eval purposes. Revisit with legal before broader launch.
- Per-user suppression ("I keep talking about 'falls' in a non-crisis way"). No per-user models.

---

## How PM verifies

1. Read the 6 rule files; sanity-check patterns for obvious false positives (e.g. "she fell" → *not* acute_medical on its own; "she fell and isn't responsive" → yes).
2. `pnpm --filter @alongside/safety test` — all green.
3. With Bedrock access:
   - Paste the two golden crisis sentences from the acceptance criteria; expect `triaged: true`.
   - Paste 5 normal caregiver questions; expect `triaged: false` on every one.
   - Check `safety_flags` after step 2's first test; row should exist with `source="rule"`, and after the subtle-signal test, a row with `source="llm"`.
4. Read ADR 0009; it should answer: why these 6 categories, why rules-then-LLM, why store message text.

---

## Decisions already made

- High recall, low precision. False positives acceptable.
- Rules first, LLM second — not parallel.
- Haiku for the LLM layer (cost).
- Store `message_text` in `safety_flags` in v0.
- CHECK constraint on `category`, not a Postgres enum.
- Wire through the existing TASK-009 layer-0 hook — do not add a second interception point.
- `suggestedAction` is prescriptive enough for UI to act without further classification.

---

## Questions for PM before starting

1. **Bedrock access for Haiku 4.5 via `us.` inference profile** is the same gate TASK-009 already cleared for the answering model. No additional model enablement should be needed. If Cursor sees `ValidationException: on-demand throughput isn't supported` against the default `CLASSIFIER_MODEL_ID`, stop and flag.
2. **Storing full message text in `safety_flags` — comfortable for v0?** Alternative is a hash + first-N-chars preview. Full text is better for misses-review; the tradeoff is this row type is now "sensitive" from day 1.
3. **988 vs regional helplines.** The crisis strip currently shows a US number. For `suggestedAction: "call_988"` the classifier returns an abstract code; the UI maps. Confirm US-only is acceptable for v0 per the existing strip.

---

## Report-back

- File list.
- Count of patterns per category.
- Output of the smoke battery (two crisis, five non-crisis) showing category + source.
- Migration SQL diff.
- One paragraph on false-positive risk areas you noticed while writing rules ("the word 'died' appears in non-crisis contexts like 'her dog died'").
