/**
 * Public types for the safety classifier (TASK-010) and safety-flag persistence.
 *
 * Classifier categories are the six crisis sets; `self_care_burnout` is DB-only
 * (TASK-021 burnout self-assessment soft flag — not produced by Layer A/B).
 *
 * Severity: `high` / `medium` for classifier triage; `low` for soft yellow flags.
 */

/** The six Layer A/B categories (schema + CHECK constraint includes one more). */
export const SAFETY_CLASSIFIER_CATEGORIES = [
  "self_harm_user",
  "self_harm_cr",
  "acute_medical",
  "abuse_cr_to_caregiver",
  "abuse_caregiver_to_cr",
  "neglect",
] as const;

export type SafetyClassifierCategory = (typeof SAFETY_CLASSIFIER_CATEGORIES)[number];

/** All values allowed in `safety_flags.category` (classifier + soft-flag sources). */
export const SAFETY_CATEGORIES = [...SAFETY_CLASSIFIER_CATEGORIES, "self_care_burnout"] as const;

export type SafetyCategory = (typeof SAFETY_CATEGORIES)[number];

export type SafetySeverity = "low" | "high" | "medium";

export type SuggestedAction =
  | "call_988"
  | "call_911"
  | "call_adult_protective_services"
  | "show_crisis_strip_emphasis";

export type SafetySource = "rule" | "llm" | "burnout_self_assessment";

export type SafetyInput = {
  userId: string;
  text: string;
  /** Optional persistence linkage if the caller has already created a message row. */
  messageId?: string;
  conversationId?: string;
};

/**
 * Result returned to callers (notably RAG layer 0).
 *
 * The `triaged: false` branch carries no fields; the `triaged: true` branch
 * carries everything UI/orchestration needs without a second classifier call:
 *   - `category`     — the single winning category (highest severity wins).
 *   - `severity`     — high / medium per the table in TASK-010.
 *   - `suggestedAction` — primary action; UI also renders the persistent
 *     crisis strip via `show_crisis_strip_emphasis` (always implied).
 *   - `matchedSignals` — opaque strings for telemetry: rule ids in Layer A,
 *     a one-line LLM evidence string in Layer B.
 *   - `source`       — `"rule"` or `"llm"`, mirrors what was persisted.
 */
export type SafetyResult =
  | { triaged: false }
  | {
      triaged: true;
      category: SafetyClassifierCategory;
      severity: Exclude<SafetySeverity, "low">;
      suggestedAction: SuggestedAction;
      matchedSignals: string[];
      source: "rule" | "llm";
      /** True when this triage updated an existing row in the 5-minute dedupe window (TASK-025). */
      repeatInWindow: boolean;
    };

/**
 * A single regex-based rule. Rules carry a stable `id` so evals can attribute
 * which pattern fired without re-running the regex bank.
 */
export type SafetyRule = {
  id: string;
  pattern: RegExp;
  /**
   * Per-rule severity. The aggregator picks the highest-severity match across
   * all categories before falling back to the table default for the category.
   */
  severity: Exclude<SafetySeverity, "low">;
};

/** Default severity when only the *category* (not a specific rule) is known. */
export function categoryToSeverity(c: SafetyCategory): SafetySeverity {
  switch (c) {
    case "self_harm_user":
    case "self_harm_cr":
    case "acute_medical":
    case "abuse_caregiver_to_cr":
      return "high";
    case "abuse_cr_to_caregiver":
    case "neglect":
      return "medium";
    case "self_care_burnout":
      return "low";
  }
}

/** Map category → primary suggested action (PRD §10.3). */
export function categoryToSuggestedAction(c: SafetyCategory): SuggestedAction {
  switch (c) {
    case "self_harm_user":
    case "self_harm_cr":
      return "call_988";
    case "acute_medical":
    case "abuse_caregiver_to_cr":
      return "call_911";
    case "abuse_cr_to_caregiver":
    case "neglect":
      return "call_adult_protective_services";
    case "self_care_burnout":
      // Never returned by the classifier; soft-flag only. Neutral placeholder.
      return "show_crisis_strip_emphasis";
  }
}
