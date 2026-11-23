import type { SafetyRule } from "../types.js";

/**
 * Neglect signals — typically appear in "what if I just…" framings where the
 * caregiver, exhausted, is contemplating withholding care.
 *
 * Pattern shape: a "stop doing X" / "leave alone for Y" intent toward basic
 * care (feeding, hydration, supervision, hygiene, medication).
 *
 * False-positive risk areas:
 *   - "Should I leave her alone for an hour while I shower?" — accepted
 *     false positive (better to surface the strip than miss). The next-tier
 *     review (TASK-011 conversation surface) can decide whether to also
 *     answer the routine question alongside the resource pointer.
 *   - "I can't keep feeding her by hand" — venting, not neglect; we require
 *     a "stop / never / refuse to" verb form, not "can't".
 */
export const neglectRules: SafetyRule[] = [
  {
    id: "ne_stop_feeding",
    pattern:
      /\b(?:stop|stopped|quit|quitting|going\s+to\s+stop)\s+(?:feeding|giving\s+(?:her|him|them)\s+(?:food|water|meds|medication))\b/i,
    severity: "medium",
  },
  {
    id: "ne_leave_alone_long",
    pattern:
      /\b(?:leave|leaving)\s+(?:her|him|them|mom|dad)\s+(?:alone|by\s+(?:her|him|them)self)\s+(?:all\s+(?:day|night|weekend)|for\s+(?:hours|days)|overnight)\b/i,
    severity: "medium",
  },
  {
    id: "ne_stop_giving_meds",
    pattern:
      /\b(?:stop|stopped|skip(?:ping)?|withhold(?:ing)?)\s+(?:giving\s+(?:her|him|them)\s+)?(?:her|his|their|the)?\s*(?:meds|medication|insulin|pills)\b/i,
    severity: "medium",
  },
  {
    id: "ne_not_giving_meds",
    pattern:
      /\bnot\s+giving\s+(?:her|him|them)\s+(?:her|his|their|the)?\s*(?:meds|medication|insulin|pills)\s+anymore\b/i,
    severity: "medium",
  },
  {
    id: "ne_refuse_to_help",
    pattern:
      /\bi\s+(?:refuse|am\s+going\s+to\s+refuse|won'?t)\s+(?:to\s+)?(?:help|bathe|change|feed|clean)\s+(?:her|him|them)\s+anymore\b/i,
    severity: "medium",
  },
  {
    id: "ne_what_if_just_left",
    pattern:
      /\bwhat\s+if\s+i\s+(?:just\s+)?(?:left|walked\s+(?:away|out)|stopped\s+coming|never\s+came\s+back)\b/i,
    severity: "medium",
  },
];
