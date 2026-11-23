/**
 * `classify()` — public entry to the safety classifier (TASK-010, TASK-039).
 *
 * Pipeline:
 *   1. Layer A (rules)   — sync regex bank, deterministic, always runs first.
 *   2. Layer B (LLM)     — only if Layer A had no match, runs only if not
 *      explicitly disabled by deps. Zero-shot Haiku and/or fine-tuned model
 *      per `SAFETY_FT_SHADOW` / `SAFETY_FT_LIVE` / `layerBClassifierOverride`.
 *      Parse failures degrade to `triaged: false`. Fine-tuned invoke errors
 *      fall back to zero-shot when live (ADR 0009).
 *   3. Persist           — every triaged result writes a `safety_flags` row.
 *      Persistence failures are logged but never propagate.
 */

import { createHash, randomUUID } from "node:crypto";

import { abuseCaregiverToCrRules } from "./rules/abuse-caregiver-to-cr.js";
import { abuseCrToCaregiverRules } from "./rules/abuse-cr-to-caregiver.js";
import { acuteMedicalRules } from "./rules/acute-medical.js";
import { neglectRules } from "./rules/neglect.js";
import { selfHarmCrRules } from "./rules/self-harm-cr.js";
import { selfHarmUserRules } from "./rules/self-harm-user.js";
import type { SafetyLayerBClassifier } from "./config.js";
import {
  classifyWithLlm,
  defaultInvoke,
  defaultInvokeFineTuned,
  type ClassifyLlmDeps,
} from "./llm/classifier.js";
import { makeDbPersist, type PersistFn } from "./persist.js";
import type { FtShadowLogFn } from "./shadow-log.js";
import {
  categoryToSeverity,
  categoryToSuggestedAction,
  type SafetyClassifierCategory,
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
  /** Optional fine-tuned Bedrock invoke; defaults to `defaultInvokeFineTuned` when unset. */
  llmInvokeFineTuned?: ClassifyLlmDeps["invokeFineTuned"];
  /**
   * Forces Layer-B routing for eval harness (`pnpm eval redteam --classifier`).
   * When set, env `SAFETY_FT_*` flags are ignored for this call.
   */
  layerBClassifierOverride?: SafetyLayerBClassifier;
  /**
   * When `SAFETY_FT_SHADOW=1`, both classifiers run; this logger records the pair.
   * Wired from `@alongside/rag` `buildDefaultDeps` when DB is available.
   */
  logFtShadow?: FtShadowLogFn;
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
const CATEGORY_RULES: ReadonlyArray<readonly [SafetyClassifierCategory, SafetyRule[]]> = [
  ["self_harm_user", selfHarmUserRules],
  ["self_harm_cr", selfHarmCrRules],
  ["acute_medical", acuteMedicalRules],
  ["abuse_caregiver_to_cr", abuseCaregiverToCrRules],
  ["abuse_cr_to_caregiver", abuseCrToCaregiverRules],
  ["neglect", neglectRules],
];

const SEVERITY_RANK: Record<Exclude<SafetySeverity, "low">, number> = { high: 2, medium: 1 };

type RuleHit = {
  category: SafetyClassifierCategory;
  ruleId: string;
  severity: Exclude<SafetySeverity, "low">;
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
type TriageBase = Omit<Extract<SafetyResult, { triaged: true }>, "repeatInWindow">;

function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

type LayerBStrategy = "zero_only" | "shadow" | "live_ft";

function resolveLayerBStrategy(deps: ClassifyDeps): LayerBStrategy {
  if (deps.layerBClassifierOverride === "fine_tuned") return "live_ft";
  if (deps.layerBClassifierOverride === "zero_shot") return "zero_only";
  if (process.env.SAFETY_FT_SHADOW === "1") return "shadow";
  if (process.env.SAFETY_FT_LIVE === "1") return "live_ft";
  return "zero_only";
}

async function runLayerBLlm(
  text: string,
  classifier: SafetyLayerBClassifier,
  deps: ClassifyDeps,
): Promise<{ result: Awaited<ReturnType<typeof classifyWithLlm>>; ms: number }> {
  const t0 = Date.now();
  const result = await classifyWithLlm(text, {
    invoke: deps.llmInvoke ?? defaultInvoke,
    invokeFineTuned: deps.llmInvokeFineTuned ?? defaultInvokeFineTuned,
    classifier,
    ...(deps.warn !== undefined ? { warn: deps.warn } : {}),
  });
  return { result, ms: Date.now() - t0 };
}

export function aggregateRuleHits(hits: RuleHit[]): TriageBase | null {
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
    // Classifier categories never map to `low`; `categoryToSeverity` is shared with DB-only categories.
    severity: categoryToSeverity(winningCategory) as Exclude<SafetySeverity, "low">,
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
  if (text.trim().length === 0) {
    // No signals to match; avoid Bedrock and noisy warns on empty/whitespace-only turns.
    return { triaged: false };
  }

  // Layer A — rules.
  const ruleAggregate = aggregateRuleHits(runAllRules(text));
  if (ruleAggregate) {
    const { repeatInWindow } = await deps.persist({
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
    return { ...ruleAggregate, repeatInWindow };
  }

  // Layer B — LLM(s). Skipped on disableLlm.
  if (deps.disableLlm) return { triaged: false };

  const strategy = resolveLayerBStrategy(deps);
  let llm: Awaited<ReturnType<typeof classifyWithLlm>>;

  try {
    if (strategy === "zero_only") {
      llm = (await runLayerBLlm(text, "zero_shot", deps)).result;
    } else if (strategy === "shadow") {
      const zs = await runLayerBLlm(text, "zero_shot", deps);
      type LlmR = Awaited<ReturnType<typeof classifyWithLlm>>;
      let ftResult: LlmR = { triaged: false };
      let ftMs = 0;
      const ftStarted = Date.now();
      try {
        const ft = await runLayerBLlm(text, "fine_tuned", deps);
        ftResult = ft.result;
        ftMs = ft.ms;
      } catch (err) {
        ftMs = Date.now() - ftStarted;
        deps.warn?.("safety.ft.invoke_failed", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
      const requestId = randomUUID();
      void Promise.resolve(
        deps.logFtShadow?.({
          requestId,
          textHash: sha256Hex(text),
          zeroShot: zs.result,
          fineTuned: ftResult,
          zeroShotLatencyMs: zs.ms,
          fineTunedLatencyMs: ftMs,
        }),
      );
      llm = zs.result;
    } else {
      let chosen: SafetyLayerBClassifier = "fine_tuned";
      try {
        llm = (await runLayerBLlm(text, "fine_tuned", deps)).result;
      } catch (err) {
        deps.warn?.("safety.ft.invoke_failed", {
          error: err instanceof Error ? err.message : String(err),
        });
        chosen = "zero_shot";
        try {
          llm = (await runLayerBLlm(text, "zero_shot", deps)).result;
        } catch (err2) {
          deps.warn?.("safety.llm.invoke_failed", {
            error: err2 instanceof Error ? err2.message : String(err2),
          });
          return { triaged: false };
        }
      }
      deps.warn?.("safety.layer_b.classifier", { live: chosen });
    }
  } catch (err) {
    deps.warn?.("safety.llm.invoke_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { triaged: false };
  }
  if (!llm.triaged) return { triaged: false };

  const result: TriageBase = {
    triaged: true,
    category: llm.category,
    severity: llm.severity,
    suggestedAction: categoryToSuggestedAction(llm.category),
    matchedSignals: [llm.evidence],
    source: "llm",
  };
  const { repeatInWindow } = await deps.persist({
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
  return { ...result, repeatInWindow };
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
