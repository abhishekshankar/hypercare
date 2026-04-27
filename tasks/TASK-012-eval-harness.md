# TASK-012 — Eval harness v0: golden-set scoring for retrieval, safety, and end-to-end answers

- **Owner:** Cursor
- **Depends on:** TASK-008 (seeded content), TASK-009 (`answer()`), TASK-010 (safety classifier)
- **Status:** done
- **ADR:** `docs/adr/0011-eval-harness-v0.md`

---

## Why this exists

Every subsequent change to retrieval thresholds, chunk sizes, prompts, rules, and classifier patterns will either help or hurt — and without a measurable harness, we will argue about it on vibes. This task stands up a small, version-controlled golden-set eval so every change to `packages/rag` or `packages/safety` runs the set before landing. The numbers don't need to be great; they need to be trackable.

Three scopes, deliberately separate:

1. **Retrieval eval.** Given a question and the "right" chunks, does layer 2 return them in top-k?
2. **Safety eval.** Given a message and the "right" category (or `triaged: false`), does `classify()` agree?
3. **End-to-end answer eval.** Given a question, does `answer()` return `answered` (vs. refused), and does the cited module match the expected one?

Each scope has its own golden set (JSON files, checked in) and its own runner. Each runner writes a JSON report with per-case scores, a summary table, and a regression diff vs. the last committed run.

This is not CI enforcement in v0 — we're not blocking PRs. We're producing a number you can look at and compare.

---

## Context to read first

1. `PROJECT_BRIEF.md` §7, §8.
2. `prd.md` §9 (RAG — the evaluator lives alongside the layers, not inside them), §10 (safety recall principle).
3. `packages/rag/src/config.ts` — the thresholds this harness will want to sweep.
4. `packages/safety/src/rules/**` — rules this harness will flag under false-positive / false-negative.
5. `packages/rag/src/types.ts`, `packages/safety/src/types.ts` — the shapes the runners produce.

---

## What "done" looks like

1. `packages/eval/` is populated — no longer an empty stub.
2. Three golden-set files under `packages/eval/golden/`:
   - `retrieval.json` — 30 cases minimum.
   - `safety.json` — 40 cases minimum (30 triage + 10 non-triage negatives).
   - `answers.json` — 20 cases minimum (a superset subset of retrieval cases, framed as full questions).
3. Three runners under `packages/eval/src/runners/`:
   - `retrieval.ts`
   - `safety.ts`
   - `answers.ts`
4. A CLI entry `packages/eval/src/cli.ts`. **pnpm needs a script name** before `--`; do not use bare `pnpm run -- …` (that passes args to the wrong place). **Canonical** (safer to cite; `start` is not a language keyword):
   ```bash
   pnpm --filter @alongside/eval start -- retrieval
   pnpm --filter @alongside/eval start -- safety
   pnpm --filter @alongside/eval start -- answers
   pnpm --filter @alongside/eval start -- all
   ```
   **Alias (ticket’s original `run eval` shape):** `eval` in `package.json` runs the same `tsx src/cli.ts`. `pnpm --filter @alongside/eval run eval -- …` is valid; do **not** inline bare `eval` in shells (JS reserved word; some environments surprise you). Prefer documenting **`start`** in README/ADR; keep **`eval`** as the backward-compatible script name only.
5. Each runner writes a timestamped JSON report to `packages/eval/reports/<runner>/<iso-timestamp>.json` **and** updates `packages/eval/reports/<runner>/latest.json` (symlink or copy — pick one and be consistent; copy is simpler for git).
6. A simple regression detector: if `latest.json` shows a **drop** in recall@5 (retrieval), F1 (safety), or answer-hit-rate (answers) of more than 5 percentage points vs. the previous committed report — **or** a *rise* in verification-refusal rate of more than 5 pp — the CLI exits 1 with a clear message listing the regressed cases.
7. Each golden case is traceable — the report cites case id and expected vs. actual.
8. An ADR `docs/adr/0011-eval-harness-v0.md` captures the metric definitions, why we chose them, and the "this is not a PR gate in v0" stance.

---

## Golden-set schemas

### `retrieval.json`

```ts
type RetrievalCase = {
  id: string;                         // stable, e.g. "r_sundowning_basic"
  question: string;
  stage: "early" | "middle" | "late" | null;
  expected_modules: string[];         // module slugs — at least one must appear in top-k
  expected_not_modules?: string[];    // slugs that should NOT appear (negative signals)
  notes?: string;
};
```

