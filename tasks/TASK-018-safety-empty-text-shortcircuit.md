# TASK-018 — Safety: short-circuit Layer B on empty / whitespace-only text

- **Owner:** Cursor
- **Depends on:** —
- **Status:** pending

---

## Problem

During the TASK-012 live answers run, exactly one golden tripped Bedrock's
content-block validator:

```
safety.llm.invoke_failed { error: 'messages: text content blocks must contain non-whitespace text' }
```

Root cause: `runPipeline` invokes Layer 0 (`classifySafety`) with the **raw**
`input.question` *before* Layer 1's `understandQuestion()` trims and scrubs:

```47:51:packages/rag/src/pipeline.ts
    // Layer 0 — Safety.
    const safety = await classifySafety(
      { userId: input.userId, question: input.question },
      { classifyDeps: deps.safety },
    );
```

When the rule layer doesn't fire and the orchestrator falls through to Layer
B (LLM), `classifyWithLlm` packs the empty/whitespace text into the
anthropic `messages[].content[0].text` field, which Bedrock rejects:

```138:138:packages/safety/src/llm/classifier.ts
    messages: [{ role: "user", content: [{ type: "text", text: input.userMessage }] }],
```

The classifier's outer `try/catch` (`classify()` in `packages/safety/src/classify.ts`)
correctly downgrades the throw to `triaged: false` and emits the warn — so
the eval doesn't crash — but we're still spending a Bedrock round trip on
input we know up front is unclassifiable. In production this also wastes a
classifier invocation per empty/whitespace turn; small but cumulative.

Layer 1 already handles the empty case correctly on its own side
(`packages/rag/src/pipeline.ts` returns `no_content` when
`understood.scrubbed.length === 0`), so the user never sees a real refusal
from this; the bug is purely "we pay Bedrock for nothing and emit a noisy
warn."

---

## Done when

1. `classify()` in `packages/safety/src/classify.ts` short-circuits when
   `text.trim().length === 0`:
   - Returns `{ triaged: false, source: "rule" }` (or whatever the existing
     non-triaged shape is — match the current type).
   - Does **not** call the rule layer (no signals to match anyway) and does
     **not** call `classifyWithLlm`.
   - Does **not** persist a `safety_flags` row (consistent with other
     non-triaged returns).
   - Does **not** emit a warn — empty input is a normal "user typed nothing
     yet" case in production, not an anomaly.
2. Unit test in `packages/safety/test/`:
   - `classify({ userId, text: "" })` → `triaged: false` without invoking
     `deps.invoke` (assert via mock).
   - `classify({ userId, text: "   \n\t  " })` → same.
   - `classify({ userId, text: "real text" })` → unchanged behavior.
3. The TASK-012 live answers run no longer prints `safety.llm.invoke_failed`
   (re-run `EVAL_LIVE=1 pnpm --filter @hypercare/eval start -- answers` and
   confirm the line is gone).

---

## Decisions to make in the PR

- **Where to short-circuit.** Three options:
  1. `classify()` orchestrator (preferred — single place, both rule + LLM paths covered).
  2. `classifyWithLlm()` (defense-in-depth, but rules-only triage on empty
     text is already meaningless).
  3. `defaultInvoke()` (lowest level — but a generic "don't send empty
     content" guard belongs in the Bedrock wrapper itself, see "Out of scope").

  Pick (1). Optionally also do (3) as a belt-and-suspenders guard since the
  same Bedrock contract applies to `packages/rag/src/bedrock/claude.ts` for
  the answer model.

- **Should layer 0 in `runPipeline` skip when `input.question.trim()` is
  empty?** Arguably yes — saves the rule-layer call too. But the existing
  ordering is intentional (safety always runs first), and Layer 1's
  `no_content` refusal is the right user-facing answer. Keep the layer 0
  call; only change is that `classify()` returns fast on empty input.

---

## Out of scope

- A generic Bedrock-wrapper guard (`packages/rag/src/bedrock/claude.ts`)
  could also short-circuit on empty `userPrompt` for symmetry. File a
  follow-up if needed; not strictly required to close this ticket.
- Re-running the full safety golden set — the goldens themselves don't have
  empty cases; this regression test belongs in unit-land.

---

## Files

- `packages/safety/src/classify.ts` — add the empty-text guard.
- `packages/safety/test/classify.test.ts` (or new file) — coverage.

---

## Why now

Five-minute fix, one-line bug, easy to forget. Filing while the exact error
signature is in hand.
