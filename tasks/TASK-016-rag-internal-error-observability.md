# TASK-016 — RAG: surface underlying cause on `internal_error` (operator log, not client)

- **Owner:** Cursor
- **Depends on:** —
- **Unblocks:** faster live-eval / production debugging (TASK-012 surfaced the gap)
- **Status:** pending

---

## Problem

`packages/rag/src/pipeline.ts` wraps the entire pipeline in a single top-level `try/catch`:

```108:111:packages/rag/src/pipeline.ts
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { kind: "refused", reason: { code: "internal_error", detail } };
  }
```

When something throws (e.g. `loadStage` getting a non-uuid `userId`, Bedrock auth failing,
postgres-js connection refused, embedding shape mismatch), the function:

1. **Does not call `warn`/`console.error`/any operator log.** The `err.message` and
   `err.stack` reach the returned `detail` string only.
2. The `detail` field is also **dropped by `packages/eval/src/runners/answers.ts`** —
   the per-case report only persists `reason_code: "internal_error"`. Nothing in the
   eval JSON tells you *why* the pipeline blew up.

Result: a real run can fail 18/21 cases with `internal_error` and produce **zero
actionable log lines**. We hit this during the TASK-012 live eval — the actual cause
(a uuid type mismatch in `loadStageForUser`) was only found by manually re-tracing
through the pipeline. In production this would be a 2-hour debug instead of a 10-minute one.

This is *not* a "leak the error to the client" bug — `detail` going back to the
caller is the right shape for the UI. The bug is purely operator-side observability.

---

## Done when

1. When `runPipeline`'s top-level `catch` fires:
   - It calls a `warn(msg, ctx)` on a deps hook (e.g. `deps.warn` or reusing the
     `safety.warn` shape) with **at minimum** `err.message`, `err.stack`,
     `err.name`, the `userId`, and the truncated question (first ~120 chars,
     never the full PII payload).
   - The shape is structured (object), not an interpolated string, so it lands well
     in CloudWatch / `console.warn` filters.
2. The returned `AnswerResult` is unchanged from the client's perspective —
   `{ kind: "refused", reason: { code: "internal_error", detail } }`.
3. `packages/eval/src/runners/answers.ts` captures the `detail` string into the
   per-case report (new optional `reason_detail?: string` field), and the
   summary surfaces a count of distinct first-line `detail`s when
   `internal_error > 0`. PMs reading `latest.json` can tell the difference between
   "18 different bugs" and "18× the same bug."
4. Unit test in `packages/rag/test/` that throws from a stub `loadStage` and asserts
   `warn` was called with `err.message`, `err.stack`, and the userId.
5. Brief note in `docs/adr/0008-rag-pipeline-v0.md` (one paragraph) — "errors are
   swallowed for the client but logged for operators; see the warn hook."

---

## Out of scope

- Per-layer error boundaries / partial-success reporting. Top-level catch only.
- Telemetry / metrics emission (CloudWatch metric counters, Datadog, etc.). Just
  the structured warn for now.
- Redacting potentially-sensitive content beyond the question truncation noted above.
- Touching `safety` package — it already has a `warn` hook with the right shape.
- Changing the public `RefusalReason` type. Add to the *report*, not the contract.

---

## Files

- `packages/rag/src/pipeline.ts` — add `deps.warn?` (or reuse safety's), call on catch.
- `packages/rag/src/deps.ts` — wire a default `warn` (likely `console.warn`) in `buildDefaultDeps`.
- `packages/rag/test/pipeline.test.ts` (or new file) — coverage for the catch path.
- `packages/eval/src/runners/answers.ts` — persist `reason_detail`.
- `packages/eval/src/types.ts` — extend `AnswerCaseReport` with optional `reason_detail`.
- `docs/adr/0008-rag-pipeline-v0.md` — short addendum.

---

## Why now

TASK-012's live eval surfaced this on day 1. Every future eval run, every
production triage, and every "why did the answer refuse?" debug session will pay
the cost of this gap until it's closed. Small, scoped fix; doesn't block any
in-flight ticket.
