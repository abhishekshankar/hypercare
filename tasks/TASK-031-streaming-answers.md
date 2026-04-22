# TASK-031 — Streaming answers for the conversation surface

- **Owner:** Cursor
- **Depends on:** TASK-009 (RAG pipeline — Layer 5/6 is where streaming plugs in), TASK-011 (conversation UI), TASK-025 (escalation cards render atomically; streaming must not leak into that surface)
- **Unblocks:** perceived latency; helpfulness rate on the 2am surface; any future multi-turn memory UX improvements
- **Status:** pending
- **ADR:** `docs/adr/0020-streaming-answers.md` (new — transport choice, streamed-vs-atomic decision per refusal kind, progressive attribution)

---

## Why this exists

Sprint 3 ships a vertical that is correct but slow. A normal grounded answer today:

- Classifier ~200ms
- Retrieval ~200ms
- Generation (Sonnet) 3–6s to first token on cold, 1–2s warm
- Verifier ~500ms

The user sees a blank "thinking…" for 4–7 seconds, then the answer drops in whole. On a 2am phone screen that feels broken. PRD §6.4 is silent on streaming but the response scaffold (direct answer first → why → tailored → "not alone" → chips) is **explicitly ordered so the caregiver gets the actionable sentence first.** That structure is wasted if the whole thing lands at once after a 5-second blank.

Streaming the generation stage alone closes most of the gap. The classifier + retrieval + Layer 6 verifier stay non-streaming. The hard design question is what to do about Layer 6 (post-generation verification) — if we stream and *then* fail verification, we've already shown the user a bad answer. The answer (detailed below): stream the draft behind an invisible buffer and commit it progressively only after the verifier has pass-certified the portion.

---

## Context to read first

1. `prd.md` §6.4 (response scaffold — this is why direct-answer-first matters for streaming), §9.2 Layer 5 and Layer 6 (prompt composition + verifier).
2. `packages/rag/src/pipeline.ts` — where the generation call is today. You're threading a `stream: true` path through it.
3. `apps/web/src/app/api/app/conversation/[id]/message/route.ts` — the API route that will now return an SSE stream (or NDJSON — decide in ADR) instead of a one-shot JSON.
4. `apps/web/src/components/conversation/AssistantTurn.tsx` — the render surface. Needs a streaming-aware variant.
5. `packages/safety/` — escalation responses must **not** stream. The API route branches: safety_triaged → atomic JSON (same as today); grounded answer → stream.
6. `docs/adr/0010-conversation-ui-v0.md` — for the import-boundary rules that still apply (no Bedrock in client bundles).
7. `docs/adr/0008-rag-pipeline-v0.md` §5-6 — Layer 5/6 semantics you're extending.

---

## What "done" looks like

### 1. Transport: Server-Sent Events (SSE)

The API route returns an SSE stream with a small, explicit event vocabulary:

```
event: started        data: { messageId, classifier: {...} }
event: chunk          data: { text: "..." }           # repeated
event: citations      data: { citations: [...] }      # after verifier pass
event: done           data: { tokensIn, tokensOut, latencyMs }
event: refusal        data: { code, reason, ... }     # terminal; no more events after
event: error          data: { message }               # terminal
```

