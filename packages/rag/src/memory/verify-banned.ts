/**
 * Post-generation checks for conversation memory (TASK-027).
 * Failure → caller retries once with tighter instruction, then falls back to prior summary.
 */

/** Common dementia-related medication tokens (lowercase). */
const MED_RE =
  /\b(donepezil|aricept|rivastigmine|exelon|galantamine|razadyne|memantine|namenda|reminyl|sublinaze)\b/i;

const DIAGNOSIS_RE =
  /\b(has|had|with)\s+(alzheimer|dementia|lewy|vascular|frontotemporal|mci)\b|diagnos(e|is|ed|ing)\b|\bftd\b/i;

const DOSE_RE = /\b\d{1,3}\s*(mg|mcg|g)\b/i;

const LONG_VERBATIM_RE = /"[^"]{80,}"/;

export type BannedCheckResult = { ok: true } | { ok: false; reason: string };

export function verifyMemorySummaryBannedContent(md: string): BannedCheckResult {
  if (MED_RE.test(md)) {
    return { ok: false, reason: "medication_name" };
  }
  if (DIAGNOSIS_RE.test(md)) {
    return { ok: false, reason: "diagnosis_claim" };
  }
  if (DOSE_RE.test(md)) {
    return { ok: false, reason: "dose" };
  }
  if (LONG_VERBATIM_RE.test(md)) {
    return { ok: false, reason: "long_verbatim" };
  }
  return { ok: true };
}
