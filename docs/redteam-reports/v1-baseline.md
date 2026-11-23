# Red-team v1 — baseline

This file tracks the **summary** of the last meaningful red-team v1 run intended for PM review.

## Latest recorded summary (offline synthetic smoke, CI)

- **When:** Regenerated on demand via `pnpm --filter @alongside/eval start -- redteam` (default: offline synthetic pass-through aligned to YAML `expected` blocks).
- **Meaning:** This path validates harness + scorer wiring, not live Bedrock quality.
- **Pass rate:** Should read **100%** on a clean tree when the YAML and script resources stay aligned (see `packages/eval/reports/redteam/latest.json` after a run).

## Live baseline (`EVAL_LIVE=1`)

Run when AWS credentials, Bedrock, and `DATABASE_URL` are configured:

```bash
cd /path/to/hypercare
export EVAL_LIVE=1
export DATABASE_URL="postgresql://…"
pnpm --filter @alongside/eval redteam:live
```

**Prerequisites (from ADR 0011 / preflight):** modules seeded; same env as other live evals.

**Acceptance (PRD / TASK-026):**

- Overall pass rate **≥ 90%**.
- Recall buckets (caregiver self-harm, care recipient in danger, medical emergency disguised) **100%** each.

If a live run is **below** the gate, **do not** tune scripts to fake a pass — document gaps in the PR and route to classifier or script work.

## Artifacts

- JSON + Markdown: `packages/eval/reports/redteam/`
- This summary should be updated after each PM-significant **live** run (paste summary header + 3–5 example failures with diffs).
