/**
 * Layer 1 — Understand the question.
 *
 * Responsibilities:
 *  - trim whitespace
 *  - best-effort PII scrub (NOT a privacy boundary; see ADR 0008): replace
 *    emails, 10–11 digit phone-like runs, and 4+ digit number runs with
 *    `<redacted>` so we don't accidentally embed/log PII.
 *  - return both the original question (for the citation log) and the
 *    scrubbed question (used for embedding + prompt input).
 *
 * The scrub is deliberately simple regex, not ML. False positives are OK;
 * the actual privacy boundary is the auth wall + TOS, not this function.
 */

export type UnderstandInput = {
  question: string;
};

export type UnderstandOutput = {
  /** Original input, normalized only by trim. Kept for logging / display. */
  original: string;
  /** Scrubbed version — safe to embed and pass to the answering model. */
  scrubbed: string;
  /** Lower-cased, scrubbed — for retrieval-only string comparisons. */
  retrievalNormalized: string;
  redactionsApplied: number;
};

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// 10–11 digit runs (incl. separators) — captures NA-style phone numbers.
const PHONE_RE = /(?:\+?\d[\s().-]?){10,11}/g;
// Any other 4+ digit run (birth years, SIN-like sequences). Runs after PHONE.
const DIGIT_RUN_RE = /\b\d{4,}\b/g;

export function understandQuestion(input: UnderstandInput): UnderstandOutput {
  const original = input.question.trim();
  let scrubbed = original;
  let redactions = 0;

  scrubbed = scrubbed.replace(EMAIL_RE, () => {
    redactions += 1;
    return "<redacted>";
  });
  scrubbed = scrubbed.replace(PHONE_RE, () => {
    redactions += 1;
    return "<redacted>";
  });
  scrubbed = scrubbed.replace(DIGIT_RUN_RE, () => {
    redactions += 1;
    return "<redacted>";
  });

  // Collapse runs of whitespace introduced by replacements.
  scrubbed = scrubbed.replace(/\s+/g, " ").trim();

  return {
    original,
    scrubbed,
    retrievalNormalized: scrubbed.toLowerCase(),
    redactionsApplied: redactions,
  };
}
