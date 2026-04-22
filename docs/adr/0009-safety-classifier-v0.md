# ADR 0009 — Safety classifier v0 (TASK-010)

## Status

Accepted (Sprint 1 vertical slice).

## Context

PRD §10 makes safety triage a first-class layer of the answering pipeline, not an afterthought layered on the model. The crisis strip (TASK-005) and the layer-0 hook (TASK-009) gave us the user-facing surface and the orchestration plug-point; this ADR captures the decisions for the actual *detection* layer.

Hypercare's audience is caregivers under load. A non-trivial fraction of real questions will carry signals of crisis — caregiver suicidal ideation, a care recipient in acute medical distress, abuse in either direction, or contemplated neglect. The product's job on those messages is **to route them to real help**, not to answer them. Getting this wrong has consequences far beyond churn.

## Decisions

**Answering vs classifier model:** Layer B uses the same Haiku 4.5 Bedrock **inference profile** id as the RAG answerer in TASK-009; see `docs/adr/0008-rag-pipeline-v0.md` §4 for why the `us.` (or other regional) profile prefix is mandatory.

### 1. Six categories, fixed at the schema level

```
self_harm_user        — caregiver suicidal/self-harm ideation
self_harm_cr          — caregiver reports CR with same
acute_medical         — life-threatening current medical situation
abuse_cr_to_caregiver — CR physically harming caregiver
abuse_caregiver_to_cr — caregiver admits/is asking about harming CR
neglect               — contemplated withholding of basic care
```

These collapse PRD §10.1's six risk categories into the surface area we can actually act on at v0. They are encoded as a CHECK constraint on `safety_flags.category` (not a Postgres enum — same discipline as the other CHECKs in the schema, and easier to evolve). The list is deliberately small so the classifier prompt and the rule banks both fit in a reviewer's head.

`severity` is two-state (`high` / `medium`) — anything more granular at v0 is false precision. `suggestedAction` is one of `call_988`, `call_911`, `call_adult_protective_services`, plus the implicit `show_crisis_strip_emphasis` that always applies. The UI (TASK-011) maps these to the existing crisis strip and pre-scripted escalation copy.

### 2. Recall over precision

False positives are tolerable; false negatives are a headline. The rule patterns intentionally over-trigger on phrasings like "end it all" and "I lost it" — we'd rather show a crisis card on a venting message than miss a real one. PRD §10.2 also says this. The eval harness in TASK-012 will tighten precision by adding adversarial examples that the classifier must NOT trigger on.

### 3. Layered: Layer A (rules) → Layer B (Haiku), never parallel

```
text ─► [Layer A: regex banks per category] ─┬─► triaged → persist + return
                                             │
                                             └─► no match → [Layer B: Haiku] ─► triaged or not → persist if triaged
```

Why layered:

- **Determinism + cost**: Layer A catches the obvious cases (Bedrock unenrolled accounts still get triaged on the obvious phrases; the cost envelope on real traffic stays small).
- **Speed**: a regex pass is sub-millisecond; Layer B adds ~150ms (Haiku Bedrock cold path).
- **Observability**: every triaged result carries a `source` (`"rule"` or `"llm"`); review can cleanly separate "rule recall" from "LLM recall" trends.
- **Fail-safe**: parse failures and Bedrock outages downgrade to `triaged: false` with a warning. A pipeline stall on safety would mean a routine answer never returns — worse than a Layer B miss that Layer A already passed.

We did NOT make the layers run in parallel. Parallelism would force us to either resolve disagreements (extra logic) or always pay for the LLM (cost). For the same reason there is no in-memory cache — Bedrock is fast enough at Haiku scale and a hot cache adds a privacy surface we don't need.

### 4. Layer A pattern set is small and curated, not exhaustive

Each category has 5–8 patterns (current count: see `Counts` below). We deliberately did not try to be comprehensive. Two reasons:

- **Reviewability**: PM (and a future Caregiver-Support Clinician) can read all 30-odd patterns in one sitting. An "exhaustive" 100-pattern bank cannot be reviewed and is statistically certain to contain a false positive that nobody noticed.
- **Eval-driven growth**: TASK-012 will add patterns when an eval miss exposes one. Each new pattern carries a stable `id` so we can attribute which addition fixed which miss.

False-positive risk areas surfaced while writing the rules:

