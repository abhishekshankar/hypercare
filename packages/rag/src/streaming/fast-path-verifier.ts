/**
 * Regex-only fast path before emitting streamed bytes (TASK-031).
 * Mirrors banned patterns in `memory/verify-banned.ts` plus directive/diagnosis hedges.
 */

const MED_RE =
  /\b(donepezil|aricept|rivastigmine|exelon|galantamine|razadyne|memantine|namenda|reminyl|sublinaze)\b/i;

const DIAGNOSIS_RE =
  /\b(has|had|with)\s+(alzheimer|dementia|lewy|vascular|frontotemporal|mci)\b|diagnos(e|is|ed|ing)\b|\bftd\b/i;

const DOSE_RE = /\b\d{1,3}\s*(mg|mcg|g)\b/i;

const LONG_VERBATIM_RE = /"[^"]{80,}"/;

const I_RECOMMEND_RE = /\bi\s+recommend\b/i;

const I_DIAGNOSE_RE = /\bi\s+diagnos(e|is|ed|ing)\b/i;

export function fastPathVerifyChunk(text: string): { ok: true } | { ok: false; reason: string } {
  if (MED_RE.test(text)) {
    return { ok: false, reason: "medication_name" };
  }
  if (DIAGNOSIS_RE.test(text)) {
    return { ok: false, reason: "diagnosis_claim" };
  }
  if (DOSE_RE.test(text)) {
    return { ok: false, reason: "dose" };
  }
  if (LONG_VERBATIM_RE.test(text)) {
    return { ok: false, reason: "long_verbatim" };
  }
  if (I_RECOMMEND_RE.test(text)) {
    return { ok: false, reason: "i_recommend" };
  }
  if (I_DIAGNOSE_RE.test(text)) {
    return { ok: false, reason: "i_diagnose" };
  }
  return { ok: true };
}
