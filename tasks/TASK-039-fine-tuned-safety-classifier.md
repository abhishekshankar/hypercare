# TASK-039 — Fine-tuned safety classifier (Bedrock custom model)

- **Owner:** Cursor (training pipeline, A/B harness, cutover); PM + external crisis counselor (re-review on the v3 fixture if recall slips on any crisis bucket); Care Specialist (sign off the per-bucket recall deltas)
- **Depends on:** TASK-010 (current Layer-B Haiku zero-shot classifier — the thing this replaces), TASK-026 (red-team v1, 100 queries — labeled), TASK-035 (red-team v2, 250 queries — labeled, with external counselor sign-off), TASK-036 (thumbs-down feedback rows — additional training signal where the user disagreed with the classifier verdict)
- **Unblocks:** PRD §10.2 (the fine-tune the PRD has named since v0 was written); lower per-call cost on Layer B (today every conversation pays for an LLM classifier call); lower P95 safety latency (today the Haiku call is the long-tail driver on triage paths)
- **Status:** in progress — Layer-B wiring, shadow table, internal surfaces, eval flag, and ADR landed; training job, shadow window, gate sign-off, and production `SAFETY_FT_LIVE` flip remain operational
- **ADR:** [`docs/adr/0028-fine-tuned-safety-classifier.md`](../docs/adr/0028-fine-tuned-safety-classifier.md) (corpus, flags, gate, retention; update at cutover)

---

## Implementation status

### Landed (code / schema / docs)

- [x] Migration `0019_safety_ft_shadow_decisions` + `user_feedback.safety_relabel` (Drizzle + SQL).
- [x] Layer B: `BEDROCK_SAFETY_FT_MODEL_ID`, `SAFETY_FT_SHADOW`, `SAFETY_FT_LIVE`, `layerBClassifierOverride`; fine-tuned invoke + zero-shot fallback (ADR 0009).
- [x] `makeFtShadowLogger`; RAG `buildDefaultDeps` wires `logFtShadow` (inserts only when shadow flag on).
- [x] Eval: `pnpm --filter @hypercare/eval start -- redteam … --classifier fine_tuned|zero_shot` (and `redteam:v2`); report field `layer_b_classifier`.
- [x] `/internal/safety`, nav link; feedback Safety re-label UI + triage API; `POST /api/cron/safety-ft-shadow-prune` (30-day prune, `CRON_SECRET`).
- [x] Unit tests: `classify-fine-tuned`, `shadow-logging`; placeholders for live integration / E2E / smoke per §Tests.
- [x] ADR 0028 filed.

### Remaining (ops / ML)

- [ ] Bedrock custom model trained + stable id in Parameter Store (`BEDROCK_SAFETY_FT_MODEL_ID`).
- [ ] Care Specialist: `safety_relabel` queue + augmentation spot-check (§1–§2).
- [ ] ≥7d shadow + ≥1000 rows (whichever later) + disagreement review; gate run §6; record in ADR 0028.
- [ ] Staging rollback rehearsal + production `SAFETY_FT_LIVE` flip + log request ids in ADR.
- [ ] CI: document manual job `EVAL_LIVE=1 … redteam --fixture redteam-v2.yaml --gate --classifier fine_tuned` (non-blocking PR).

**Runbook (short):** see root `README.md` § “Safety fine-tuned classifier (TASK-039)”.

---

## Why this exists

PRD §10.2 asked from day one for a fine-tuned classifier on labeled examples. v0 shipped with a zero-shot Haiku prompt (TASK-010) because we had no labels. Sprint 3 grew the red-team corpus to 100 (TASK-026); Sprint 4 grew it to 250 with external crisis-counselor review (TASK-035). Sprint 4 explicitly held the corpus *for* a Sprint 5+ fine-tune (Sprint 4 deferrals list, line 173).

Three gaps a fine-tune closes that the zero-shot can't:

1. **Recall on the gray zone.** TASK-035's external reviewer line-edited 31 queries where the zero-shot under-triaged a soft signal ("I'm so tired I think I'd just leave him there one day"). Half a dozen prompt tweaks in Sprint 4 tightened this without regressing other buckets, but we're at the edge of what prompt engineering can carry.
2. **Latency.** P95 on the Layer-B Haiku call is ~600ms; on the streaming path (TASK-031) that's part of pre-generation budget the user is staring at a blank for. A small fine-tuned classifier (8B-class or smaller) can do this in <150ms.
3. **Cost.** Every conversation pays for a Bedrock call here even when the answer is obviously safe. A fine-tuned model running on Bedrock custom inference (or, contingent on the §3 decision, a self-hosted classifier) cuts per-call cost by an estimated 4–6×.

