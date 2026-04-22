/**
 * Safety Layer B (LLM) Bedrock settings.
 *
 * **Inference profile (mandatory):** Use a regional system profile id with the
 * `us.` / `eu.` / `au.` / `global.` prefix. Bare `anthropic.*` ids often return
 * `ValidationException: on-demand throughput isn't supported` in InvokeModel.
 * The default below matches the answering model in `@hypercare/rag` (TASK-009);
 * see `docs/adr/0008-rag-pipeline-v0.md` §4 for the full rationale.
 *
 * Override at deploy time with `BEDROCK_CLASSIFIER_MODEL_ID` if your account
 * only exposes a different profile id.
 */
const DEFAULT_CLASSIFIER_MODEL_ID = "us.anthropic.claude-haiku-4-5-20251001-v1:0";

export const CLASSIFIER_MODEL_ID =
  process.env.BEDROCK_CLASSIFIER_MODEL_ID?.trim() || DEFAULT_CLASSIFIER_MODEL_ID;

export const CLASSIFIER_REGION = "ca-central-1";

export const CLASSIFIER_MAX_TOKENS = 200;
export const CLASSIFIER_TEMPERATURE = 0;

/** Bedrock model or inference profile id for TASK-039 Layer-B fine-tuned classifier. */
export const SAFETY_FT_MODEL_ID =
  process.env.BEDROCK_SAFETY_FT_MODEL_ID?.trim() || "";

export type SafetyLayerBClassifier = "zero_shot" | "fine_tuned";
