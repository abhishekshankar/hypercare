import type { SafetyRule } from "../types.js";

/**
 * Caregiver admitting (or asking about) harming the care recipient.
 *
 * This is the most delicate category to detect: the caregiver who admits to
 * losing control is in extraordinary distress and shame, and a wrong response
 * pushes them away. The classifier's job is *only* to route — the response
 * copy is in TASK-011 / PRD §10.3 and is not in scope here.
 *
 * Pattern shape: first-person subject ("I", "I just", "I finally") + harm
 * verb directed at the CR.
 *
 * False-positive risk areas:
 *   - "I lost it" alone is venting, not abuse — we require a follow-on harm
 *     verb ("and hit", "and shoved", etc.).
 *   - "I slapped her hand away from the stove" — accepted false positive;
 *     better to over-trigger.
 */
export const abuseCaregiverToCrRules: SafetyRule[] = [
  {
    id: "ab_cg_hit_cr",
    pattern:
      /\bi\s+(?:hit|slapped|punched|kicked|shoved|pushed|grabbed|shook)\s+(?:her|him|them|mom|dad|my\s+(?:mother|father|husband|wife|partner))\b/i,
    severity: "high",
  },
  {
    id: "ab_cg_lost_it_and_hit",
    pattern:
      /\bi\s+(?:lost\s+it|snapped|lost\s+(?:my\s+)?(?:mind|temper|cool))\b[^.!?\n]{0,80}\b(?:hit|slapped|shoved|pushed|grabbed|hurt|threw)\b/i,
    severity: "high",
  },
  {
    id: "ab_cg_afraid_will_hurt",
    pattern:
      /\bi'?m\s+(?:afraid|scared|worried)\s+(?:i'?ll|i\s+will|i\s+might|i\s+could)\s+(?:hurt|hit|harm|kill)\s+(?:her|him|them)\b/i,
    severity: "high",
  },
  {
    id: "ab_cg_did_something_terrible",
    pattern:
      /\bi\s+(?:did\s+something|just\s+did\s+something)\s+(?:terrible|awful|bad)\b[^.!?\n]{0,80}\b(?:to\s+(?:her|him|them|mom|dad)|hit|hurt|hit\s+her|hit\s+him)\b/i,
    severity: "high",
  },
  {
    id: "ab_cg_lock_in_room",
    pattern:
      /\b(?:lock(?:ed|ing)?|tied?|tying)\s+(?:her|him|them|mom|dad)\s+(?:in|to|up)\b/i,
    severity: "high",
  },
];