- `started` fires after Layer 2 (classifier) returns and before Layer 5 begins. It carries the classifier verdict so the UI can render "thinking about bathing-resistance…" or similar, if we decide to (my vote: no, that's over-engineering for v0; just send `{}` in the started payload).
- `chunk` fires as tokens arrive from Bedrock. One chunk per streaming delta from the Bedrock response; no re-chunking.
- `citations` fires **once**, after the verifier has passed. Citations are not streamed because they depend on a full-pass Layer 6 check.
- `done` is the terminal success event.
- `refusal` is the terminal non-streaming path: if grounding fails (Layer 4) or the classifier triages, no `chunk` events fire; we emit `refusal` and close.
- `error` is the terminal failure: if Bedrock errors mid-stream, we emit an error and truncate the visible text; the UI shows "something went wrong — please try again."

### 2. Layer 6 verifier under streaming

This is the meat of the design.

Today Layer 6 runs once after the full generation. Under streaming:

- **Option A — stream direct, verify after, retract on fail.** Bad. The user sees text and then watches it disappear. Undermines trust.
- **Option B — full-buffer: buffer the entire response server-side, run Layer 6, then stream the cached text.** No real latency win (same 4s wait).
- **Option C — progressive verification: stream text to the client but apply the verifier on a rolling window (e.g. every sentence or 120 characters); hold back the last ~200 chars from the client as a "commit buffer" until verified.** This is the ship design.

Implementation:

- Server accumulates `draftBuffer` as Bedrock streams.
- Whenever `draftBuffer.length >= 120` AND the tail contains a sentence terminator, the oldest N chars (everything except the last ~200) is run through a **fast-path verifier** (regex-level banned patterns — medication names, dose amounts, diagnosis assertions, the banned-content patterns we already have in Layer 6 today). If pass → emit `chunk` events for those bytes to the client and advance the committed pointer. If fail → do not emit; fall to full Layer 6 pass on completion and, if that fails, emit `refusal`.
- On generation complete: run the **full** Layer 6 pass on the final `draftBuffer`. Pass → flush any remaining uncommitted chars + emit `citations` + `done`. Fail → emit `refusal` (no `done`), let the UI show the refusal card.
- The commit buffer means the client is always ~200 chars behind the server. Visually this is imperceptible because generation at 50 tok/s is 4–6 chars/sec — the buffer lag is under 40ms.

The fast-path verifier is **cheap** (regex + pattern list, no LLM call). The expensive full Layer 6 still runs once at the end. No doubling of LLM cost.

ADR 0020 records: we picked Option C; the fast-path verifier is regex-only; we do not run the full-pass Layer 6 progressively because it's a model call and doing it every sentence would be costly and slow.

### 3. Escalation does not stream

The API route branches **before** generation:

- If Layer 2 (classifier) triages → no generation at all → the script is rendered server-side and returned atomically as a `refusal` event. The client gets one event and renders the escalation card. Same as today's non-streaming safety path.
- If Layer 4 (grounding) fails → refusal atomic, same pattern.
- If the answer goes to generation, the stream model applies.

The escalation card does **not** accept streamed input. TASK-025's `EscalationCard` component renders a pre-scripted script; there is no partial state to represent. The conversation thread component detects `refusal.code === 'safety_triaged'` on the first event and renders the card immediately, discarding any subsequent events (defensive: they shouldn't fire).

### 4. Client rendering

`AssistantTurn.tsx` gains a streaming mode:

- On POST, use `fetch` with a readable stream (no EventSource — we need POST + Authorization headers; EventSource is GET-only).
- Parse SSE manually from the response body (small helper in `apps/web/src/lib/sse.ts`; no new dep).
- Maintain a `text` state that appends on each `chunk`.
- Render text progressively with a blinking block cursor at the tail (tailwind + a tiny CSS animation).
- When `citations` arrives, render the source-attribution footer below the text.
- When `done` arrives, remove the cursor and enable thumbs + save.
- On `refusal`, swap to the escalation or refusal card atomically.
- On `error`, show a kind "something went wrong — try again" with a retry button that re-POSTs.

**No partial "Was this helpful?" thumbs.** Thumbs render only on `done`.

**No partial citations.** The citations appear atomically after `done` or alongside it. PRD §9.2 Layer 7 — source attribution is a trust signal; half-shown citations are worse than none.

### 5. Accessibility

- Streaming text respects `prefers-reduced-motion`: the blinking cursor is replaced by a static pipe character.
- The assistive-tech `aria-live="polite"` is set on the thread container so screen readers announce the new text in reasonable chunks. Do **not** set `aria-live="assertive"` — that interrupts the user on every token and is hostile.
- Keyboard: Escape cancels a streaming response (server-side abort via `AbortController`; emits `refusal` with `code: 'user_cancelled'`).

### 6. Observability

- Every stream logs: classifier latency, retrieval latency, first-chunk latency (ms from POST receipt to first `chunk`), total stream duration, tokens in/out (TASK-017 already threaded these), whether Layer 6 full-pass committed or refused.
- `/internal/metrics` (TASK-029) gains a streaming row: P50 / P95 first-chunk latency, refusal-after-generation rate (should be rare; a spike means Layer 6 regressions).

### 7. Backwards compat

The API route previously returned `{ message, refusal?, citations? }`. Under streaming it returns SSE.

- Bump the route version: new content type `text/event-stream`.
- Clients that don't accept it (older E2E tests, any server-to-server caller) set `Accept: application/json` on the request header; the route detects this and falls back to the current one-shot JSON response. Mark the JSON path as deprecated but ship it; remove in sprint 5 once E2Es are migrated.

---

## API

```
POST /api/app/conversation/[id]/message
  Accept: text/event-stream   → SSE (new)
  Accept: application/json    → one-shot JSON (deprecated fallback)
  Body: { text: string }
```

Same route, same session gate, same zod validation. The response shape diverges on `Accept`.

---

## Tests

