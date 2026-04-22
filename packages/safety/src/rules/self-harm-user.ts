import type { SafetyRule } from "../types.js";

/**
 * Caregiver expressing suicidal ideation or self-harm intent.
 *
 * Patterns are deliberately conservative on word boundaries (`\b`) to avoid
 * matching mid-word. We accept some false positives ("I want to kill this
 * meeting") in exchange for catching rephrasings.
 *
 * False-positive risk areas (documented in ADR 0009):
 *   - "I want to kill <X>" where X is non-self ("I want to kill this disease").
 *     We restrict to "myself" / "me" only.
 *   - "end it all" can be a venting metaphor — accepted as a hit; high recall.
 */
export const selfHarmUserRules: SafetyRule[] = [
  {
    id: "sh_user_kill_myself",
    pattern: /\b(?:kill(?:ing)?|hurt(?:ing)?|harm(?:ing)?)\s+(?:myself|me)\b/i,
    severity: "high",
  },
  {
    id: "sh_user_end_my_life",
    pattern: /\b(?:end|ending|take)\s+my\s+(?:own\s+)?life\b/i,
    severity: "high",
  },
  {
    id: "sh_user_end_it_all",
    pattern: /\b(?:want\s+to|wanna|going\s+to)\s+end\s+it\s+all\b/i,
    severity: "high",
  },
  {
    id: "sh_user_dont_want_to_live",
    pattern: /\bi\s+(?:don'?t|do\s+not|no\s+longer)\s+want\s+to\s+(?:live|be\s+(?:here|alive))\b/i,
    severity: "high",
  },
  {
    id: "sh_user_better_off_dead",
    pattern: /\b(?:i'?d|i\s+would|i)\s+be\s+better\s+off\s+dead\b/i,
    severity: "high",
  },
  {
    id: "sh_user_suicide",
    pattern:
      /\b(?:commit\s+suicide|i'?m\s+suicidal|i\s+am\s+suicidal|thinking\s+about\s+suicide|suicide\s+(?:plan|note))\b/i,
    severity: "high",
  },
  {
    id: "sh_user_cant_go_on",
    pattern: /\bi\s+can'?t\s+(?:go\s+on|do\s+this\s+anymore|keep\s+going)\b.*\b(?:die|dying|dead|over|end)\b/i,
    severity: "high",
  },
];
