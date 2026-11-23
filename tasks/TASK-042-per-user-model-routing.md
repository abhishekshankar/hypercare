# TASK-042 — Per-user model routing for generation (Layer 5)

- **Owner:** Cursor (router package, Layer-5 wiring, A/B harness, observability); PM (decides cohort split + helpfulness gate); Care Specialist (signs off the route policy table — which query class goes to which model)
- **Depends on:** TASK-009 (Layer-2 query classifier already produces topic + urgency + stage; this ticket reads its output), TASK-031 (streaming generation — the route is selected before the stream opens; mid-stream model swap is out of scope), TASK-036 (thumbs-down feedback loop — supplies the helpfulness signal we A/B against)
- **Unblocks:** the Sprint 4 cohort observation that medical questions occasionally got rote-feeling answers (Sonnet vs Opus on dosage / symptom-progression queries); the cost story for non-medical conversations (today every turn pays the same tier); a defensible answer to "why this model for this question?" via the routing decision log
- **Status:** pending
- **ADR:** `docs/adr/0030-per-user-model-routing.md` (new — route policy table, A/B harness design, decision-log retention, what triggers a re-evaluation)

---

## Why this exists

Today every grounded-answer turn calls the model id in `BEDROCK_ANSWER_MODEL_ID` (Sonnet, current default). The Layer-2 classifier (TASK-009) already produces a structured verdict per query — topic (`medical | medication | behavioral | self_care | logistics | other`), urgency (`low | normal | elevated`), stage match — but Layer 5 ignores this for model selection.

Three reasons to route now, not later:

1. **The cohort surfaced a quality gap on medical questions.** Six thumbs-downs in Sprint 4 (TASK-036 queue) shared a pattern: dosage/symptom questions answered correctly but in a tone the caregiver felt was "AI-ish, not what a nurse would say." Spot-running the same queries through Opus produced answers Care Specialist rated higher on tone and specificity. The classifier already labels these as `topic: medical` or `topic: medication`; routing to Opus is a one-line policy.
2. **Cost asymmetry.** Refusal-only paths (Layer 4 grounding-fail, Layer 2 triage) currently pay for Sonnet to render a script that's already templated. These should run on Haiku at minimum; arguably Layer A should never reach generation at all (and doesn't, after TASK-039's classifier swap). Routing makes this explicit.
3. **It unblocks per-user variation later.** v1 routes by query class only. The `model_routing_decisions` table records the inputs to every route call; once the data is there, a Sprint 6+ routing policy can incorporate user features (cohort, locale, prior helpfulness signal) without re-architecting.

This ticket is framed as a **quality** play — Opus where it helps, Sonnet as the default, Haiku where the answer is templated. Cost-tier routing for unit-economics is explicitly deferred (Sprint 5 plan calls this out).

---

## Context to read first

