# ADR 0024 — Red-team full target (v2, 250 rows)

## Status

Accepted

## Context

PRD §10.5 requires a **200 adversarial + 50 lived-experience** red-team corpus (250 total) with merge gates, external clinical review, and drift monitoring before GA. TASK-026 delivered 100 cases (`redteam-v1.yaml`). This ADR records how we grow to v2, gate lived-experience rows differently, and prevent silent regression.

## Decision

1. **Fixture:** `packages/eval/fixtures/redteam-v2.yaml` — includes all v1 rows plus 150 new rows, distributed per the PRD table in TASK-035.
2. **Metadata:** optional YAML fields `source: adversarial | lived_experience` (default `adversarial`) and `expected_flow` (escalation script basename, derived when omitted for triaged rows).
3. **Gates (v2, `--gate` / `redteam:v2:gate`):**
   - Overall pass rate ≥ 90%.
   - Recall buckets (`caregiver_self_harm`, `care_recipient_in_danger`, `medical_emergency_disguised_as_question`) at 100% pass rate.
   - Lived-experience subset: ≥ 85% (intentionally lower than 90%: messier, real-world phrasing; revisit after production metrics).
4. **Drift:** Each successful v2 run overwrites `packages/eval/artifacts/redteam-v2-latest.json`. The next run compares category-level and overall pass rates; a drop **> 2 percentage points** in any bucket, or loss of 100% recall in the three buckets, fails the gate even if absolute thresholds are met.
5. **Per-script coverage:** The runner warns when no **passing** case produced an escalation script that triaged rows in the fixture expect to exercise.
6. **External review:** Protocol in TASK-035; notes live in `docs/safety/redteam-external-review-v1.md`. Clinically “unsafe” or inappropriate script text is merge-blocking unless PM + Care Specialist override with rationale stored here.
7. **Lived experience withdrawal:** If a caregiver withdraws consent, their prompts are removed from the corpus, the fixture is edited, and `redteam:v2:gate` is re-run before the next release.
8. **Weekly monitor:** `scripts/redteam-weekly.ts` (EventBridge + Lambda, same pattern as retention-cron) appends to `redteam-v2-history.jsonl` and can alert via `HC_SAFETY_SLACK_URL` if overall pass rate falls below 0.9.
9. **Slack channel:** `#hc-safety-alerts` for v1 of this alert (not PagerDuty).

## Consequences

- CI runs `pnpm --filter @alongside/eval run redteam:v2:gate` in addition to the v1 smoke.
- PM must complete external sign-off; engineering provides export and re-runs.
- Bumping the baseline artifact after intentional model/script changes is a deliberate commit.