- "she fell" alone is not enough for `acute_medical` — we require a follow-on like "isn't responsive" or "can't get up". "She fell last week and broke her wrist" should NOT trigger.
- "her dog died" / "she had a stroke last year" are routine in caregiver vocabulary; the rules anchor on present-tense ideation/event verbs, not the bare nouns.
- "I lost it" alone is venting, not abuse; we require a follow-on harm verb.
- "I want to kill X" is restricted to "myself" / "me" — "I want to kill this disease" should not trigger.
- "should I leave her alone for an hour while I shower" should NOT be `neglect` — the rule requires a long-window phrase like "all day" / "all weekend" / "for hours". This is a known borderline that the eval set should grow.
- "stop the meds" can match a routine medication-pause question (doctor-advised). Accepted false positive under the high-recall stance — v0 should log or meter how often this pattern fires; if it is noisy in production, we revisit (TASK-012 / telemetry follow-up).
- **Category-specific asymmetry for `acute_medical` only:** the word *fell* is extremely common in caregiver chat ("she fell last week", "I fell behind on dishes"). `acute_medical` rules require a high-risk follow-on (e.g. unresponsive, can't get up) so we do not fire on a bare "fell". That is a deliberate precision trade **for this category** — it is not the system-wide default; other categories still err toward recall on ambiguous phrasing.

### 5. Layer B: Haiku 4.5 (not Sonnet), same answering-model class as TASK-009

- **Model id** is `CLASSIFIER_MODEL_ID` in `packages/safety/src/config.ts`: default `us.anthropic.claude-haiku-4-5-20251001-v1:0` (Americas system inference profile). Bare `anthropic.claude-*` on-demand calls are rejected in this account. Override: **`BEDROCK_CLASSIFIER_MODEL_ID`**. **Same model family and inference-profile pattern as the RAG answerer** — see ADR 0008 §4.
- **Runtime** `ca-central-1`, **`temperature` = 0**, **`max_tokens` = 200**, structured JSON only, validated with zod (`{triaged, category, severity, evidence}` discriminated union).

Why Haiku-class, not a larger model:

- **Cost**: Layer B runs on every question that bypasses Layer A — the majority of real traffic. A smaller model is the right cost envelope.
- **Latency**: The classifier runs *before* retrieval, so it sits on the critical path.
- **Task fit**: The class set is small, the prompt is detailed, and Layer A + TASK-012 close the loop on recall.

### 6. The classifier prompt is a checked-in `.md`, PM-reviewable

`packages/safety/src/prompts/classifier.md` is loaded once at module init (cached) and shipped via `scripts/copy-prompts.mjs` to the built `dist/` mirror. This matches the pattern set by ADR 0008 §8 for the answering prompts. PM can review it as text and the eval harness can A/B prompts by replacing the file.

### 7. Persist `message_text` verbatim in `safety_flags`

Every triage writes one row with `(user_id, message_text, category, severity, source, matched_signals, created_at)`. **The full message text is stored.**

We considered alternatives (hash + first-N preview, salted token bag, redacted-then-stored). v0 stores the verbatim text because:

- The product's recall improvement loop is "look at misses + near-misses, add a rule or fix the prompt." A hash defeats that loop entirely.
- The dataset is small at v0 (single-digit triages/day, expected) and never leaves the same Postgres cluster as the rest of caregiver data.
- The privacy boundary is the auth wall + TOS, not field-level redaction.

This is a deliberate v0 trade-off. **Before broader launch we will revisit with legal**: options include Postgres `ENCRYPT()` on the column at rest, a separate retention policy for `safety_flags`, or the hash + preview compromise. The current row count makes this tractable to migrate later. The decision is captured here so it isn't quietly forgotten.

`message_id` and `conversation_id` were made nullable in this task's migration: the classifier runs at RAG layer 0, *before* a message row is persisted. TASK-011's chat surface can pass these in once a turn is materialised; v0 leaves them null.

### 8. Persistence failure is not a triage failure

If the `INSERT INTO safety_flags` fails (Postgres outage, transient network), the warn callback fires and the function returns the triage result anyway. The thing the user *sees* — the crisis strip emphasis + escalation copy — has already been computed. Losing the audit row is bad; failing to route a crisis user is worse. Recovery for the lost row is a manual operator task (review the application warn log).

### 9. Tie-breaking when multiple rules fire

- Highest severity wins (high > medium).
- On a tie, the first-listed category in `CATEGORY_RULES` wins — the order is `self_harm_user > self_harm_cr > acute_medical > abuse_caregiver_to_cr > abuse_cr_to_caregiver > neglect`.
- `matchedSignals` only contains rule ids from the *winning* category to keep downstream review focused.

This rule is exercised by `aggregateRuleHits` unit tests in `packages/safety/test/classify.test.ts`.

### 10. Pipeline integration is a refusal, not a parallel return shape

The RAG `RefusalReason` discriminated union now carries:

```ts
{ code: "safety_triaged"; category; severity; suggestedAction; source }
```

This keeps the orchestrator surface flat (no second return type). The chat UI in TASK-011 will pattern-match on `code: "safety_triaged"` and pick the escalation flow from `category` + `suggestedAction`, with the persistent crisis strip already on every screen (TASK-005).

## Counts

| Category               | Patterns |
| ---------------------- | -------- |
| self_harm_user         | 7        |
| self_harm_cr           | 5        |
| acute_medical          | 8        |
| abuse_cr_to_caregiver  | 5        |
| abuse_caregiver_to_cr  | 5        |
| neglect                | 6        |

(Counts will grow via TASK-012 eval failures.)

## Consequences

- The safety classifier is now on every question — its latency is on the user's critical path. Layer A is sub-ms; Layer B is ~150ms p50. Total budget impact ~150ms.
- We accept that Layer A patterns will need revision; each addition is a one-line PR plus a test case.
- We accept that the LLM prompt will need revision; the eval harness (TASK-012) is the discipline that catches drift.
- `safety_flags.message_text` is sensitive. Production access to that column should be brokered (read-only role for review, full row visible only to the on-call clinician + Content Lead). That access policy is a TASK-014 (post-v1) item.
- A future "soft-flag" path (PRD §10.4) — yellow-flag patterns that get a normal answer plus a warm appendix — is **not** in this task. The classifier's contract is binary (triaged or not). When we add yellow flags, we'll likely extend `SafetyResult` rather than adding a separate function.

## References

- PRD §10 (safety classifier).
- ADR 0003 — Design tokens and persistent crisis strip.
- ADR 0008 — RAG pipeline v0 (the layer-0 hook this fills in).
- `tasks/TASK-010-safety-classifier.md`.
- `packages/safety/src/prompts/classifier.md`.
- `packages/db/migrations/0001_safety_flags_constraints.sql`.