- Unit (`packages/rag/test/streaming/buffer.test.ts`): the 200-char commit buffer advances on sentence terminators; fast-path verifier rejects a banned-pattern chunk without committing.
- Unit (`packages/rag/test/streaming/fast-path-verifier.test.ts`): banned-patterns list (medication names, dose amounts, "I recommend", "I diagnose") trigger rejection; safe text passes.
- Unit (`apps/web/test/lib/sse.test.ts`): parser handles partial events across chunk boundaries, reconnection (not expected in v0 but shouldn't hang), malformed JSON in `data:` lines.
- Unit (`apps/web/test/conversation/streaming-turn.test.ts`): turn component advances text state on chunk events, renders cursor while streaming, hides cursor on done, swaps to escalation on refusal.
- Integration (`apps/web/test/api/conversation-streaming.test.ts`): a normal question returns SSE with `started` → N × `chunk` → `citations` → `done`; a crisis query returns SSE with one `refusal` and closes. The JSON `Accept` header path returns the legacy one-shot response.
- E2E (`apps/web/test/e2e/streaming.spec.ts`): ask a question; assert the text appears progressively (use Playwright's `waitForFunction` to see the DOM change across ≥ 3 frames). Send a crisis query; assert the escalation card renders atomically without streaming artifacts. Press Escape mid-stream; assert the response is cancelled and the thread shows a "you cancelled this" state.
- Load test (one-time, Cursor runs once to baseline): 20 concurrent streaming requests from a script; P95 first-chunk latency < 1500ms against the dev Bedrock.

---

## Acceptance criteria

- P50 first-chunk latency ≤ 800ms, P95 ≤ 1800ms against the dev deployment (recorded in ADR 0020 along with the hardware used).
- Streaming applies only to the grounded-answer generation path. Classifier-triage and grounding-fail refusals render atomically.
- Fast-path verifier catches banned patterns in the stream and prevents them reaching the client.
- Full Layer 6 pass runs on stream end. On fail, the client receives `refusal` and no partial text remains.
- Escape aborts; the server cancels the Bedrock call.
- `Accept: application/json` still returns a one-shot response for back-compat (deprecated note in code + removal scheduled for sprint 5).
- ADR 0020 written. `/internal/metrics` shows streaming latency tiles.
- `pnpm lint typecheck test` green; answers + safety eval don't regress.

---

## Out of scope

- Streaming the classifier or retrieval. Only Bedrock generation streams.
- Streaming lessons, library search, or metrics pages.
- Websockets / bidirectional. SSE is one-direction; that's sufficient.
- User-visible partial citations or partial "this was helpful."
- A streaming-aware safety classifier (running the classifier over a partial message). The classifier runs once on the full user input, pre-generation.
- Audio / voice output. Not in v1.
- Backpressure handling beyond what fetch + SSE give us natively.
- Non-English tokenization / RTL support in the streaming renderer.

---

## Decisions to make in the PR

- **SSE vs NDJSON.** SSE is well-supported, has a defined format, and browsers handle `text/event-stream` natively (even if we use fetch not EventSource). NDJSON is simpler but you lose the `event:` typing. My vote: SSE.
- **Commit-buffer size.** 200 chars is a guess; make it a tunable in `packages/rag/src/config.ts`. Log the actual buffered distribution.
- **Cancel semantics.** Escape → abort → emit `refusal { code: 'user_cancelled' }`, do not persist the partial assistant turn to `messages`. My vote: don't persist.
- **Render cursor.** `▎` block with a 1Hz blink. Respects `prefers-reduced-motion`.

---

## Questions for PM before starting

1. **Feature flag?** Ship behind `STREAMING_ANSWERS=1` env var, default off, flip on for beta cohort after a day of soak. My vote: yes. Lets us roll back without a deploy if something surprising surfaces.
2. **What happens if the commit buffer catches a banned pattern.** Today's Layer 6 on fail regenerates with a flag. Under streaming, a mid-response regeneration would jar the user. My vote: on fast-path rejection, abort the stream, emit `refusal { code: 'verifier_rejected' }`, let the UI show "I wasn't able to write a safe answer — please try asking in a different way." ADR records the decision.
3. **Thumbs-up / thumbs-down timing.** They render on `done`. If the user scrolls away mid-stream and comes back post-`done`, thumbs are visible. Correct behavior?
4. **The JSON fallback.** Confirm we can deprecate it; any internal tooling that POSTs to this route?

---

## How PM verifies

1. Set `STREAMING_ANSWERS=1` locally. Ask a normal question. Watch text render progressively. First character within 800ms of the POST on the PM's laptop.
2. Ask a crisis-shaped question ("I can't do this anymore"). Expect the escalation card to render atomically, no streaming artifacts.
3. Mid-response on a long answer, press Escape. Thread shows "you cancelled this."
4. Unset the env var. Same question renders as a blocking response (one-shot JSON path).
5. `curl -H "Accept: application/json" -X POST .../message -d '{...}'` returns a one-shot JSON (back-compat).
6. `/internal/metrics` shows the streaming row with real numbers.
7. Read ADR 0020.
