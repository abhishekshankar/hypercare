# ADR 0017 — Conversation memory (rolling summary)

**Status:** Accepted  
**Date:** 2026-04-22  
**Implements:** TASK-027

## Context

RAG `answer()` was stateless for the current thread: retrieval and generation saw only the care stage and the static profile implied by the question. Follow-up questions (e.g. "What about at night?") had no access to the prior user turn, hurting retrieval and answers.

## Decision

- Add table `conversation_memory` (1:1 with `conversations`, cascades on delete) holding a **structured markdown** summary, rough token count, `invalidated` after any `care_profile_changes` write, and `source_message_ids` for the window summarized.
- **Refresh** after every **3rd** user turn (`MEMORY_REFRESH_EVERY_N`) and on the next user message after `invalidated = true`, using **Claude Haiku** in `packages/rag/src/memory/refresh.ts`. Runs **async after** the API returns (`after()` in the message route) so P50 user latency is unchanged (observed: no extra work on the hot path; refresh is out-of-band).
- **Layer 4** user prompt: optional blocks **Profile → “What we’ve been discussing” → Question → SOURCES**. Neither block is a citation; system prompt states they are not `SOURCES`. Layer 6 still applies: only retrieved chunks are citable.
- **Banned post-checks** (regex) on the summary: medication names, diagnosis-style claims, doses, long quoted spans. One retry with a tighter user prefix; on repeated failure, **retain the previous** summary (if any) and clear `invalidated` only when a good new summary is written, or on fallback to prior text after a failed regen.
- **Query + memory** expansion for retrieval is behind `rewriteQueryWithMemory` (default **false** in v0).

## PM / privacy

- Summary text: log **metadata** (section flags, `summary_tokens`, `refresh_count`, latency) via `warn` / structured `rag.memory.*` events. **Full summary text in CloudWatch** is a team decision: prefer a **dedicated log group, 30-day retention, restricted IAM** if full text is enabled (aligns with PRD §9.4 “log every LLM call” vs privacy).
- No user-facing “what we remember” UI in v0; internal audit at `/internal/conversation/[id]/memory` (session + conversation ownership).

## Out of scope (v0)

- Cross-conversation memory; vectorized memory; user-visible transparency screen.

## Related

- Extends [ADR 0008 — RAG pipeline v0](0008-rag-pipeline-v0.md) Layer 4/5 composition.
- Invalidation wires from `applyCareProfileTransaction` when change-log rows are written.
