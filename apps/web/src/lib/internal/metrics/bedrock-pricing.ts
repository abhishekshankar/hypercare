/**
 * Plausible Amazon Bedrock on-demand *order-of-magnitude* pricing for sanity checks
 * (TASK-029 — not for billing; update when the production model/region changes).
 */
const USD_PER_1K_INPUT = 0.003;
const USD_PER_1K_OUTPUT = 0.015;

export function estimateBedrockCostUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1000) * USD_PER_1K_INPUT + (outputTokens / 1000) * USD_PER_1K_OUTPUT;
}