1. `prd.md` §9 (the generation contract — Layer 5), §9.4 (model selection commentary; the PRD names "strong frontier model for generation" but doesn't fix the model id), §12 (helpfulness north-star — the A/B endpoint).
2. `packages/rag/src/layers/2-query-classifier.ts` — the classifier output schema; this is the input to the router.
3. `packages/rag/src/layers/5-generation.ts` — where the model invoke lives today; the router intercepts here.
4. `packages/rag/src/pipeline.ts` — `runPipeline()`; this is where the routing decision is logged.
5. `docs/adr/0008-rag-pipeline-v0.md` §5 — Layer 5 contract.
6. `docs/adr/0020-streaming-answers.md` §1 — streaming envelope; the routing decision is included in `started` payload metadata so the client can later display it (off by default; transparency hook only).
7. TASK-036 — for the helpfulness signal source (`messages.rating`).
8. TASK-009 ticket — for the classifier verdict shape we're consuming.

---

## What "done" looks like

### 1. The `model-router` package

A new internal package `packages/model-router/`:

- `src/policy.ts` — the route policy as a typed object loaded from `config/model-routing.yaml` at boot. Pure data; no IO at decision time.
- `src/router.ts` — `selectModel({ classifierVerdict, userContext, abCohort }): RouteDecision` returning `{ modelId, reason, policyVersion }`.
- `src/types.ts` — `RouteDecision`, `ClassifierVerdict` (mirrors TASK-009's schema), `UserContext` (cohort id, profile stage, member count from TASK-038).

The policy file shape:

```yaml
policy_version: 1
default_model_id: anthropic.claude-3-5-sonnet-20250101-v1:0
routes:
  - match: { topic: medical }
    model_id: anthropic.claude-3-opus-20250101-v1:0
    reason: "tone + specificity on medical questions"
  - match: { topic: medication }
    model_id: anthropic.claude-3-opus-20250101-v1:0
    reason: "dosage / interaction questions need higher tier"
  - match: { topic: behavioral }
    model_id: anthropic.claude-3-5-sonnet-20250101-v1:0
    reason: "default tier — Sprint 4 cohort signal was strong here"
  - match: { topic: self_care }
    model_id: anthropic.claude-3-5-sonnet-20250101-v1:0
    reason: "default tier"
  - match: { is_refusal_template: true }
    model_id: anthropic.claude-3-5-haiku-20250101-v1:0
    reason: "scripted output; no generation tier needed"
ab_overrides:
  - cohort: routing_v1_treatment
    note: "treatment cohort runs the policy above; control runs default for everything"
```

Keys are conservative: route by topic + a refusal-template flag. Urgency is observed but not yet a route key (we don't have a clear quality signal that urgency × model interaction matters; revisit in Sprint 6 if data shows it).

The policy file is checked in. Changes require a PR + ADR amendment + Care Specialist sign-off (same convention as `packages/safety/src/scripts/*.md` per ADR 0024). Hot-reload from S3 / Parameter Store is **not** v1 — too easy to footgun a route change.

### 2. Layer-5 integration

`packages/rag/src/layers/5-generation.ts`:

- Accepts a `routeDecision` parameter (replaces the env-var-only model id read).
- Falls back to `BEDROCK_ANSWER_MODEL_ID` if no decision is passed (preserves today's behavior when the flag is off).
- Emits the `routeDecision.modelId`, `routeDecision.reason`, and `routeDecision.policyVersion` in pipeline observability.

`packages/rag/src/pipeline.ts`:

- After Layer 2 (classifier), call `selectModel(...)` from `model-router`.
- Pass the decision down to Layer 5.
- Record the decision in a new `model_routing_decisions` table (§4).

Refusal paths (Layer 2 triage, Layer 4 grounding fail) bypass Layer 5 today; we don't change that. The router's `is_refusal_template` route is for *grounded* answers that happen to render a templated form (e.g. "I can't speak to a specific medication dose, but here's what's documented…"). In practice this is rare; the route is in policy for completeness and unblocks future use.

### 3. A/B harness

A simple cohort split:

- Each user is assigned a routing cohort at first session: `routing_v1_control` (50%) or `routing_v1_treatment` (50%). Cohort id stored on `users.routing_cohort` (new column).
- Control cohort: every generation call uses `default_model_id` regardless of policy match. Treatment cohort: every call runs the full policy.
- Cohort assignment is sticky per user; never re-randomized.
- Beta cohort users get assigned at migration time. New users get assigned on first sign-in.

The split lives behind `MODEL_ROUTING=1`. With the flag off, both cohorts use today's behavior (`BEDROCK_ANSWER_MODEL_ID`). With the flag on, the split is live.

After 14 days with `MODEL_ROUTING=1`, `/internal/metrics` shows the comparison:

- Helpfulness rate (TASK-036 thumbs-up / total) for treatment vs. control, per topic.
- Refusal rate per cohort (we don't expect a difference; surfacing it catches regressions).
- P50/P95 latency per cohort (Opus is slower; we want to see by how much).
- Estimated per-call cost per cohort (compute from token counts × current pricing; methodology in ADR 0030).

The decision to keep, expand, or revert routing is made by PM after the 14-day window using these tiles. ADR 0030 records what "win" looks like quantitatively (strawman: ≥ 5% helpfulness lift on `topic: medical | medication`; no regression elsewhere; latency P95 within budget).

### 4. The decision log

```
model_routing_decisions (
  id              uuid pk,
  message_id      uuid fk messages (not null),    -- the assistant turn this routes
  user_id         uuid fk users (not null),
  cohort          text not null,                   -- 'routing_v1_control' | 'routing_v1_treatment'
  classifier_verdict jsonb not null,              -- snapshot of Layer-2 output
  policy_version  int not null,
  matched_rule    int,                             -- index into the policy.routes array, null if default
  model_id        text not null,
  reason          text not null,
  latency_ms      int,                             -- generation latency (filled in post-stream)
  tokens_in       int,
  tokens_out      int,
  cost_estimate_usd numeric(10, 6),               -- computed from tokens × pricing in ADR 0030
  created_at      timestamptz not null default now()
)
```

Append-only. 90-day retention (matches `safety_flags` per ADR 0021); `prune-model-routing-decisions.sql` runs on the same EventBridge schedule.

### 5. Observability surfaces

- Per stream, the `started` SSE event (TASK-031 §1) gains an optional `routing` field: `{ modelId, reason, policyVersion }`. Internal-only; not rendered in the user-facing UI in v1. ADR 0030 records that surfacing this to users is a Sprint 6+ transparency conversation if at all.
- `/internal/metrics` adds the routing comparison tile (§3).
- Server logs include `routing.cohort`, `routing.matched_rule`, `routing.model_id` per request.

### 6. Migration

Migration `0015-model-routing.sql`:

- Adds `users.routing_cohort` (text, nullable; backfilled by an idempotent script).
- Creates `model_routing_decisions`.
- Backfill: assign existing users to `routing_v1_control` or `routing_v1_treatment` 50/50 deterministically (hash of user id mod 2). Document the split seed in the migration so re-runs are idempotent.

### 7. Failure modes

- Router throws → log `routing.error`, fall back to `default_model_id`, do not block the request.
- Policy file invalid at boot → boot fails. The CI typecheck on the policy yaml catches this before deploy (see Tests).
- Selected model id errors at invoke → today's Bedrock error path applies (the user sees an error). We do **not** retry on a different model — that adds latency and changes the experiment.

---

## Tests

- Unit (`packages/model-router/test/policy-loader.test.ts`): valid policy parses; missing `default_model_id` rejects; an unknown match key rejects.
- Unit (`packages/model-router/test/router.test.ts`): each policy rule matches the right verdict; default fires when no rule matches; cohort `control` always returns default; the matched-rule index is correct.
- Unit (`packages/rag/test/pipeline-routing.test.ts`): `runPipeline` calls the router after Layer 2 and passes the decision to Layer 5; the decision is recorded in `model_routing_decisions`.
- Integration (`packages/db/test/model-routing-decisions.integration.test.ts` with `ROUTING_INTEGRATION=1`): rows insert correctly per request; the prune job removes rows older than 90 days.
- Integration (`packages/eval/test/routing-no-regression.integration.test.ts` with `EVAL_LIVE=1`): the answers eval run under the treatment cohort doesn't regress on retrieval or safety; helpfulness movement is captured but not gated (the gate is the 14-day cohort comparison, not the eval).
- E2E (`apps/web/test/e2e/routing-decision-recorded.spec.ts`): with `MODEL_ROUTING=1`, send a query as a known-treatment-cohort user; assert a `model_routing_decisions` row is written with the matching `message_id` and the expected `model_id` per policy. Send the same query as a control-cohort user; assert the row records the default model.
- Smoke (`packages/model-router/test/policy-yaml-typecheck.test.ts`): the checked-in `config/model-routing.yaml` is parseable into the typed schema; runs in CI on every PR; catches policy drift.

---

## Acceptance criteria

- `model-router` package shipped; policy file checked in; CI typechecks the policy YAML.
- Layer 5 reads its model id from the router decision when `MODEL_ROUTING=1`; falls back to `BEDROCK_ANSWER_MODEL_ID` when off.
- `model_routing_decisions` table populated per request; 90-day prune job scheduled.
- A/B cohort assignment migration applied; existing users backfilled 50/50 deterministically.
- `/internal/metrics` shows per-cohort helpfulness, refusal rate, latency, cost-estimate tiles after the 14-day window.
- ADR 0030 written with the quantitative "win" definition for the 14-day review.
- `pnpm lint typecheck test` green; answers eval doesn't regress against either cohort; safety eval unaffected.

---

## Out of scope

- Cost-tier routing for unit economics. v1 routes for quality. Sprint 5 plan defers cost routing.
- Per-user (not per-cohort) model selection based on history. The decision-log table sets up this future; v1 routes by query class only.
- Routing the safety classifier (TASK-039 fine-tuned vs zero-shot). That's a separate decision with its own flag; this ticket touches Layer 5 generation only.
- Routing across providers (e.g. Bedrock vs another vendor). Bedrock-only. Same IAM, same observability.
- Mid-stream model swap. Once a stream opens with a model id, it stays. A model swap mid-answer would jar the user.
- Per-locale routing. We're English-only in v1.
- Real-time A/B reassignment. Cohorts are sticky per user.
- Surfacing the model id to the user. The data is in the SSE envelope but the UI does nothing with it. Transparency conversation for Sprint 6.

---

## Decisions to make in the PR

- **The route table itself.** §1's strawman is an opinion. Care Specialist must sign off the topic-to-tier mapping before merge. The ADR records the sign-off line.
- **Cohort split percentage.** 50/50 strawman for fastest signal at the cohort's size. If we're worried about treatment risk, 80% control / 20% treatment is acceptable and slows the readout.
- **Whether to seed the cohort split deterministically (hash of user id) or randomly at backfill.** Strawman: deterministic. Re-runnable, debuggable, no DB-state dependency.
- **What we do with users who joined mid-experiment.** Strawman: assigned at first sign-in via the same hash function. Their data enters the comparison from day 0 of their participation; the 14-day window is per-user from cohort entry, not calendar.
- **Inclusion of urgency in the route table.** Strawman: not v1. Revisit if the cohort comparison shows variance by urgency.

---

## Questions for PM before starting

1. **Care Specialist sign-off on the route table.** Need ~30 minutes of their time to read §1's strawman and either agree or push back. Required before merge.
2. **Cohort split.** 50/50 vs 80/20. Confirm.
3. **The 14-day window.** Strawman is 14 days from `MODEL_ROUTING=1` going live. If the cohort is small (~150 users) we may want longer for statistical confidence; ADR 0030 should record the decision and the methodology.
4. **What "win" means quantitatively.** Strawman: ≥ 5% helpfulness lift on `topic: medical | medication` with no regression elsewhere and P95 latency within today's budget. PM should confirm or adjust before we run the experiment, not after.
5. **What happens if cost goes up materially in treatment.** Opus is more expensive. The decision log captures this; but PM should pre-decide whether a helpfulness lift justifies a 2× spend on the medical-question slice. ADR 0030 records the trade.

---

## How PM verifies

1. Apply migration `0015`. Confirm `users.routing_cohort` is populated 50/50 (`select cohort, count(*) from users group by 1`).
2. Read ADR 0030, including the route table and the win-condition.
3. With `MODEL_ROUTING=1` on dev, sign in as a known treatment-cohort user; ask a medical-shaped question. Inspect the request log: `routing.matched_rule` corresponds to the medical rule; `routing.model_id` is Opus. Inspect `model_routing_decisions` for the row.
4. Sign in as a known control-cohort user; ask the same question. `routing.matched_rule` is null; `routing.model_id` is the default.
5. Send several non-medical questions across both cohorts. Confirm the decision log records the right model per cohort.
6. After 24h of dev traffic, view `/internal/metrics` routing tiles. Confirm the per-cohort breakdown renders even with small N (numbers may be noisy; the surface should still work).
7. Toggle `MODEL_ROUTING=0`. Confirm the next request goes to `BEDROCK_ANSWER_MODEL_ID` regardless of cohort and that no `model_routing_decisions` row is written.
