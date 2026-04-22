# ADR 0030 — Per-user model routing for Layer-5 generation (TASK-042)

## Status

Accepted (implementation TASK-042).

## Context

Layer-5 generation historically used a single Bedrock model id (`BEDROCK_ANSWER_MODEL_ID` / `packages/rag` defaults). The product needs topic-aware routing (medical/medication vs default tier), a defensible audit trail, and an A/B harness gated on helpfulness without mid-stream model swaps.

## Decision

1. **Router package** — Internal `@hypercare/model-router` loads a checked-in YAML policy at process boot (`packages/model-router/config/model-routing.yaml`). `selectModel()` returns `{ modelId, reason, policyVersion, matchedRuleIndex }`. Invalid YAML fails boot; unknown keys in `match` objects are rejected at parse time.

2. **Classifier verdict bridge** — Until TASK-009’s standalone Layer-2 classifier ships in this repo, `buildClassifierVerdictForRouting()` maps MODULE-022 topic slugs (+ light lexical cues) into the router’s `ClassifierVerdict` shape (`topic`, `urgency`, `stage`, `is_refusal_template`).

3. **Flag + cohort** — `MODEL_ROUTING=1` enables routing and `model_routing_decisions` persistence. `users.routing_cohort` is `routing_v1_control` or `routing_v1_treatment`, assigned deterministically on first sign-in (`routingCohortFromUserId`, SHA-256 first byte mod 2, matching migration `0021_model_routing.sql`). Control cohort always receives `default_model_id`; treatment runs ordered route rules.

4. **Persistence** — Append-only `model_routing_decisions` (FK to assistant `messages.id`). **90-day rolling retention** via `RETENTION_SCHEDULE` + `retention-cron.ts` (same class as `safety_flags` per ADR 0021). Optional SQL helper: `packages/db/scripts/prune-model-routing-decisions.sql`.

5. **Observability** — SSE `started` events may include `routing: { modelId, reason, policyVersion }` (internal; UI off by default). `/internal/metrics` surfaces per-cohort helpfulness %, decision counts, average latency, and summed cost estimates from logged token counts × `bedrock-pricing.ts` methodology (order-of-magnitude, not billing).

6. **Failure mode** — `selectModelSafe` logs `routing.error` and falls back to `default_model_id`. Bedrock invoke errors follow the existing pipeline error path (no automatic model downgrade retry).

## Route table sign-off

**Care Specialist approval is required before changing topic→model mappings** in `model-routing.yaml` (same convention as safety scripts per ADR 0024). The checked-in v1 table favors account-supported `us.*` inference profile ids; operators may substitute Opus/Sonnet profile ids their AWS account can invoke.

## 14-day experiment “win” definition (strawman)

PM confirms before flipping `MODEL_ROUTING=1` in production:

- ≥ **5 percentage-point** lift in helpfulness (thumbs-up / rated) on combined `topic: medical | medication` for treatment vs control.
- **No regression** (helpfulness or refusal rate) on other topics at a pre-agreed tolerance.
- **P95 latency** for treatment within the budget agreed with operators (Opus is slower; the metrics tile surfaces avg latency by cohort as a proxy until dedicated p95 is added).

If cost rises materially on the medical slice, PM decides whether a helpfulness lift justifies the spend; this ADR records the trade-off conversation, not the outcome.

## Out of scope

Per TASK-042: cost-only routing, per-user history-based routing (beyond cohort), non-Bedrock vendors, mid-stream swaps, user-visible model labels (Sprint 6+ transparency).

---

Schema documented in [`docs/schema-v2.md`](../schema-v2.md) § `model_routing_decisions` and § `users.routing_cohort`. (TASK-043.)