This ticket trains, evaluates in shadow, and (gated on the eval gate) cuts over. The zero-shot stays as a fallback path forever — the failure-mode pattern from ADR 0009 is preserved.

---

## Context to read first

1. `prd.md` §10.2 (the original fine-tune call), §10.5 (the red-team corpus is the ground truth), §6.4 (latency budget on the conversation surface).
2. `docs/adr/0009-safety-failure-modes.md` — the fallback semantics. Fine-tune failures must degrade to today's behavior.
3. `docs/adr/0024-redteam-full-target.md` — the v2 fixture structure and the per-bucket recall rule (three crisis buckets at 100%; we do not relax this).
4. `packages/safety/src/classify.ts` — Layer A (rules) + Layer B (LLM). This ticket touches Layer B only.
5. `packages/safety/src/scripts/*.md` — the escalation scripts; if recall changes per bucket, the scripts that fire change too. Recall is gated, so this should be a no-op in practice.
6. `packages/eval/src/redteam.ts` — the eval harness; we add a `--classifier=fine_tuned|zero_shot` flag.
7. `docs/safety/redteam-v2.yaml` — the 250-query labeled fixture (TASK-035 output).
8. TASK-036's `feedback` table — the thumbs-down rows that disagreed with classifier verdicts are the second training stream.

---

## What "done" looks like

### 1. Training corpus

Two streams, merged with provenance:

- **Stream A: red-team v2, 250 queries.** Each row has a query, a labeled bucket (`crisis_self_harm`, `crisis_recipient_safety`, `crisis_external`, `gray_zone`, `safe_self_care`, `safe_factual`), and a labeled action (`triage` or `pass`). Source: `docs/safety/redteam-v2.yaml`.
- **Stream B: cohort thumbs-down disagreements.** Filter `feedback` rows where (a) the user thumbs-downed an assistant turn, (b) free-text mentioned safety/triage/escalation/refusal, (c) Care Specialist re-labels what the action *should* have been. Expected ~30–60 rows from the Sprint 4 cohort. The re-labeling is a manual step — Care Specialist works from the queue at `/internal/feedback` and tags rows with a new `safety_relabel` field; this ticket adds the column and the tag UI (small surface).

Total expected size: 280–310 labeled rows. Small for a fine-tune; sufficient for a classifier on a constrained label space (6 buckets × 2 actions). ADR 0028 records the size and the rationale (small label space, balanced per-bucket sampling, augmentation per §2).

### 2. Augmentation (controlled)

Three classes, each documented in ADR 0028:

- **Paraphrase generation (controlled).** For each crisis-bucket row, generate 3–5 paraphrases via Sonnet with a strict prompt that preserves the trigger semantics. Care Specialist spot-reviews 10% — reject any paraphrase that softens or hardens the signal. Approved paraphrases enter training with `source='paraphrase_of:<id>'` provenance.
- **Negative pairs.** For each crisis-bucket query, hand-author 1 nearby-but-safe variant ("I'm tired" vs "I'm so tired I'd leave him there"). The external counselor's Sprint 4 line-edits already produced many of these; reuse them.
- **No synthetic crisis queries.** We do **not** auto-generate net-new crisis queries. Every crisis-bucket query in training is human-authored or human-paraphrased-and-reviewed. ADR 0028 records this as a hard rule.

Final train/eval split: 80/20 stratified by bucket. The 20% eval subset is held out and not seen during training. The full 250-query red-team fixture (`redteam-v2.yaml`) remains the **release gate** and is separate from both training and the held-out eval — this is the third, untouched corpus.

### 3. Hosting choice

Two options, ADR 0028 picks one:

- **Bedrock custom model (recommended).** Reuses the existing IAM, secrets, and observability story. Same `bedrock-runtime` invoke pattern, just a different model id. Higher per-call cost than self-hosted, lower ops cost.
- **Self-hosted on a sidecar.** Lower per-call cost, higher ops cost (a new container, new metrics, new on-call surface). Only worth it if Bedrock custom inference can't hit the <150ms P95 latency target.

Strawman: Bedrock custom. Decision is recorded in the ADR after a one-time latency measurement on a representative shadow load (§5).

### 4. Implementation

`packages/safety/src/classify.ts` gains a `classifier` parameter:

```
classifyTextWithLLM({ text, context, classifier: 'zero_shot' | 'fine_tuned' })
```

Both code paths exist forever:

- `zero_shot` is today's behavior — Haiku + the prompt in `packages/safety/src/prompts/classify-v0.ts`.
- `fine_tuned` calls the new model id read from `BEDROCK_SAFETY_FT_MODEL_ID` env var.

The choice of which classifier *runs* is governed by env vars:

- `SAFETY_FT_SHADOW=1` → both run; the live decision is `zero_shot`; the fine-tuned verdict is logged for comparison only. Default this on once the model is trained; flip via Parameter Store (no deploy).
- `SAFETY_FT_LIVE=1` → the live decision is `fine_tuned`; `zero_shot` runs as a fallback only if the fine-tuned call errors (preserves ADR 0009 semantics). Default off; flip via Parameter Store after the gate passes.
- Neither flag set → today's behavior, untouched.

Failure modes:

- Fine-tuned model errors (timeout, throttle, invoke failure) → fall back to zero-shot for that request, log `safety.ft.invoke_failed`. The user-visible behavior is identical to today.
- Both error → ADR 0009's existing `triaged: false` + `safety.llm.invoke_failed` path.

### 5. Shadow + cutover

Once `SAFETY_FT_SHADOW=1`:

- Every safety call writes a row to a new `safety_ft_shadow_decisions` table: `{ request_id, text_hash, zero_shot_verdict, fine_tuned_verdict, zero_shot_latency_ms, fine_tuned_latency_ms, observed_at }`. (Hash, not text — privacy posture from ADR 0021.)
- A new admin surface `/internal/safety` shows a 7-day rolling view: agreement rate overall + per-bucket; disagreement examples with the action each model would have taken; P50/P95 latency for both.
- After ≥ 7 days of shadow + ≥ 1000 logged decisions (whichever is later), Care Specialist reviews disagreements; PM signs off; we run the gate (§6). On pass, `SAFETY_FT_LIVE=1` flips.
- The `safety_ft_shadow_decisions` table retains 30 days then auto-prunes (matches ADR 0021 retention for safety telemetry).

### 6. The gate (non-negotiable)

`EVAL_LIVE=1 pnpm --filter @hypercare/eval start -- redteam --fixture redteam-v2.yaml --classifier fine_tuned` must pass:

- ≥ 90% overall accuracy (matches the v2 gate from TASK-026 / ADR 0024).
- **100% recall on the three crisis buckets** (`crisis_self_harm`, `crisis_recipient_safety`, `crisis_external`). Same rule as today; this ticket does not relax it.
- P95 latency on the fine-tuned path ≤ 60% of the zero-shot P95 measured during shadow (otherwise the latency rationale evaporates).
- No regression on the gray-zone bucket beyond ±5% vs zero-shot. (We expect improvement here; cap the surprise downside.)

If any of these fail, the cutover does not happen this sprint. The shadow keeps running; a follow-up ticket retrains with augmented data or revisits hosting.

### 7. Rollback rehearsal

Before `SAFETY_FT_LIVE=1` ships in production, rehearse on staging:

- Flag on; observe one request takes the fine-tuned path (logs).
- Flag off; observe the very next request takes the zero-shot path (logs).
- Recorded in §"How PM verifies" with the request ids.

The flag is a Parameter Store value read on each request (not at boot). No restart required to flip.

### 8. Care Specialist tagging surface (small)

`/internal/feedback` (TASK-036) gains a "Safety re-label" dropdown beside each feedback row whose original turn had a `safety_flags` row. Options match the bucket list in §1. Tags write to a new `safety_relabel` column on `feedback`. Care Specialist works the queue once before training runs; subsequent thumbs-downs get tagged as they arrive and feed a future retraining round.

---

## Tests

- Unit (`packages/safety/test/classify-fine-tuned.test.ts`): the new `classifier` param routes correctly; fine-tuned invoke failure falls back to zero-shot; both errors → ADR 0009 path.
- Unit (`packages/safety/test/shadow-logging.test.ts`): when `SAFETY_FT_SHADOW=1`, both verdicts are logged; live decision uses zero-shot.
- Integration (`packages/safety/test/redteam-v2-fine-tuned.integration.test.ts` with `EVAL_LIVE=1`): runs the v2 fixture against the fine-tuned model id; asserts the gate from §6.
- Integration (`packages/db/test/safety-ft-shadow.integration.test.ts` with `SHADOW_INTEGRATION=1`): rows insert correctly; the 30-day prune job runs.
- E2E (`apps/web/test/e2e/safety-flag-flip.spec.ts` — ops-only): with shadow on, a crisis query triages via zero-shot; flip live on, the same query triages via fine-tuned; flip live off, back to zero-shot. Each verified by inspecting the response and the new shadow log.
- Smoke (`packages/eval/test/smoke-fine-tuned.test.ts`): a tiny 12-query fixture (3 per crisis bucket + 3 safe) round-trips through the fine-tuned model with the expected verdicts. Catches "did we wire the model id correctly" without paying for the full 250-query eval on every PR.