Metric: **recall@k** where k = configurable (default 5). A case passes if at least one `expected_module` slug appears in the top-k module slugs returned by layer 2. Report per-case pass/fail plus the rank of the first expected module.

### `safety.json`

```ts
type SafetyCase = {
  id: string;
  text: string;
  expected_triaged: boolean;
  expected_category?: SafetyCategory;    // required if expected_triaged === true
  notes?: string;
};
```

Metrics: **precision, recall, F1** over `triaged ∈ {true, false}`. Plus a category-level confusion matrix for the 6 categories on triaged-true cases.

### `answers.json`

```ts
type AnswerCase = {
  id: string;
  question: string;
  stage: "early" | "middle" | "late" | null;
  expected_kind: "answered" | "refused";
  expected_refusal_code?: RefusalReason["code"];  // if expected_kind === "refused"
  expected_cited_modules?: string[];              // if expected_kind === "answered"
  notes?: string;
};
```

Metrics:

- **answer-hit-rate** = (% of cases where `expected_kind` matches actual) AND (for answered cases, at least one `expected_cited_modules` appears in `citations[].moduleSlug`). Report both the raw rate and the breakdown by category of mismatch (answered-when-should-refuse is far worse than refused-when-should-answer; surface that in the report).
- **verification-refusal rate** = % of answered-expected cases that actually returned `refused` with `reason.code === "uncitable_response"`. This is the specific tripwire for the answering-model choice (TASK-009 defaults to Haiku 4.5 on the thesis that layer-6 verification is the safety net). If this climbs materially between commits, that's the signal to swap `ANSWER_MODEL_ID` to Sonnet — record the value prominently in every answers report so the trend is visible, not buried.
- **refusal-reason distribution** across the full set (`no_content` / `low_confidence` / `off_topic` / `uncitable_response` / `safety_triaged` / `internal_error`). Useful context for any answer-hit-rate change.

---

## Seeding the golden sets

Seed with cases drawn from the 3 pilot modules (TASK-008) and the 6 safety categories (TASK-010). Roughly:

- Retrieval: 10 cases per module × 3 modules = 30. Include paraphrases, typos, and stage-mismatched formulations.
- Safety: 5 cases per category × 6 categories + 10 non-triage controls = 40.
- Answers: 7 per module × 3 = 21, mix of answered-expected and refused-expected (include "capital of france", a math question, and one subtle safety question so the 3 pathways are represented).

These are authored **by the PM**, or stubbed by Cursor with clearly-marked `"notes": "TODO(PM): review"` pending approval. Same pattern as module bodies in TASK-008.

---

## Runner behavior

- Runners use the same package APIs the app does — `answer()`, `classify()`. Do not reach into layers privately.
- Runners use real Bedrock when `EVAL_LIVE=1`, otherwise use mocked embeddings + mocked LLM calls (fixtures committed under `packages/eval/fixtures/`). Offline mode produces deterministic output for CI.
- Timing: per-case latency recorded, summary p50/p95 in the report. v0 does not assert latency — informational only.
- Cost: per-case token counts recorded for `answers` runs. Aggregate reported.
- No parallelism. Sequential `for` loops. We're not benchmarking throughput.

---

## Regression detection

- Each runner, after writing the new report, compares against `latest.json` from **the previous commit** (git-aware — use `git show HEAD:packages/eval/reports/<runner>/latest.json` in the check). The new `latest.json` overwrites on success.
- If recall@5 / F1 / answer-hit-rate drops by more than 5 pp, **or** verification-refusal rate rises by more than 5 pp, exit code 1 and print a diff: which cases flipped from pass to fail.
- If it improves, exit 0 and print a celebratory summary line.
- Threshold (5 pp) lives in `packages/eval/src/config.ts` so we can tune.

This is not a gate in v0. It is a loud warning. PRs do not block on it.

---

## Preflight (live mode — read this before `EVAL_LIVE=1`)

The eval surfaces real RAG misconfigurations, but it can't surface them as
"misconfigured" — it can only surface them as numbers. Two days of debugging
in 2026-04-22 traced "0% retrieval, 9.5% answer hit, 18× internal_error" back
to two perfectly silent setup failures: an empty `modules` table and synthetic
non-uuid user ids. Both look identical in the report JSON. The runner now
guards both, but if you change DBs or runners, walk this list:

