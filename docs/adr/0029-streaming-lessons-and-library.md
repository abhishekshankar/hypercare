# ADR 0029 — Streaming for lessons and library (extends ADR 0020)

## Status

Accepted (Sprint 5)

## Context

Hypercare ships several surfaces where **perceived latency** matters: daily lessons (TASK-040) and the library search experience (TASK-041). ADR 0020 covers **LLM-generated** streaming for conversation answers. This ADR covers **non-LLM** streaming: the bytes are deterministic (pre-authored markdown or indexed rows), but the **transport** is still SSE so the client can paint incrementally and abort cleanly.

## Decision

1. **Lessons (TASK-040)** use GET `/api/app/lesson/[slug]` with `Accept: text/event-stream` when both `STREAMING_LESSONS` flags are on. Events include `started`, `card`, `done`, `error`. Telemetry lands in `lesson_stream_telemetry`.
2. **Library search (TASK-041)** uses POST `/api/app/library/search` with `Accept: text/event-stream` when both `STREAMING_LIBRARY` flags are on. The route returns **404** when the server flag is off so the client can fall back to the legacy client-side filter.
3. **No Layer-6 verifier** on these paths: there is no generative model at render time for lessons or substring search.

## Library results (TASK-041)

### Event vocabulary

```
event: started   data: { query, candidateCount }
event: result    data: { id, kind, title, snippet, score, source, conversationId?, messageId?, module? }
event: done      data: { latencyMs, resultCount }
event: error     data: { message }
```

- No `card`, `chunk`, `citations`, or `refusal` events (distinct from conversation streaming).
- `query` in `started` is normalized (trimmed, lower-cased). **Logs and the database must never store raw query text** (privacy); only `query_length` and counts.
- `kind` is one of `saved_answer | recent_topic | bookmarked_module`. v1 indexes **saved answers** (per `user_id`) plus the **published module catalog** (`bookmarked_module` transport kind; profile-scoped bookmarks are a follow-up when the bookmark table exists). `recent_topic` is reserved for a future signal.
- `score` orders matches (substring position weighting via shared `@alongside/db` helper). Semantic / embedding search is out of scope for v1 (Sprint 6 conversation).

### Candidate set and TASK-038

- Saved answers: `saved_answers.user_id = session user`, joined through `messages` and `conversations` with `conversations.user_id = session user` (defence in depth).
- Modules: published catalog visible for search (shared content). `getCareProfileForUser` resolves `care_profile_id` for telemetry and future bookmark scoping when the data model lands.
- Co-caregivers do **not** see another member’s saved answers in search results (per-user saves).

### Client behaviour

- Search is **debounced at 150ms** when the client flag is on (200ms when off, matching the pre-TASK-041 cadence).
- In-flight requests are **aborted** when the query changes or the input is cleared.
- **Escape** clears the search input and aborts the stream.
- Results list uses **`aria-live="polite"`** so incremental matches are announced without being aggressive.

### Observability

- Structured logs: `library.search.started_at`, `library.search.first_result_at`, `library.search.done_at` with `user_id`, `query_length`, `candidate_count`, `result_count` only.
- Table `library_search_streams` stores timestamps and counts (no query text).
- `/internal/metrics` includes a **Library search streaming** tile (P50/P95 first result, P50/P95 done) sourced from `library_search_latency.sql`.

### Latency targets (dev, ~50 candidates)

- Strawman from TASK-041: P50 first result ≤ 200ms, P95 ≤ 500ms after flags soak; validate on a seeded library cohort.

## Consequences

- Operators can roll back **library** streaming independently of **lessons** and **answers** using per-surface env flags.
- Metrics SQL must stay in sync with telemetry columns when evolving the stream.
