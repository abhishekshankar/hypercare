import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const MODEL_ID = "amazon.titan-embed-text-v2:0" as const;
const REGION = "ca-central-1" as const;
const EMBED_DIMS = 1024 as const;

const client = new BedrockRuntimeClient({ region: REGION });

/**
 * Titan Text Embeddings v2 — inputText must include the module title (caller prepends
 * `title + "\\n" + content`) for retrieval quality, per TASK-008.
 */
export async function embedTitanV2(embeddingText: string): Promise<number[]> {
  const body = JSON.stringify({
    inputText: embeddingText,
    dimensions: EMBED_DIMS,
    normalize: true,
  });
  const out = await client.send(
    new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: new TextEncoder().encode(body),
    }),
  );
  if (!out.body) {
    throw new Error("Bedrock InvokeModel: empty body");
  }
  const json = JSON.parse(new TextDecoder().decode(out.body)) as { embedding?: number[] };
  const emb = json.embedding;
  if (!Array.isArray(emb) || emb.length !== EMBED_DIMS) {
    throw new Error(
      `Expected embedding length ${String(EMBED_DIMS)}, got ${Array.isArray(emb) ? emb.length : "non-array"}`,
    );
  }
  return emb;
}

export function buildEmbeddingText(moduleTitle: string, chunkContent: string): string {
  return `${moduleTitle}\n${chunkContent}`;
}