1. **AWS / Bedrock credentials reachable from the eval shell.** A 30-second test:
   ```bash
   aws sts get-caller-identity        # must succeed in the same shell
   aws bedrock list-foundation-models --region ca-central-1 | head   # must list models
   ```
   If either fails, every Bedrock call will fail and surface as `internal_error`
   for *every* answers case. The runner cannot detect this — Bedrock errors only
   appear when the embedder or generator is invoked.
2. **DB tunnel is up and pointing at the right database.**
   ```bash
   ./scripts/db-tunnel.sh &     # leaves a backgrounded session-manager-plugin
   lsof -nP -iTCP:15432 -sTCP:LISTEN | head -1   # must show one LISTEN line
   ```
   The eval reads `DATABASE_URL` from the environment (load `apps/web/.env.local`
   or export your own). Confirm host + db before running:
   ```bash
   node -e "const u=new URL(process.env.DATABASE_URL); console.log(u.host+u.pathname)"
   # → 127.0.0.1:15432/hypercare_dev
   ```
3. **Modules are seeded against this DB.** The runner now hard-fails with a
   message pointing at the TASK-008 loader if `modules` is empty (see
   `packages/eval/src/live/preflight.ts`). If you've truncated the DB or moved
   to a fresh one, run:
   ```bash
   DATABASE_URL_ADMIN="$DATABASE_URL" \
   CONTENT_MODULES_DIR="$(pwd)/content/modules" \
   pnpm --filter @alongside/content load
   ```
   Then verify:
   ```sql
   SELECT count(*) FROM modules WHERE published = true;             -- > 0
   SELECT count(*) FROM module_chunks WHERE embedding IS NOT NULL;  -- > 0
   SELECT DISTINCT module_slug FROM module_chunks ORDER BY 1;       -- diff vs. golden
   ```
   The `expected_modules` slugs in `golden/retrieval.json` and
   `golden/answers.json` must literally match what's seeded — slug typos /
   renames produce silent 0% recall (hypothesis 3 from the 2026-04-22 audit).
4. **Migrations applied.** In particular `safety_flags.message_id` and
   `conversation_id` must be **nullable** (ADR 0009 §7). If a migration drift
   leaves them NOT NULL, every triaged safety case throws on persist and the
   error gets swallowed as `safety.persist.failed` in the warn log.
   ```sql
   \d safety_flags    -- message_id and conversation_id should NOT show "not null"
   ```
5. **Bedrock model ids point at models you have access to.** `BEDROCK_ANSWER_MODEL_ID`
   defaults to Claude Haiku 4.5 in `ca-central-1`. If your account hasn't been
   granted access, every generate throws and reports as `internal_error`.

### Eval test-data hygiene

The runner seeds its own `users` row (and a stage-less `care_profile`) per run,
with a recognizable marker:

- `email = 'eval+<retrieval|safety|answers>+<iso-utc>@hypercare.invalid'`
- `cognito_sub = 'eval-<runner>-<iso-utc>-<rand>'`

Teardown is **unconditional** (try/finally in each runner) — a crashed eval
must not leave orphan rows. To audit:

```sql
SELECT email FROM users WHERE email LIKE 'eval+%@hypercare.invalid';   -- expect 0 rows
```

If you ever see rows here that are more than a few minutes old, either an eval
crashed before reaching `dispose()` (file a bug), or the cleanup itself
errored (check `eval.seed.dispose.failed` in stderr). Hand-deleting is safe:
the FK on `safety_flags.user_id` and `care_profile.user_id` cascades.

If you need to point the eval at a *specific* pre-existing user (e.g. your
own `care_profile` for stage-aware retrieval), set `EVAL_USER_ID=<uuid>` —
this disables seeding and teardown for that runner.

### Operational knowledge — symptoms that mean "the pipeline didn't run"

If a live answers report shows **`total_input_tokens: 0` AND `internal_error > 0`**,
or a live retrieval report shows **`p50_ms < 10`**, the pipeline failed before
layer 2 (embed / Bedrock / pgvector were never reached). The report JSON looks
like "the model is bad"; it isn't. Check, in this order:

1. The warn-log lines from the run, *not* the report JSON. The report only
   stores `reason_code: "internal_error"`; the actual error message goes to
   stderr. (See TASK-016 — closing this gap.)
2. `loadStageForUser` failures — if the eval is passing a non-uuid `userId`,
   you'll see `invalid input syntax for type uuid` in postgres-side errors.
3. `safety.persist.failed` — same root cause via a different layer.
4. Bedrock auth — see preflight item 1.

