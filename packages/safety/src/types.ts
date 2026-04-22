/**
 * Public types for the safety classifier (TASK-010).
 *
 * The category set is intentionally small (6) and matches the CHECK constraint
 * on `safety_flags.category`. Anything outside this set is a bug — including
 * any tag the LLM might invent in Layer B.
 *
 * Severity is a coarse two-state field (`high` / `medium`) so the UI can pick
 * a treatment without per-category logic; mapping lives in `categoryToSeverity`.
 */

export const SAFETY_CATEGORIES = [
  "self_harm_user",
  "self_harm_cr",
  "acute_medical",
  "abuse_cr_to_caregiver",
  "abuse_caregiver_to_cr",
  "neglect",
] as const;

export type SafetyCategory = (typeof SAFETY_CATEGORIES)[number];

export type SafetySeverity = "high" | "medium";

export type SuggestedAction =
  | "call_988"
  | "call_911"
  | "call_adult_protective_services"
  | "show_crisis_strip_emphasis";

export type SafetySource = "rule" | "llm";

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
      category: SafetyCategory;
      severity: SafetySeverity;
      suggestedAction: SuggestedAction;
      matchedSignals: string[];
      source: SafetySource;
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
  severity: SafetySeverity;
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
  }
}