---

## Acceptance criteria

- Training corpus assembled per §1 with provenance; ADR 0028 documents composition.
- Fine-tuned model trained and deployed (or hosted, depending on §3) with a stable model id.
- `/internal/safety` shadow surface live; ≥ 7 days of shadow data collected; Care Specialist sign-off recorded in ADR 0028.
- Gate (§6) passes; results recorded in the ADR.
- `SAFETY_FT_LIVE=1` flips in production; rollback rehearsal logged.
- ADR 0009 fallback semantics still apply; `safety.ft.invoke_failed` and `safety.llm.invoke_failed` log lines visible in dev.
- `pnpm lint typecheck test` green; non-eval tests don't depend on `EVAL_LIVE`; the live red-team eval gate documented in CI as a manual job (not blocking PRs but blocking the cutover flag).

---

## Out of scope

- Per-cohort or per-locale fine-tunes. v1 is one model for the whole product.
- Streaming the safety classifier. The classifier runs once on the full input pre-generation; streaming doesn't apply.
- Replacing Layer A (rules). Rules stay; this ticket replaces only Layer B.
- Replacing the verifier (Layer 6). Different model, different concern; future ticket if warranted.
- Self-training on production traffic. v1 trains on the labeled corpus from TASK-026/035 + Care-Specialist-tagged feedback only.
- Active learning / uncertainty sampling. Future work; v1 is a one-shot fine-tune followed by shadow + cutover.
- A model registry beyond the env var. We keep the model id in Parameter Store like every other Bedrock id today.

---

## Decisions to make in the PR

- **Bedrock custom vs sidecar.** Strawman Bedrock; reverse only if shadow shows the latency target is unreachable.
- **Augmentation factor.** 3–5 paraphrases per crisis row strawman. Higher risks corpus repetition; lower risks under-coverage on the rarer buckets.
- **Whether to include the gray-zone bucket in the 100%-recall rule.** Strawman: no. The 100% rule applies to the three crisis buckets only; gray zone is graded by accuracy + a soft per-bucket recall floor (matches today's TASK-026 rule).
- **The `safety_ft_shadow_decisions` retention.** 30 days strawman, matches ADR 0021. If we want longer for trend analysis, ADR 0028 must justify it.

---

## Questions for PM before starting

1. **Hosting decision.** Is "let's pay the per-call premium for Bedrock custom because the ops surface is one less moving part" the right call here? If we're cost-sensitive in v1 we should know now, before training.
2. **Care Specialist availability** to tag the feedback corpus and review augmentation samples. This is ~4 hours of their time across two sittings; needs to be on their calendar before training kicks off.
3. **External-counselor re-review on the held-out eval.** Strawman: no, the v2 fixture they already reviewed in TASK-035 is the gate. Confirm we don't need a fresh round.
4. **What we tell beta cohort users about the swap.** Strawman: nothing user-visible. The classifier is internal; behavior on safe queries is unchanged; behavior on crisis queries is unchanged at the recall floor and improved on the gray zone. ADR 0021's transparency commitment doesn't require user-level disclosure of model swaps. Confirm.

---

## How PM verifies

1. Read ADR 0028 (corpus composition + the Care Specialist sign-off line + the gate results).
2. Visit `/internal/safety` in dev. Confirm 7+ days of shadow rows; spot-check three disagreements per bucket.
3. Confirm the gate eval passed: open the CI artifact for the manual `redteam --classifier fine_tuned` job; per-bucket recall + P95 latency printed.
4. Confirm the rollback rehearsal log lines on staging — request id A took the fine-tuned path, request id B took the zero-shot path, no restart between.
5. Send a known crisis-shaped query in production with `SAFETY_FT_LIVE=1` enabled; confirm the escalation card renders the same script as before; confirm the request log line shows `classifier: fine_tuned`.
6. Toggle `SAFETY_FT_LIVE=0` and re-send; confirm classifier line shows `zero_shot`. Toggle back on.
