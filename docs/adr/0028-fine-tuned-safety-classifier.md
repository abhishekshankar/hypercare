# ADR 0028 — Fine-tuned safety classifier (TASK-039)

## Status

Accepted for the **code / schema / runbook** slice (training, shadow window, gate artifact, and production flag flip are operational follow-ups tracked in `tasks/TASK-039-fine-tuned-safety-classifier.md`).

## Context

Layer B has been a zero-shot Haiku classifier (ADR 0009, TASK-010). Red-team v2 (`docs/safety/redteam-v2.yaml`, TASK-035) and thumbs-down relabels (TASK-036) supply a labeled corpus for a constrained label space (six classifier categories × triage/pass).

PRD §10.2 and TASK-039 require a fine-tuned path on Bedrock (strawman), shadow comparison, a non-negotiable eval gate, and rollback semantics that preserve ADR 0009: fine-tuned failures fall back to zero-shot; both failing yields `triaged: false` with `safety.llm.invoke_failed`.

## Decisions

1. **Hosting (strawman):** Bedrock custom / provisioned model id via `BEDROCK_SAFETY_FT_MODEL_ID`. Same `InvokeModel` pattern as Haiku; different system prompt for the FT path (`packages/safety/src/llm/classifier.ts`). Reverse to a sidecar only if shadow P95 misses the latency target in ADR §6.

2. **Flags (read each request from env / Parameter Store):**
   - `SAFETY_FT_SHADOW=1` — run both classifiers; live user decision stays zero-shot; log row to `safety_ft_shadow_decisions` when DB logger is wired.
   - `SAFETY_FT_LIVE=1` — live decision prefers fine-tuned; invoke errors fall back to zero-shot.
   - If both shadow and live are set, **shadow wins** for the live user decision (both still run; zero-shot outcome is returned).

3. **Training corpus (streams):** Stream A — red-team v2 YAML (250). Stream B — `user_feedback.safety_relabel` after Care Specialist review. No synthetic net-new crisis queries; augmentation rules are recorded here for execution in a follow-on training job (paraphrase / negative pairs per TASK-039 §2).

4. **Train/eval split:** 80/20 stratified by bucket for the training job; the committed `redteam-v2.yaml` fixture remains the **release gate** corpus (not consumed as training-only unlabeled noise).

5. **Gate (manual / CI job, not blocking PR CI):** `EVAL_LIVE=1 pnpm --filter @alongside/eval start -- redteam --fixture redteam-v2.yaml --gate --classifier fine_tuned` must meet TASK-039 §6 (overall ≥90%, three crisis buckets 100% recall, latency ratio vs zero-shot, gray-zone floor). Results are pasted into this ADR at cutover time.

6. **Telemetry retention:** `safety_ft_shadow_decisions` retains 30 days; prune via `POST /api/cron/safety-ft-shadow-prune` (same `CRON_SECRET` pattern as feedback SLA).

7. **Internal surfaces:** `/internal/safety` — 7-day rolling shadow stats. `/internal/feedback` — Safety re-label dropdown (TASK-039 §8).

## Consequences

- `@alongside/rag` `buildDefaultDeps` always attaches `logFtShadow`; inserts occur only when `SAFETY_FT_SHADOW=1`.
- Eval CLI accepts `--classifier fine_tuned|zero_shot` for live red-team runs.
- New migration `0019_safety_ft_shadow_decisions.sql`.

## Follow-ups (not blocking merge)

- Run augmentation + Bedrock training job; set `BEDROCK_SAFETY_FT_MODEL_ID` in Parameter Store.
- Collect ≥7d shadow + Care Specialist sign-off; run gate; flip `SAFETY_FT_LIVE=1`; log rollback rehearsal request ids in this ADR.

---

Schema documented in [`docs/schema-v2.md`](../schema-v2.md) § `safety_ft_shadow_decisions` and § `user_feedback.safety_relabel`. (TASK-043.)
