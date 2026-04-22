# ADR 0022 — User-facing transparency surface (conversation memory + citations)

**Status:** Accepted  
**Date:** 2026-04-22  
**Implements:** TASK-033

## Context

The care profile is the transparency layer for personalization (PRD §6.7). TASK-020 shipped editable profile + change history. TASK-027 added rolling `conversation_memory` without a caregiver-visible mirror. Caregivers need plain-language visibility into what the model is using for continuity and citations.

## Decision

### What we expose

1. **Conversation memory** (`conversation_memory.summary_md`) per conversation: the same four headings as internal memory, with per-bullet “Forget this,” manual refresh (Haiku), and clear-for-this-conversation.
2. **Recent citations**: distinct modules cited on the user’s assistant messages in the last 30 days, with counts and deep links to `/app/modules/<slug>`.
3. **Your data**: retention + export/delete live in `PrivacyAndDataSection` (TASK-032) immediately below on `/app/profile` — one section, no duplicate tables.

### What we hide

- Cross-conversation aggregated memory (still deferred; ADR 0017).
- Raw retrieval candidates / chunk lists (internal-only).
- Hand-editing of the summary; users forget bullets or clear memory instead.

### “Forget this” semantics

- **Storage:** table `conversation_memory_forgotten(conversation_id, user_id, forgotten_text, forgotten_at)` with hard cap **30** rows per conversation (oldest age out on insert).
- **Soft enforcement:** Haiku prompt lists forgotten facts; post-generation `verifyMemorySummaryForgottenContent` does case-insensitive substring checks; one tight retry; then fallback to previous summary (same pattern as banned-content failures).
- **Display:** bullets matching forgotten text are stripped from the markdown shown until the next refresh regenerates without them.
- **Clear memory:** deletes forgotten rows for the conversation, sets `summary_md` to empty, `invalidated = true`, `source_message_ids = {}`.
- **Care-profile-derived facts:** caregivers change those in the profile editor; we do not allow “forget” to hide profile truth without an edit (copy points to the profile).

### Observability

- **User actions:** table `user_actions` records product-side events (`transparency_forget`, `transparency_refresh`, `transparency_clear`) — distinct from `admin_audit` (internal tool access).
- **Metrics:** `/internal/metrics` includes a tile + SQL for weekly “Forget this” volume to flag memory-quality issues.

## Related

- [ADR 0017 — Conversation memory](0017-conversation-memory.md)
- [ADR 0019 — Metrics surface](0019-metrics-surface.md)
- TASK-032 privacy (export/delete UI on the same profile page)