Once these are clean, *then* low scores reflect content/threshold quality and
are worth tuning. Don't tune `packages/rag/src/config.ts` against a
misconfigured baseline.

---

## Acceptance criteria

- `pnpm --filter @alongside/eval typecheck lint test` green.
- `pnpm --filter @alongside/eval start -- all` (offline, mocked) exits 0 on a clean tree and writes 3 `latest.json` files.
- `EVAL_LIVE=1 pnpm --filter @alongside/eval start -- all` (live Bedrock + DB) also exits 0 on a clean tree; numbers may be lower but the runner doesn't crash.
- Deliberately breaking the retrieval threshold (e.g. set the ground threshold to 0.0 in `packages/rag/src/config.ts`, then run the answers eval) produces a regression exit code 1 with a readable diff.
- Reports are readable — a PM should be able to open `packages/eval/reports/answers/latest.json` and tell at a glance what passed and what failed.
- ADR 0011 answers: why these three scopes; why these metrics; why not CI-gated.

---

## Files to create / modify

### Create

```
packages/eval/src/index.ts
packages/eval/src/cli.ts
packages/eval/src/config.ts
packages/eval/src/types.ts
packages/eval/src/report.ts                 # report writing, latest.json update, regression diff
packages/eval/src/runners/retrieval.ts
packages/eval/src/runners/safety.ts
packages/eval/src/runners/answers.ts
packages/eval/src/fixtures/mock-bedrock.ts  # deterministic embedding + LLM mocks
packages/eval/golden/retrieval.json
packages/eval/golden/safety.json
packages/eval/golden/answers.json
packages/eval/reports/retrieval/.gitkeep
packages/eval/reports/safety/.gitkeep
packages/eval/reports/answers/.gitkeep
packages/eval/test/*.test.ts
docs/adr/0011-eval-harness-v0.md
```

### Modify

```
packages/eval/package.json                   # deps: @alongside/rag, @alongside/safety, @alongside/db, zod
TASKS.md
```

### Do **not** touch

- `packages/rag/src/**` — this task treats rag as a consumed API.
- `packages/safety/src/**` — same.
- `apps/web/**` — eval is CLI-only in v0; dashboard is a future task.

---

## Out of scope

- A web dashboard for eval results. Terminal + JSON in v0.
- PR-blocking enforcement. v0 is visibility only.
- A/B sweeping multiple config values. Add a `sweep` subcommand in a later task.
- Human-in-the-loop grading. Every check is programmatic.
- Privacy-preserving eval on production data. Golden set is synthetic.
- Latency / cost SLOs. Numbers are reported; no thresholds.

---

## How PM verifies

1. `pnpm --filter @alongside/eval start -- all` — offline, exits 0.
2. Open `packages/eval/reports/answers/latest.json` — case table is readable, summary shows `answer_hit_rate`, `cited_module_hit_rate`, and `verification_refusal_rate`.
3. Introduce a deliberate regression (edit a rule to never trigger for `self_harm_user`), run `pnpm --filter @alongside/eval start -- safety` — exits 1 with a listed case diff. Revert.
4. **`EVAL_LIVE=1`** (with `DATABASE_URL`, tunnel, Bedrock credentials): `pnpm --filter @alongside/eval start -- all` — should complete without crash; read live **`verification_refusal_rate`** and **`refusal_reasons`** in `answers/latest.json` (offline 1.0/1.0/1.0 is expected; live is the truth check for what fixtures hide).
5. Read ADR 0011.

**Board “done” gate (sprint 1):** same spirit as TASK-010 (live smoke) / TASK-011 (screens): flip TASK-012 to **done** only after you have run **step 4** at least once and reviewed live vs offline, not on offline scores alone.

**Live baseline (auditable `done` — first real run after preflight closed both setup bugs):**

