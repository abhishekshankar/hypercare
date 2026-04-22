import type { SafetyRule } from "../types.js";

/**
 * Caregiver reporting that the *care recipient* has expressed suicidal
 * ideation or attempted self-harm.
 *
 * Hard-disambiguation problem with `self-harm-user`: "she/he/mom/dad/my
 * husband/wife/partner" prefixes are the signal. We restrict the trigger to
 * patterns that *name* the third party, never bare "wants to die" (that case
 * is caught by `self-harm-user` if the speaker is referring to themselves).
 *
 * False-positive risk areas:
 *   - "her dog died" / "her sister wishes she could see her" — the rules
 *     require an explicit ideation/attempt verb, not just the word "die".
 */
export const selfHarmCrRules: SafetyRule[] = [
  {
    id: "sh_cr_wishes_dead",
    pattern:
      /\b(?:she|he|they|mom|mother|dad|father|husband|wife|partner|grandma|grandpa)\s+(?:said|says|told\s+me|keeps?\s+saying|wishes|wants|wanted)\s+(?:she|he|they)?\s*(?:wants?\s+to\s+die|wishes?\s+(?:she|he|they)\s+(?:were|was)\s+dead|to\s+die|to\s+kill\s+(?:herself|himself|themself))/i,
    severity: "high",
  },
  {
    id: "sh_cr_tried_to_hurt_self",
    pattern:
      /\b(?:she|he|they|mom|mother|dad|father|husband|wife|partner|grandma|grandpa)\s+(?:tried|attempted)\s+to\s+(?:kill|hurt|harm)\s+(?:herself|himself|themself)\b/i,
    severity: "high",
  },
  {
    id: "sh_cr_suicidal",
    pattern:
      /\b(?:she|he|they|mom|mother|dad|father|husband|wife|partner|grandma|grandpa)\s+(?:is|seems|appears|sounds|sounded|has\s+been)\s+suicidal\b/i,
    severity: "high",
  },
  {
    id: "sh_cr_dont_want_to_live",
    pattern:
      /\b(?:she|he|they|mom|mother|dad|father|husband|wife|partner|grandma|grandpa)\s+(?:doesn'?t|does\s+not|no\s+longer)\s+want(?:s)?\s+to\s+live\b/i,
    severity: "high",
  },
  {
    id: "sh_cr_overdose_attempt",
    pattern:
      /\b(?:she|he|they|mom|mother|dad|father|husband|wife|partner|grandma|grandpa)\s+(?:took|swallowed)\s+(?:all\s+(?:her|his|their)|too\s+many|a\s+bunch\s+of)\s+(?:pills|meds|medication|tablets)\b/i,
    severity: "high",
  },
];
