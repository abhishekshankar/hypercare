/**
 * `classify()` — public entry to the safety classifier (TASK-010).
 *
 * Pipeline:
 *   1. Layer A (rules)   — sync regex bank, deterministic, always runs first.
 *   2. Layer B (Haiku)   — only if Layer A had no match, runs only if not
 *      explicitly disabled by deps. Parse failures degrade to `triaged: false`.
 *   3. Persist           — every triaged result writes a `safety_flags` row.
 *      Persistence failures are logged but never propagate.
 *
 * The function returns *without* awaiting persistence in practice (we await
 * a single insert; it's typically a few ms and we want write-before-respond
 * for audit). On Postgres outage, `makeDbPersist` swallows.
 */

import { abuseCaregiverToCrRules } from "./rules/abuse-caregiver-to-cr.js";
import { abuseCrToCaregiverRules } from "./rules/abuse-cr-to-caregiver.js";
import { acuteMedicalRules } from "./rules/acute-medical.js";
import { neglectRules } from "./rules/neglect.js";
import { selfHarmCrRules } from "./rules/self-harm-cr.js";
import { selfHarmUserRules } from "./rules/self-harm-user.js";
import {
  classifyWithLlm,
  defaultInvoke,
  type ClassifyLlmDeps,
} from "./llm/classifier.js";
import { makeDbPersist, type PersistFn } from "./persist.js";
import {
  categoryToSeverity,
  categoryToSuggestedAction,
  type SafetyCategory,
  type SafetyInput,
  type SafetyResult,
  type SafetyRule,
  type SafetySeverity,
} from "./types.js";

export type ClassifyDeps = {
  /**
   * Persistence sink. Build with `makeDbPersist({ db })` for production;
   * tests pass a `vi.fn()` to assert calls.
   */
  persist: PersistFn;
  /**
   * Layer-B invoker. If omitted, `defaultInvoke` (Bedrock Haiku) is used.
   * Tests pass a fake to keep offline behavior; CI keeps offline (no
   * Bedrock); operator runs `SAFETY_LIVE=1` smoke scripts to exercise it.
   */
  llmInvoke?: ClassifyLlmDeps["invoke"];
  /**
   * If true, skip Layer B entirely (returns `triaged: false` if Layer A
   * misses). Used by the offline test path.
   */
  disableLlm?: boolean;
  warn?: (msg: string, ctx?: Record<string, unknown>) => void;
};

/**
 * Ordered list of (category, rules). Order matters only for tie-breaks
 * within the same severity — the table in TASK-010 specifies "first-listed
 * category wins" on a tie.
 */
const CATEGORY_RULES: ReadonlyArray<readonly [SafetyCategory, SafetyRule[]]> = [
  ["self_harm_user", selfHarmUserRules],
  ["self_harm_cr", selfHarmCrRules],
  ["acute_medical", acuteMedicalRules],
  ["abuse_caregiver_to_cr", abuseCaregiverToCrRules],
  ["abuse_cr_to_caregiver", abuseCrToCaregiverRules],
  ["neglect", neglectRules],
];

const SEVERITY_RANK: Record<SafetySeverity, number> = { high: 2, medium: 1 };

type RuleHit = {
  category: SafetyCategory;
  ruleId: string;
  severity: SafetySeverity;
};

/** Run every rule in every category and return all hits in declaration order. */
export function runAllRules(text: string): RuleHit[] {
  const hits: RuleHit[] = [];
  for (const [category, rules] of CATEGORY_RULES) {
    for (const rule of rules) {
      if (rule.pattern.test(text)) {
        hits.push({ category, ruleId: rule.id, severity: rule.severity });
      }
    }
  }
  return hits;
}

/**
 * Pick the winning category from a non-empty hit list:
 *   1. highest severity wins;
 *   2. on tie, the first-listed category in CATEGORY_RULES wins.
 *
 * `matchedSignals` is the set of rule ids from the *winning* category only —
 * cross-category misfires are noisy and would confuse downstream review.
 */
export function aggregateRuleHits(
  hits: RuleHit[],
): Extract<SafetyResult, { triaged: true }> | null {
  if (hits.length === 0) return null;
  const topRank = Math.max(...hits.map((h) => SEVERITY_RANK[h.severity]));
  const topHits = hits.filter((h) => SEVERITY_RANK[h.severity] === topRank);
  // Category order in CATEGORY_RULES is the tie-breaker.
  const orderedCategories = CATEGORY_RULES.map(([c]) => c);
  const winningCategory = orderedCategories.find((c) =>
    topHits.some((h) => h.category === c),
  );
  if (!winningCategory) return null;
  const winningSignals = hits
    .filter((h) => h.category === winningCategory)
    .map((h) => h.ruleId);
  return {
    triaged: true,
    category: winningCategory,
    severity: categoryToSeverity(winningCategory),
    suggestedAction: categoryToSuggestedAction(winningCategory),
    matchedSignals: winningSignals,
    source: "rule",
  };
}

export async function classify(
  input: SafetyInput,
  deps: ClassifyDeps,
): Promise<SafetyResult> {
  const text = input.text ?? "";

  // Layer A — rules.
  const ruleAggregate = aggregateRuleHits(runAllRules(text));
  if (ruleAggregate) {
    await deps.persist({
      userId: input.userId,
      messageText: text,
      category: ruleAggregate.category,
      severity: ruleAggregate.severity,
      source: "rule",
      matchedSignals: ruleAggregate.matchedSignals,
      ...(input.messageId !== undefined ? { messageId: input.messageId } : {}),
      ...(input.conversationId !== undefined
        ? { conversationId: input.conversationId }
        : {}),
    });
    return ruleAggregate;
  }

  // Layer B — Haiku. Skipped on disableLlm or if no invoker is configured.
  if (deps.disableLlm) return { triaged: false };
  const invoke = deps.llmInvoke ?? defaultInvoke;
  let llm;
  try {
    llm = await classifyWithLlm(text, {
      invoke,
      ...(deps.warn !== undefined ? { warn: deps.warn } : {}),
    });
  } catch (err) {
    deps.warn?.("safety.llm.invoke_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { triaged: false };
  }
  if (!llm.triaged) return { triaged: false };

  const result: Extract<SafetyResult, { triaged: true }> = {
    triaged: true,
    category: llm.category,
    severity: llm.severity,
    suggestedAction: categoryToSuggestedAction(llm.category),
    matchedSignals: [llm.evidence],
    source: "llm",
  };
  await deps.persist({
    userId: input.userId,
    messageText: text,
    category: result.category,
    severity: result.severity,
    source: "llm",
    matchedSignals: result.matchedSignals,
    ...(input.messageId !== undefined ? { messageId: input.messageId } : {}),
    ...(input.conversationId !== undefined
      ? { conversationId: input.conversationId }
      : {}),
  });
  return result;
}

/** Convenience for callers that want the default Bedrock + DB wiring. */
export function buildDefaultDeps(opts: {
  db: Parameters<typeof makeDbPersist>[0]["db"];
  warn?: (msg: string, ctx?: Record<string, unknown>) => void;
}): ClassifyDeps {
  const persist = makeDbPersist({
    db: opts.db,
    ...(opts.warn !== undefined ? { warn: opts.warn } : {}),
  });
  return {
    persist,
    ...(opts.warn !== undefined ? { warn: opts.warn } : {}),
  };
}
