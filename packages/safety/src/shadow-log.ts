import { safetyFtShadowDecisions } from "@alongside/db";

import type { LlmClassification } from "./llm/classifier.js";
import type { SafetyDb } from "./persist.js";

export type FtShadowVerdictJson = {
  triaged: boolean;
  category?: string;
  severity?: string;
};

export type FtShadowLogInput = {
  requestId: string;
  textHash: string;
  zeroShot: LlmClassification;
  fineTuned: LlmClassification;
  zeroShotLatencyMs: number;
  fineTunedLatencyMs: number;
};

export function llmVerdictToJson(c: LlmClassification): FtShadowVerdictJson {
  if (!c.triaged) return { triaged: false };
  return { triaged: true, category: c.category, severity: c.severity };
}

export type FtShadowLogFn = (row: FtShadowLogInput) => Promise<void>;

export function makeFtShadowLogger(deps: {
  db: SafetyDb;
  warn?: (msg: string, ctx?: Record<string, unknown>) => void;
}): FtShadowLogFn {
  return async (row) => {
    try {
      await deps.db.insert(safetyFtShadowDecisions).values({
        requestId: row.requestId,
        textHash: row.textHash,
        zeroShotVerdict: llmVerdictToJson(row.zeroShot),
        fineTunedVerdict: llmVerdictToJson(row.fineTuned),
        zeroShotLatencyMs: row.zeroShotLatencyMs,
        fineTunedLatencyMs: row.fineTunedLatencyMs,
      });
    } catch (err) {
      deps.warn?.("safety.ft.shadow_log_failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };
}
