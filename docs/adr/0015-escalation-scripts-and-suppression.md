# ADR 0015 — Escalation scripts, review discipline, and home suppression

## Status

Accepted (April 2026)

## Context

PRD §10.3 requires six expert-authored, versioned escalation flows. TASK-025 wires all six classifier categories to pre-scripted markdown in `packages/safety/src/scripts/`, renders them in the conversation surface, deduplicates `safety_flags` in a 5-minute window, and applies 24-hour in-app lesson/check-in suppression after the two caregiver-distress categories (`self_harm_user`, `abuse_caregiver_to_cr`).

## Decision

1. **One generalized UI component** (`EscalationCard`) for all categories: direct answer → primary resource buttons → markdown body → optional mandatory disclosure → reviewer footer. Legacy `TriageCard` remains for stored messages that predate script enrichment.

2. **Script files** use YAML frontmatter (`version`, `reviewed_by`, `reviewed_on`, `next_review_due`, `primary_resources`, optional `follow_up_suppression_hours`). Body uses `## Direct answer` sections; `acute_medical` may resolve to `care-recipient-in-danger.md` or `medical-emergency-disguised-as-question.md` based on wandering-related cues in the user text. `self_harm_cr` uses `## Direct answer (self_harm_cr)` inside `care-recipient-in-danger.md`.

3. **Suppression storage:** `user_suppression` table (not a column on `users`) — single row per user, `until` / `reason` / `set_at`. Re-triage in-window extends `until` to the **later** of the existing `until` and a fresh `now + 24h` (implementation: `max` of timestamps).

4. **Dedupe:** within 5 minutes, same `user_id` + `conversation_id` + `category` → update `repeat_count` and `last_message_text` on the latest matching row. No `conversation_id` → no dedupe (insert each time).

5. **Review discipline:** `scripts/check-safety-scripts.ts` + `.review-manifest.json` — body SHA-256 per file must not change without a `reviewed_on` bump. `next_review_due` must be ≥ 90 days after `reviewed_on`.

6. **i18n:** script format allows future per-locale files; v1 is US resources only (ADR not blocking Spanish v2).

## Consequences

- PM replaces placeholder `reviewed_by` names before production.
- Legal may revise mandatory disclosure; bump `reviewed_on` when the sentence changes.
- CI must run `pnpm --filter @hypercare/safety check:scripts`.
