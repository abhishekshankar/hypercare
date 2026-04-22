# ADR 0011 — Eval harness v0 (TASK-012)

## Status

Accepted — 2026-04-22 (sprint 1)

## Context

RAG, prompts, and safety rules will keep changing. Without a version-controlled golden set and repeatable runs, we only have anecdotal quality. The PRD (§9, §10) points at layered RAG and safety **recall** as design principles, not as numbers we can trend — this ADR makes those ideas measurable in three **separate** scopes so a regression in one does not drown the others.

## Decision

- **How to run (canonical vs alias):** The canonical pnpm entry is **`start`** — e.g. `pnpm --filter @hypercare/eval start -- <retrieval|safety|answers|all>` (defined in `packages/eval/package.json` as `tsx src/cli.ts`). A second script key **`eval`** is **the same command**, kept so early ticket wording that said `run eval -- …` still works. Prefer **`start`** in new docs: `eval` is a JavaScript reserved word; in some shells, ad-hoc `pnpm eval` (without `run`) is a footgun. Always use `pnpm run eval` or `pnpm start` when invoking.
- Ship `packages/eval` with **three** golden JSON files (`retrieval`, `safety`, `answers`) and **three** CLIs, plus JSON reports under `packages/eval/reports/<runner>/` (timestamped files and a copied `latest.json`). **What we commit to git:** only `latest.json` per runner (regression diffs in PRs). Timestamped `reports/<runner>/*.json` are **gitignored** under `packages/eval/.gitignore` so every local run does not add noise; the harness still *writes* those files for local history.
- **Retrieval (layer 2):** `recall@K` (default K=5) — pass if at least one `expected_modules` slug appears in the first K chunk results (by ascending distance) after a full `runPipeline` run with a search wrapper that records hits. Optional `expected_not_modules` must not appear in that top-K.
- **Safety:** binary triage **precision / recall / F1** and a small **category confusion** matrix for triaged-true cases. Public API: `classify()` from `@hypercare/safety` only.
- **Answers (end-to-end):** public API is `runPipeline` / `answer()` with the same `Deps` as production. **Answer hit rate** = cases where the expected kind (answered vs refused) matches **and** (for answered) at least one `expected_cited_modules` appears in `citations[].moduleSlug`. **Verification-refusal rate** = share of *answered-expected* cases that instead refused with `uncitable_response` — the tripwire for layer-6 / model choice. Each report surfaces `model_id` (from `BEDROCK_ANSWER_MODEL_ID` or the Haiku default) so `ANSWER_MODEL_ID` / profile experiments stay visible.
- **Offline default:** `EVAL_LIVE` unset — deterministic fixtures (no Bedrock, no live DB) so CI and laptops get stable scores.
- **Live optional:** `EVAL_LIVE=1` + `DATABASE_URL` (and real Bedrock credentials in the environment) — numbers may be lower; runners must not crash.
- **Regression pointer:** after each run, compare the new `latest.json` to **`git show HEAD:packages/eval/reports/<runner>/latest.json`**. If that path does not exist in `HEAD` (new branch, first commit of reports, or file not yet merged), the check is a **no-baseline skip**: exit **0** with a short message, not an error. If `recall@5`, triage F1, or answer hit rate **drops** by more than 5 percentage points, or **verification-refusal rate rises** by more than 5pp, exit code **1** with a short list of case ids that flipped. Threshold lives in `packages/eval/src/config.ts`. (Implementation: `readGitHeadLatest` catches `git show` failure and returns `null`; `checkRegression` treats `!previous` as skip — see `packages/eval/src/report.ts`.)
- **Not a PR gate in v0** — the harness is a loud signal for humans, not a merge blocker. CI can run it in report-only mode without failing the build, or we can wire exit codes later when the golden set is stable.

## Consequences

- **Pros:** Diffs in PRs can show report JSON; three scopes keep failures interpretable; offline mode avoids cost while iterating.
- **Cons:** Committed `latest.json` can add noise; goldens need PM review (TODOs left in JSON where needed). Live runs cost real Bedrock usage (~90 invocations for `all` when nothing is cached).

## Alternatives considered

- **One combined golden set and one score** — rejected: retrieval and safety would mask each other.
- **Reports only in CI artifacts** — rejected for v0: we want time-travel diffs in git; we can move artifacts later if the repo gets noisy.
- **PR-blocking thresholds** — deferred until the numbers stabilize and PM agrees.
