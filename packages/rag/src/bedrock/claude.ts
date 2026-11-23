import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";

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

export type StreamChunk =
  | { kind: "text"; text: string }
  | {
      kind: "usage";
      modelId: string;
      inputTokens: number | null;
      outputTokens: number | null;
      stopReason: string | null;
    };

/**
 * Bedrock InvokeModelWithResponseStream for Anthropic Claude messages API.
 */
export async function* invokeClaudeStream(
  input: GenerateInput,
  opts?: { signal?: AbortSignal },
): AsyncGenerator<StreamChunk, void, undefined> {
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

  const cmd = new InvokeModelWithResponseStreamCommand({
    modelId,
    contentType: "application/json",
    accept: "application/json",
    body: new TextEncoder().encode(body),
  });
  const out =
    opts?.signal !== undefined
      ? await client.send(cmd, { abortSignal: opts.signal })
      : await client.send(cmd);

  if (!out.body) {
    throw new Error("Bedrock InvokeModelWithResponseStream: empty body");
  }

  for await (const event of out.body) {
    if (opts?.signal?.aborted) {
      break;
    }
    if (event.internalServerException) {
      throw new Error(event.internalServerException.message ?? "Bedrock internalServerException");
    }
    if (event.modelStreamErrorException) {
      throw new Error(event.modelStreamErrorException.message ?? "Bedrock modelStreamErrorException");
    }
    if (event.throttlingException) {
      throw new Error(event.throttlingException.message ?? "Bedrock throttlingException");
    }
    if (event.validationException) {
      throw new Error(event.validationException.message ?? "Bedrock validationException");
    }

    const chunk = event.chunk;
    if (chunk?.bytes == null) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(new TextDecoder().decode(chunk.bytes));
    } catch {
      continue;
    }
    if (typeof parsed !== "object" || parsed === null) continue;

    const rec = parsed as Record<string, unknown>;
    const type = rec.type;

    if (type === "content_block_delta") {
      const delta = rec.delta as Record<string, unknown> | undefined;
      if (delta?.type === "text_delta" && typeof delta.text === "string" && delta.text.length > 0) {
        yield { kind: "text", text: delta.text };
      }
    }

    if (type === "message_delta") {
      const usage = rec.usage as Record<string, unknown> | undefined;
      const stop = rec.delta as Record<string, unknown> | undefined;
      yield {
        kind: "usage",
        modelId,
        inputTokens: typeof usage?.input_tokens === "number" ? usage.input_tokens : null,
        outputTokens: typeof usage?.output_tokens === "number" ? usage.output_tokens : null,
        stopReason: typeof stop?.stop_reason === "string" ? stop.stop_reason : null,
      };
    }
  }
}
