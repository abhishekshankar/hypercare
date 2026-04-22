import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

import {
  ANSWER_MAX_TOKENS,
  ANSWER_MODEL_ID,
  ANSWER_REGION,
  ANSWER_TEMPERATURE,
} from "../config.js";

export type GenerateInput = {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  modelId?: string;
  region?: string;
};

export type GenerateOutput = {
  text: string;
  modelId: string;
  inputTokens: number | null;
  outputTokens: number | null;
  stopReason: string | null;
};

/**
 * Thin wrapper around Bedrock InvokeModel for Anthropic Claude. We use the
 * "messages" API shape per Bedrock's anthropic_version contract.
 *
 * Out of scope here: streaming, tool use, retries on throttling. TASK-011 owns
 * UX-level streaming if we add it.
 */
export async function invokeClaude(input: GenerateInput): Promise<GenerateOutput> {
  const region = input.region ?? ANSWER_REGION;
  const modelId = input.modelId ?? ANSWER_MODEL_ID;
  const maxTokens = input.maxTokens ?? ANSWER_MAX_TOKENS;
  const temperature = input.temperature ?? ANSWER_TEMPERATURE;

  const client = new BedrockRuntimeClient({ region });
  const body = JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: maxTokens,
    temperature,
    system: input.systemPrompt,
    messages: [{ role: "user", content: [{ type: "text", text: input.userPrompt }] }],
  });

  const out = await client.send(
    new InvokeModelCommand({
      modelId,
      contentType: "application/json",
      accept: "application/json",
      body: new TextEncoder().encode(body),
    }),
  );
  if (!out.body) throw new Error("Bedrock InvokeModel: empty body");

  const json = JSON.parse(new TextDecoder().decode(out.body)) as {
    content?: Array<{ type?: string; text?: string }>;
    stop_reason?: string;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const text = (json.content ?? [])
    .filter((b): b is { type?: string; text: string } => typeof b.text === "string")
    .map((b) => b.text)
    .join("");

  return {
    text,
    modelId,
    inputTokens: json.usage?.input_tokens ?? null,
    outputTokens: json.usage?.output_tokens ?? null,
    stopReason: json.stop_reason ?? null,
  };
}
