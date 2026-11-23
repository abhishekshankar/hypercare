/**
 * Layer 6 — Verify the model output before returning it to the caller.
 *
 * Rules (TASK-009):
 *  - The model is allowed to emit the literal token "INSUFFICIENT_CONTEXT"
 *    instead of an answer. Treat that as a low-confidence refusal.
 *  - Otherwise, every `[n]` citation must reference a chunk index in
 *    `[1..len(sources)]`. Out-of-range = uncitable_response.
 *  - Split the answer on sentence terminators. A "claim-bearing" sentence
 *    is length >= 40 chars AND contains a verb-ish token (regex below).
 *  - Every claim-bearing sentence must contain at least one `[n]` citation.
 *    If any does not, refuse with `uncitable_response` and report the count.
 *
 * We do NOT rewrite the model's text. Either it passes verification verbatim
 * or we refuse — never silently edit.
 */

import type { Citation, RefusalReason, RetrievedChunk } from "../types.js";

export type VerifyInput = {
  rawText: string;
  sources: readonly RetrievedChunk[];
};

export type VerifyOutput =
  | { ok: true; text: string; citations: Citation[] }
  | { ok: false; reason: RefusalReason };

const CITATION_RE = /\[(\d+)\]/g;
// Heuristic verb token list (intentionally explicit, not ML).
const VERB_RE =
  /\b(is|are|was|were|can|may|should|try|avoid|use|ask|tell|reduce|increase|call|remember|help|know|feel|causes|caused|happens|happen)\b/i;

function splitSentences(text: string): string[] {
  // Replace sentence-ending punctuation followed by a space/newline with a marker.
  return text
    .replace(/([.!?])(\s+|$)/g, "$1\u0001")
    .split("\u0001")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function isClaimBearing(sentence: string): boolean {
  if (sentence.length < 40) return false;
  return VERB_RE.test(sentence);
}

function extractCitedNumbers(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(CITATION_RE)) {
    const n = Number(m[1]);
    if (Number.isInteger(n)) out.push(n);
  }
  return out;
}

export function verify(input: VerifyInput): VerifyOutput {
  const trimmed = input.rawText.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: { code: "uncitable_response", stripped_sentences: 0 } };
  }
  if (trimmed === "INSUFFICIENT_CONTEXT") {
    return {
      ok: false,
      reason: { code: "low_confidence", top_distance: Number.POSITIVE_INFINITY },
    };
  }

  const sources = input.sources;
  const validRange = sources.length;

  // 1. Out-of-range or unparseable [n] anywhere in the text => refuse.
  for (const n of extractCitedNumbers(trimmed)) {
    if (n < 1 || n > validRange) {
      return { ok: false, reason: { code: "uncitable_response", stripped_sentences: 0 } };
    }
  }

  // 2. Every claim-bearing sentence must contain at least one [n] citation.
  const sentences = splitSentences(trimmed);
  let uncitedClaims = 0;
  for (const s of sentences) {
    if (!isClaimBearing(s)) continue;
    const cites = extractCitedNumbers(s);
    if (cites.length === 0) uncitedClaims += 1;
  }
  if (uncitedClaims > 0) {
    return {
      ok: false,
      reason: { code: "uncitable_response", stripped_sentences: uncitedClaims },
    };
  }

  // 3. Build the structured Citation[] in first-cited order, deduped.
  const seen = new Set<number>();
  const order: number[] = [];
  for (const n of extractCitedNumbers(trimmed)) {
    if (seen.has(n)) continue;
    seen.add(n);
    order.push(n);
  }
  const citations: Citation[] = order.map((n) => {
    const c = sources[n - 1]!;
    return {
      chunkId: c.chunkId,
      moduleSlug: c.moduleSlug,
      sectionHeading: c.sectionHeading,
      attributionLine: c.attributionLine,
    };
  });

  return { ok: true, text: trimmed, citations };
}
