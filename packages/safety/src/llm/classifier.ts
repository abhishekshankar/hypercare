/**
 * Bedrock Claude (Haiku 4.5) wrapper for the Layer B safety classifier.
 *
 * Model id and region come from `../config.ts` (ADR 0008); this file must not
 * hard-code a `modelId`.
 *
 * Tight contract: temperature 0, max_tokens 200, strict JSON, zod-validated.
 * Parse failure → triaged: false. We accept a Layer B miss over a stalled
 * pipeline.
 */
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import {
  CLASSIFIER_MAX_TOKENS,
  CLASSIFIER_MODEL_ID,
  CLASSIFIER_REGION,
  CLASSIFIER_TEMPERATURE,
  SAFETY_FT_MODEL_ID,
  type SafetyLayerBClassifier,
} from "../config.js";
import {
  SAFETY_CLASSIFIER_CATEGORIES,
  type SafetyClassifierCategory,
  type SafetySeverity,
} from "../types.js";

/** Output of the LLM classifier (post-zod-parse). */
export type LlmClassification =
  | { triaged: false }
  | {
      triaged: true;
      category: SafetyClassifierCategory;
      severity: Exclude<SafetySeverity, "low">;
      evidence: string;
    };

const here = dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = resolve(here, "../prompts/classifier.md");

let cachedSystemPrompt: string | null = null;
function loadSystemPrompt(): string {
  if (cachedSystemPrompt === null) {
    cachedSystemPrompt = readFileSync(PROMPT_PATH, "utf8");
  }
  return cachedSystemPrompt;
}

const llmResultSchema = z.discriminatedUnion("triaged", [
  z.object({ triaged: z.literal(false) }),
  z.object({
    triaged: z.literal(true),
    category: z.enum(SAFETY_CLASSIFIER_CATEGORIES as readonly [string, ...string[]]),
    severity: z.enum(["high", "medium"]),
    evidence: z.string().max(400),
  }),
]);

export type ClassifyLlmDeps = {
  invoke: (input: { systemPrompt: string; userMessage: string }) => Promise<string>;
  /**
   * Optional Bedrock invoke for the fine-tuned classifier id (`BEDROCK_SAFETY_FT_MODEL_ID`).
   * Tests inject a stub; production uses `defaultInvokeFineTuned` when omitted.
   */
  invokeFineTuned?: (input: { userMessage: string }) => Promise<string>;
  warn?: (msg: string, ctx?: Record<string, unknown>) => void;
};

const FINE_TUNED_SYSTEM = `You are Hypercare's safety triage classifier. Reply with one JSON object only (no markdown fence), same schema as training:
{"triaged":false} OR {"triaged":true,"category":"<one of self_harm_user,self_harm_cr,acute_medical,abuse_cr_to_caregiver,abuse_caregiver_to_cr,neglect>","severity":"high"|"medium","evidence":"<short quote, max 400 chars>"}
Temperature is 0; be conservative on crisis signals.`;

/**
 * Run the LLM classifier. Pass `deps.invoke` for testability; the default
 * `defaultInvoke` calls Bedrock directly.
 */
export async function classifyWithLlm(
  text: string,
  deps: ClassifyLlmDeps & { classifier?: SafetyLayerBClassifier },
): Promise<LlmClassification> {
  const classifier = deps.classifier ?? "zero_shot";
  if (classifier === "fine_tuned") {
    const inv = deps.invokeFineTuned ?? defaultInvokeFineTuned;
    const raw = await inv({ userMessage: text });
    return parseLlmJson(raw, deps.warn);
  }
  const systemPrompt = loadSystemPrompt();
  const raw = await deps.invoke({ systemPrompt, userMessage: text });
  return parseLlmJson(raw, deps.warn);
}

/**
 * Bedrock invoke for the fine-tuned safety model (TASK-039).
 * Throws on missing model id or AWS errors — `classify()` maps to fallback / warn.
 */
export async function defaultInvokeFineTuned(input: {
  userMessage: string;
}): Promise<string> {
  const modelId = SAFETY_FT_MODEL_ID;
  if (!modelId) {
    throw new Error("BEDROCK_SAFETY_FT_MODEL_ID is not set");
  }
  const client = new BedrockRuntimeClient({ region: CLASSIFIER_REGION });
  const body = JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: CLASSIFIER_MAX_TOKENS,
    temperature: CLASSIFIER_TEMPERATURE,
    system: FINE_TUNED_SYSTEM,
    messages: [{ role: "user", content: [{ type: "text", text: input.userMessage }] }],
  });
  const out = await client.send(
    new InvokeModelCommand({
      modelId,
      contentType: "application/json",
      accept: "application/json",
      body: new TextEncoder().encode(body),
    }),
  );
  if (!out.body) throw new Error("safety ft: Bedrock InvokeModel returned empty body");
  const json = JSON.parse(new TextDecoder().decode(out.body)) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  return (json.content ?? [])
    .filter((b): b is { type?: string; text: string } => typeof b.text === "string")
    .map((b) => b.text)
    .join("");
}

/**
 * Defensive parser: the model usually emits clean JSON, but we strip a
 * possible ```json fence and trim before zod validates. On any failure we
 * return `triaged: false` and emit a warning — never throw.
 */
export function parseLlmJson(
  raw: string,
  warn?: (msg: string, ctx?: Record<string, unknown>) => void,
): LlmClassification {
  const cleaned = stripFence(raw).trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    warn?.("safety.llm.parse_failed", {
      error: err instanceof Error ? err.message : String(err),
      preview: cleaned.slice(0, 120),
    });
    return { triaged: false };
  }
  const result = llmResultSchema.safeParse(parsed);
  if (!result.success) {
    warn?.("safety.llm.schema_failed", {
      issues: result.error.issues.map((i) => i.message),
      preview: cleaned.slice(0, 120),
    });
    return { triaged: false };
  }
  if (result.data.triaged) {
    return {
      triaged: true,
      category: result.data.category as SafetyClassifierCategory,
      severity: result.data.severity,
      evidence: result.data.evidence,
    };
  }
  return { triaged: false };
}

function stripFence(s: string): string {
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced ? (fenced[1] ?? s) : s;
}

/**
 * Default Bedrock InvokeModel implementation. Single-shot, no retries.
 *
 * On any AWS error this throws — `classify()` catches and downgrades to
 * `triaged: false` with a warning so the RAG pipeline never stalls on
 * Bedrock outages.
 */
export async function defaultInvoke(input: {
  systemPrompt: string;
  userMessage: string;
}): Promise<string> {
  const client = new BedrockRuntimeClient({ region: CLASSIFIER_REGION });
  const body = JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: CLASSIFIER_MAX_TOKENS,
    temperature: CLASSIFIER_TEMPERATURE,
    system: input.systemPrompt,
    messages: [{ role: "user", content: [{ type: "text", text: input.userMessage }] }],
  });
  const out = await client.send(
    new InvokeModelCommand({
      modelId: CLASSIFIER_MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: new TextEncoder().encode(body),
    }),
  );
  if (!out.body) throw new Error("safety: Bedrock InvokeModel returned empty body");
  const json = JSON.parse(new TextDecoder().decode(out.body)) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  return (json.content ?? [])
    .filter((b): b is { type?: string; text: string } => typeof b.text === "string")
    .map((b) => b.text)
    .join("");
}
