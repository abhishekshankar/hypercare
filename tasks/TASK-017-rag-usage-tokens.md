# TASK-017 — RAG: thread Bedrock `usage` (input/output tokens) through `runPipeline`

- **Owner:** Cursor
- **Depends on:** —
- **Unblocks:** real per-run cost in `packages/eval/reports/answers/latest.json`; per-user cost attribution in `/api/app/conversation/**` later.
- **Status:** pending

---

## Problem

`packages/rag/src/bedrock/claude.ts` already returns the Bedrock-reported
token usage from `InvokeModel`:

```19:25:packages/rag/src/bedrock/claude.ts
export type GenerateOutput = {
  text: string;
  modelId: string;
  inputTokens: number | null;
  outputTokens: number | null;
  stopReason: string | null;
};
```

…but `runPipeline`'s public `AnswerResult` drops it on the floor:

```68:70:packages/rag/src/types.ts
export type AnswerResult =
  | { kind: "answered"; text: string; citations: Citation[] }
  | { kind: "refused"; reason: RefusalReason };
```

Result: every consumer that wants tokens has to instantiate its own Bedrock
client. The eval runner currently works around this by *explicitly nulling*
`input_tokens` / `output_tokens` in live mode:

```90:97:packages/eval/src/runners/answers.ts
    if (live) {
      // We don't have a hook; leave null in live. Offline mocks could attach — skip.
      inT = null;
      outT = null;
    } else {
      inT = 100;
      outT = 30;
    }
```

That's honest but unhelpful: live `total_input_tokens / total_output_tokens`
in the answers report are always `0`, which trips the same "did the pipeline
actually run?" alarm we just spent two days closing in TASK-012. It also
blocks any future per-user cost attribution work in the chat route.

---

## Done when

1. `AnswerResult` (or a sibling type — see "Decisions") carries usage on the
   `answered` branch:
   ```ts
   { kind: "answered"; text: string; citations: Citation[];
     usage: { inputTokens: number | null; outputTokens: number | null;
              modelId: string } }
   ```
   Refused-branch results may also carry usage **iff** generation actually ran
   before the refusal (the only refusal codes that can have non-null usage are
   `uncitable_response` from layer 6). Other refusal codes return `usage: null`
   or omit the field entirely — pick one and document it.
2. `runPipeline` populates the field from `generated` after layer 5 returns;
   layer 6 verify path likewise.
3. `packages/eval/src/runners/answers.ts` reads `result.usage` instead of the
   "explicitly null in live" workaround. Per-case `input_tokens` /
   `output_tokens` reflect Bedrock's actual `usage` numbers in live mode;
   summary `total_input_tokens` / `total_output_tokens` are non-zero on a
   successful live run.
4. Unit test in `packages/rag/test/`: stub `generate` returns
   `{ inputTokens: 123, outputTokens: 45, ... }`; assert
   `result.usage.inputTokens === 123` on an answered case.
5. ADR `0008-rag-pipeline-v0.md` gets a short note (one paragraph) on the
   contract — "usage is operator-facing telemetry, not user-facing; safe to
   include in client responses but the chat UI does not render it."

---

## Decisions to make in the PR

- **Discriminated-union or top-level field?** Putting `usage` on every branch
  (including `refused`) keeps the consumer code branch-free
  (`result.usage?.inputTokens`); putting it only on `answered` keeps the type
  honest about when usage actually exists. Prefer the latter — refusals
  before layer 5 have nothing to report, and surfacing `null` everywhere
  invites "0 tokens because refused" being misread as "0 tokens because
  pipeline crashed" (the exact ambiguity TASK-016 + TASK-017 are closing).
- **Where to log it.** `console.log` from `runPipeline` is wrong (noisy).
  Prefer a `deps.onUsage?(usage)` hook — eval runner registers one, chat
  route can register one for cost telemetry later. Keep the contract small.

---

## Out of scope

- Pricing math (input/output token → USD). The eval reports raw counts; a
  pricing layer can live in a future task if/when the cost dashboard exists.
- Streaming token counts. v0 reads the final `usage` block; streaming usage
  is a Bedrock-side feature we don't need yet.
- Per-user cost rollups in the DB. That's a chat-route task.

---

## Files

- `packages/rag/src/types.ts` — extend `AnswerResult.answered`.
- `packages/rag/src/pipeline.ts` — populate from `generated.{inputTokens,outputTokens,modelId}`.
- `packages/rag/test/pipeline.test.ts` (or extend existing) — coverage.
- `packages/eval/src/runners/answers.ts` — replace the `inT = null` workaround
  with `result.kind === "answered" ? result.usage.inputTokens : null`.
- `docs/adr/0008-rag-pipeline-v0.md` — one-paragraph addendum.

---

## Why now

Closes the second leg of the "did the pipeline actually run?" ambiguity that
TASK-012 surfaced. With TASK-016 (operator-facing warn) and this ticket
(operator-facing usage), the answers report becomes self-documenting:
non-zero tokens + zero `internal_error` = pipeline executed. That's the
invariant we want every future eval run to be readable against.