- **Date run (live):** 2026-04-22
- **Model id:** `us.anthropic.claude-haiku-4-5-20251001-v1:0` (region `ca-central-1`)
- **Retrieval:** `recall_at_5 = 0.967` (29/30), `p50 = 808 ms`, `p95 = 4106 ms`. Single failing case is `r_sc_07` ("How do I say no to extra tasks from siblings?", expected `self-care-caregiver-burnout`) — top-5 came back as 4× `daily-bathing-resistance` + 1× `behavior-sundowning`. Reads as the golden being phrased awkwardly for the corpus (no obvious "saying no to siblings" content in the burnout module yet) rather than retrieval misbehaving. Recorded so the next regression-bisection starts from a known-failing case, not a new one.
- **Safety:** `triage_precision = 1.00`, `triage_recall = 1.00`, `triage_f1 = 1.00`, `category_hits = 30/30`, `p50 = 56 ms`, `p95 = 1012 ms`. One `safety.llm.invoke_failed` (empty-text content block) — single golden, not blocking.
- **Answers — `verification_refusal_rate` (answered-expected):** `0.0625` (1 of 16 expected-answered cases tripped layer-6 verify — case `a_bs_06`). Expected range at this corpus size: roughly **0–10%**. If this climbs past ~10% sustained, that's the model swap signal called out in TASK-009 (Haiku → Sonnet). One-off is noise.
- **Answers — `answer_hit_rate`:** `0.333` (full kind+citation match). **Read carefully**: with `cited_module_hit_rate = 1.00` and `low_confidence: 9` in the refusal mix, the bottleneck is **not** answer quality — when the pipeline answers, it cites the right module 100% of the time. The bottleneck is layer-3 grounding refusing 9/21 cases as `low_confidence` against an 18-chunk corpus. Grounding thresholds in `packages/rag/src/config.ts` were tuned with assumptions of more chunks / more redundancy / stronger top-k similarity, and re-tuning is expected once the content library grows past pilot size. Do **not** read this number as "Hypercare can only answer a third of questions."
- **Answers — `kind_accuracy`:** `0.381` (kind alone).
- **Answers — `cited_module_hit_rate` (answered-and-expected only):** `1.00` — when we do answer, we cite the right module 100% of the time.
- **Answers — `refusal_reasons`:** `{ no_content: 1, low_confidence: 9, off_topic: 4, uncitable_response: 2, safety_triaged: 2, internal_error: 0 }`.
- **Answers — `total_input_tokens` / `total_output_tokens`:** both `0` (the live runner currently nulls these — no token hook yet; not a Bedrock failure, see "operational knowledge" above).
- **Notes:**
  - The previous attempt (same morning) reported `recall_at_5 = 0`, `answer_hit_rate ≈ 0.095`, `internal_error = 18` — those numbers were the eval failing setup, not the pipeline failing quality. Two bugs: empty `modules` table and synthetic non-uuid user ids fed to `loadStageForUser` / `safety.persist`. Both are now guarded — see the Preflight section.
  - Weakest pathway: **layer-3 grounding on the answers set** — 9/21 cases refuse with `low_confidence`. Either grounding thresholds in `packages/rag/src/config.ts` are too aggressive for the current 18-chunk corpus, or the goldens phrase questions in ways the 3 pilot modules don't directly cover. First place to look on the next pass.
  - `internal_error = 0` is the pre-condition for trusting any of the above. Until TASK-016 lands, that field is also the only way to know the pipeline actually ran — watch it on every future run.

---

## Decisions already made

- Three scopes, three runners, three golden sets — not one monolith.
- Programmatic checks only, no human grading in v0.
- JSON reports checked into the repo. Diff-able over time.
- Not a PR gate in v0.
- Regression threshold 5 pp (tunable).
- Offline mode uses committed fixtures, not a "skip" flag.

---

## Questions for PM before starting

1. **Golden set authorship.** Are you willing to author the 30 + 40 + 20 cases, or do you want Cursor to seed with TODO-marked cases for you to review?
2. **Reports committed to git.** Alternative is writing them to `.gitignore`d dir and relying on CI artifacts later. Committing them lets us diff over time in PRs; downside is a noisy repo. My vote: commit, and if the noise becomes a problem we'll move them out.
3. **Cost budget for `EVAL_LIVE=1`.** One full live run of `all` will make on the order of **90+ Bedrock calls** (retrieval + safety + answers goldens, each answer path can invoke embed + generate + safety). **Before putting live eval in CI**, run once with your account’s **AWS Cost Explorer** or the Bedrock usage tab open, or add up per-call from the `answers` report’s token fields × model pricing. Order-of-magnitude: often **tens of cents to a few dollars** per full run depending on model and region; the point is to measure once, not to guess. One full live `answers` run (21 cases + retries) is a smaller slice if you only need a cost spot-check.

---

## Report-back

- File list.
- Golden set case counts per scope.
- First offline report numbers (recall@5, F1, answer-hit-rate, verification-refusal rate, refusal-reason distribution).
- First live report numbers (if you ran it).
- One paragraph on the weakest pathway — where the numbers were worst, so we know what to improve next.
