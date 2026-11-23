/**
 * One-shot Bedrock health check: Titan Embeddings v2 + Claude (generation).
 * Same code paths as `@alongside/content` + `@alongside/rag` Bedrock clients.
 * Does not use the database.
 *
 * Prereqs:
 *   - AWS credentials (env, `~/.aws/credentials`, or `AWS_PROFILE`)
 *   - `export AWS_REGION=ca-central-1` (Titan/Claude clients default to this in code, but
 *     other tooling reads `AWS_REGION` — set it to avoid surprises)
 *   - In Bedrock console: **Model access** for the models you use
 *
 * If Claude fails with "invalid model identifier" but Titan passes, your account may use a
 * different model id — set `BEDROCK_ANSWER_MODEL_ID` to the id shown in the console for your
 * enabled chat model, then re-run.
 *
 *   pnpm --filter @alongside/rag bedrock-check
 */
import { ANSWER_MODEL_ID } from "../src/config.js";
import { embedTitanV2 } from "@alongside/content";
import { invokeClaude } from "../src/bedrock/claude.js";

let titanOk = false;

async function main() {
  const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "(unset — SDK uses code default ca-central-1 for these clients)";
  const claudeModel =
    process.env.BEDROCK_ANSWER_MODEL_ID?.trim() || ANSWER_MODEL_ID;
  console.log("Bedrock check");
  console.log("  AWS_REGION (env):", region);
  console.log("  Claude model id: ", claudeModel, process.env.BEDROCK_ANSWER_MODEL_ID ? "(from BEDROCK_ANSWER_MODEL_ID)" : "(from packages/rag config)");
  console.log("");

  console.log("1) Titan Text Embeddings v2 (amazon.titan-embed-text-v2:0) …");
  const emb = await embedTitanV2("Health check: embedding one short string.");
  if (emb.length !== 1024) throw new Error(`Expected 1024-dim embedding, got ${String(emb.length)}`);
  titanOk = true;
  console.log("   OK — embedding length:", emb.length, "\n");

  console.log("2) Haiku / chat model (", claudeModel, ") …");
  const out = await invokeClaude({
    systemPrompt: "Reply with exactly: OK",
    userPrompt: "ping",
    maxTokens: 20,
    modelId: claudeModel,
  });
  console.log("   OK — text:", JSON.stringify(out.text.trim()));
  console.log("   modelId:", out.modelId);
  console.log("   usage:", { in: out.inputTokens, out: out.outputTokens });
  console.log("");
  console.log("All checks passed: Bedrock is working for this project (embed + chat).");
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  if (titanOk) {
    console.error("\nTitan embeddings: OK  ← AWS credentials and Bedrock InvokeModel work.");
    console.error("Chat (Claude) model: FAIL\n");
  } else {
    console.error("\nTitan embeddings: FAIL\n");
  }
  console.error("Common causes:");
  console.error("  - Invalid/expired AWS credentials (aws configure, or AWS_ACCESS_KEY_ID / AWS_SESSION_TOKEN)");
  console.error("  - Wrong region: export AWS_REGION=ca-central-1");
  console.error("  - Model not enabled: AWS Console → Amazon Bedrock → Model access");
  console.error("  - Wrong chat model id: set BEDROCK_ANSWER_MODEL_ID to an id your account can invoke");
  console.error("  - IAM: bedrock:InvokeModel on the model in this account/region");
  console.error("\nError:", msg);
  process.exit(1);
});
