import type { SafetyRule } from "../types.js";

/**
 * Care recipient is physically harming the caregiver.
 *
 * Pattern shape: third-person CR subject + violence verb directed at "me".
 * We do *not* flag verbal patterns ("she yelled at me") — that's caregiving
 * with dementia, not the abuse signal this category is for.
 *
 * False-positive risk areas:
 *   - "she pushed me to call the doctor" — the rule requires a physical-harm
 *     object phrase ("down the stairs", "into the wall", "out of bed").
 *   - Non-violent "hit me" idioms ("it hit me that...") are guarded by
 *     requiring a CR subject prefix.
 */
export const abuseCrToCaregiverRules: SafetyRule[] = [
  {
    id: "ab_cr_hit_me",
    pattern:
      /\b(?:she|he|they|mom|mother|dad|father|husband|wife|partner|grandma|grandpa)\s+(?:hit|punched|slapped|kicked|bit|scratched|grabbed)\s+me\b/i,
    severity: "medium",
  },
  {
    id: "ab_cr_pushed_me",
    pattern:
      /\b(?:she|he|they|mom|mother|dad|father|husband|wife|partner|grandma|grandpa)\s+(?:pushed|shoved|threw|knocked)\s+me\s+(?:down|into|over|against|off)\b/i,
    severity: "medium",
  },
  {
    id: "ab_cr_threatened_me",
    pattern:
      /\b(?:she|he|they|mom|mother|dad|father|husband|wife|partner|grandma|grandpa)\s+threatened\s+(?:to\s+kill|to\s+hurt|me\s+with)\b/i,
    severity: "medium",
  },
  {
    id: "ab_cr_attacked_me",
    pattern:
      /\b(?:she|he|they|mom|mother|dad|father|husband|wife|partner|grandma|grandpa)\s+(?:attacked|assaulted|came\s+at)\s+me\b/i,
    severity: "medium",
  },
  {
    id: "ab_cr_im_afraid",
    pattern:
      /\b(?:i'?m|i\s+am)\s+(?:afraid|scared)\s+of\s+(?:him|her|them)\b/i,
    severity: "medium",
  },
];
