/**
 * TASK-034 — single source for stage-assessment v1 copy and option values.
 * Wording is aligned with `docs/content/stage-questions-v1.md` when PM pastes the signed file.
 */
import type { AloneSafetyChip } from "@hypercare/content/stage-rules";

export const ALONE_SAFETY_OPTIONS: { value: AloneSafetyChip; label: string }[] = [
  { value: "nothing", label: "Nothing in particular" },
  { value: "wandering", label: "Wandering or getting lost" },
  { value: "falls", label: "Falls or balance" },
  { value: "cooking", label: "Cooking or using the stove" },
  { value: "medication_mistakes", label: "Medication mistakes" },
  { value: "other", label: "Something else" },
];

export type StageV1FormDefaults = {
  med_management_v1: string | null;
  driving_v1: string | null;
  alone_safety_v1: AloneSafetyChip[] | null;
  recognition_v1: string | null;
  bathing_dressing_v1: string | null;
  wandering_v1: string | null;
  conversation_v1: string | null;
  sleep_v1: string | null;
};

export const STAGE_V1_TEXT = {
  med: (name: string) => `Does ${name} need help remembering or taking their medications?`,
  medOptions: [
    { value: "self", label: "They manage on their own" },
    { value: "reminders", label: "They need reminders" },
    { value: "hands_on_help", label: "Someone needs to help them hands-on" },
  ],
  driving: (name: string) => `Is ${name} still driving?`,
  drivingOptions: [
    { value: "safe", label: "Yes — safely" },
    { value: "worried", label: "Yes, but I’m worried" },
    { value: "stopped_recent", label: "No — they stopped within the last year" },
    { value: "stopped_long_ago", label: "No — they stopped a while ago" },
    { value: "never_drove", label: "They never drove" },
  ],
  alone: (name: string) =>
    `If you left ${name} alone for a few hours, what would you worry about? (You can pick more than one.)`,
  recognition: (name: string) => `When you see ${name}, do they know who you are?`,
  recognitionOptions: [
    { value: "yes_always", label: "Yes, always" },
    { value: "yes_usually", label: "Yes, usually" },
    { value: "sometimes", label: "Sometimes" },
    { value: "rarely", label: "Rarely" },
  ],
  bathing: (name: string) => `How does ${name} manage bathing and dressing?`,
  bathingOptions: [
    { value: "on_own", label: "On their own" },
    { value: "with_reminders", label: "With reminders or cueing" },
    { value: "hands_on_help", label: "Needs hands-on help" },
  ],
  wandering: (name: string) => `Has ${name} gotten lost or wandered in the last year?`,
  wanderingOptions: [
    { value: "no", label: "No" },
    { value: "once", label: "Once" },
    { value: "few_times", label: "A few times" },
    { value: "often", label: "Often" },
  ],
  conversation: (name: string) => `Can ${name} have a conversation that makes sense to you?`,
  conversationOptions: [
    { value: "yes", label: "Yes" },
    { value: "yes_repeats", label: "Yes, but with repetition" },
    { value: "only_short", label: "Only short exchanges" },
    { value: "rarely_makes_sense", label: "Rarely makes sense" },
  ],
  sleep: (name: string) =>
    `How are ${name}’s nights — do they sleep through, or are nights hard?`,
  sleepOptions: [
    { value: "sleep_through", label: "Mostly sleeps through" },
    { value: "some_nights_hard", label: "Some nights are hard" },
    { value: "most_nights_hard", label: "Most nights are hard" },
  ],
} as const;
