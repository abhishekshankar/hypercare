# ADR 0020 — Streaming answers (conversation surface)

## Status

Accepted — TASK-031 (Sprint 3).

## Context

Layer 5 (Bedrock generation) dominates perceived latency. Showing nothing until the full completion + Layer 6 verify completes feels broken on mobile, especially given the PRD’s ordered response scaffold (direct answer first).

## Decision

1. **Transport:** Server-Sent Events (`text/event-stream`) over `fetch()` (POST + `Authorization` cookies). Not `EventSource` (GET-only). NDJSON was considered; SSE gives typed `event:` lines without a new dependency.

2. **What streams:** Only Layer 5 token deltas. Classifier, retrieval, and Layer 6 **full** verify stay non-streaming. Escalation / safety-triage and grounding failures return a **single** `refusal` event (atomic), never `chunk`.

3. **Layer 6 under stream (Option C):** Progressive commit with a **tail reserve** (default 200 chars, tunable in `packages/rag/src/config.ts` as `streamCommitTailReserve`) and a **minimum window** (`streamCommitMinChars`, default 120). When the draft has a complete sentence in the eligible window, the prefix is checked by a **regex-only fast-path verifier** (medication names, doses, diagnosis assertions, long verbatim quotes, “I recommend…”, “I diagnose…”). Passing prefixes are emitted as `chunk` events. On fast-path failure, the stream **aborts** with `refusal` `{ code: "verifier_rejected" }` (no mid-stream regeneration — avoids jarring rewrites). After the model finishes, **one** full Layer 6 pass runs on the full draft; on failure, `refusal` is emitted and no partial answer should remain committed inconsistently (client replaces with persisted refusal row).

4. **Cancellation:** `AbortSignal` from the incoming request (client disconnect or Escape-driven `fetch` abort). Pipeline returns `user_cancelled`; assistant content is not a successful answer. Persistence: user row + assistant refusal row (empty content) for thread continuity.

5. **Feature flag:** `STREAMING_ANSWERS=1` on the server **and** `NEXT_PUBLIC_STREAMING_ANSWERS=1` in the browser so the client sends `Accept: text/event-stream`. Without the server flag, responses stay JSON even if the client asks for SSE.

6. **Back-compat:** Clients send `Accept: application/json` (or omit stream accept) for the legacy one-shot JSON body. **Deprecated** for interactive UI; removal targeted a later sprint once E2E fully migrates.

## Observability

- Structured logs: `rag.stream.complete` with `first_chunk_ms`, `total_ms`, outcome.
- `/internal/metrics` includes P50/P95 first-chunk latency and “refusal after stream started” from `messages.stream_first_chunk_ms` / `stream_total_ms`.

## Acceptance notes (dev hardware)

Record P50/P95 first-chunk against your deployment after soak; baseline hardware and region in runbooks when measuring (TASK-031 acceptance).

## Consequences

- Slightly higher server complexity (SSE framing, commit buffer).
- ~200 character client lag vs model; negligible at typical token rates.
- Fast-path does not replace full Layer 6; it only blocks obviously unsafe **prefixes** from reaching the client early.
