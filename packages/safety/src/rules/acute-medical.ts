import type { SafetyRule } from "../types.js";

/**
 * Life-threatening *current* medical situation. Tense matters: "she's not
 * breathing" is acute; "what do I do if she stops breathing" is informational.
 *
 * The classifier errs toward triggering even on the informational form rather
 * than miss a real one — false positives become a benign crisis-strip nudge.
 *
 * False-positive risk areas:
 *   - "she fell" alone is not enough; we require an unresponsive / can't-move
 *     follow-on. "she fell and isn't responsive" → triggers; "she fell last
 *     week" → does not.
 *   - "stroke" appears in non-acute contexts ("she had a stroke last year");
 *     we restrict to present-tense / "I think" framings.
 */
export const acuteMedicalRules: SafetyRule[] = [
  {
    id: "am_not_breathing",
    pattern: /\b(?:not|isn'?t|stopped)\s+breathing\b/i,
    severity: "high",
  },
  {
    id: "am_unresponsive",
    pattern:
      /\b(?:un[-\s]?responsive|won'?t\s+wake\s+up|can'?t\s+wake\s+(?:her|him|them|mom|dad)|not\s+responding)\b/i,
    severity: "high",
  },
  {
    id: "am_chest_pain",
    pattern: /\b(?:chest\s+pain|crushing\s+chest|pain\s+in\s+(?:her|his|their|my)\s+chest)\b/i,
    severity: "high",
  },
  {
    id: "am_stroke_now",
    pattern:
      /\b(?:having\s+a\s+stroke|i\s+think\s+(?:she|he|they)'?s?\s+having\s+a\s+stroke|face\s+(?:is\s+)?drooping|can'?t\s+move\s+(?:her|his|their)\s+(?:arm|side))\b/i,
    severity: "high",
  },
  {
    id: "am_fall_cant_move",
    pattern:
      /\b(?:fell|fallen)\b[^.!?\n]{0,80}\b(?:can'?t\s+(?:move|get\s+up|stand)|isn'?t\s+responsive|won'?t\s+wake|hit\s+(?:her|his|their)\s+head)\b/i,
    severity: "high",
  },
  {
    id: "am_choking",
    pattern: /\b(?:is\s+)?choking\b/i,
    severity: "high",
  },
  {
    id: "am_severe_bleeding",
    pattern:
      /\b(?:bleeding\s+(?:badly|a\s+lot|heavily|won'?t\s+stop)|won'?t\s+stop\s+bleeding|can'?t\s+stop\s+the\s+bleeding)\b/i,
    severity: "high",
  },
  {
    id: "am_overdose",
    pattern:
      /\b(?:overdose|too\s+many\s+(?:pills|tablets)|took\s+(?:way\s+)?too\s+much\s+(?:medication|medicine|insulin))\b/i,
    severity: "high",
  },
];
