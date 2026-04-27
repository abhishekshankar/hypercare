import type { PersistFn } from "@alongside/safety";
import { loadPolicyFromFile, defaultPolicyPath } from "@alongside/model-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runPipeline, type Deps } from "../src/pipeline.js";
import type { AnswerInput } from "../src/types.js";

function mkHit(i: number) {
  return {
    chunkId: `c${i}`,
    moduleId: "m1",
    moduleSlug: "medical-understanding-diagnosis",
    moduleTitle: "Understanding diagnosis",
    category: "medical",
    attributionLine: "attr",
    sectionHeading: "h",
    stageRelevance: ["early"] as const,
    chunkIndex: i,
    content: `Educational content about diagnosis for caregivers [${i + 1}].`,
    distance: 0.1,
    moduleTier: 1,
  };
}

/** Layer 3 needs ≥3 hits under the secondary distance threshold (default 0.6). */
const hits = [mkHit(0), mkHit(1), mkHit(2), mkHit(3)];

describe("runPipeline model routing (TASK-042)", () => {
  const persist: PersistFn = async () => ({ repeatInWindow: false });

  beforeEach(() => {
    vi.stubEnv("MODEL_ROUTING", "1");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("invokes generate with policy model id for treatment + medical topic", async () => {
    const generate = vi.fn(async () => ({
      text: "Understanding diagnosis is important and caregivers should ask clinicians when uncertain about symptoms [1].",
      modelId: "from-mock",
      inputTokens: 10,
      outputTokens: 20,
      stopReason: "end_turn",
    }));

    const deps: Deps = {
      embed: async () => new Array(1024).fill(0),
      search: async () => hits,
      loadStage: async () => "early",
      generate,
      safety: {
        persist,
        warn: () => {},
      },
      topicClassify: async () => ({ topics: ["understanding-diagnosis"], confidence: 0.9 }),
    };

    const input: AnswerInput = {
      question: "Tell me about diagnosis",
      userId: "11111111-1111-4111-8111-111111111111",
      routingCohort: "routing_v1_treatment",
    };

    const policy = loadPolicyFromFile(defaultPolicyPath());
    const medicalRule = policy.routes.find((r) => r.match.topic === "medical");
    expect(medicalRule).toBeDefined();

    await runPipeline(input, deps);

    expect(generate).toHaveBeenCalledTimes(1);
    const calls = generate.mock.calls as unknown as [readonly [{ modelId?: string }]];
    expect(calls[0]?.[0]?.modelId).toBe(medicalRule!.model_id);
  });

  it("invokes generate with default model id for control cohort", async () => {
    const generate = vi.fn(async () => ({
      text: "Understanding diagnosis is important and caregivers should ask clinicians when uncertain about symptoms [1].",
      modelId: "from-mock",
      inputTokens: 10,
      outputTokens: 20,
      stopReason: "end_turn",
    }));

    const deps: Deps = {
      embed: async () => new Array(1024).fill(0),
      search: async () => hits,
      loadStage: async () => "early",
      generate,
      safety: {
        persist,
        warn: () => {},
      },
      topicClassify: async () => ({ topics: ["understanding-diagnosis"], confidence: 0.9 }),
    };

    const input: AnswerInput = {
      question: "Tell me about diagnosis",
      userId: "22222222-2222-4222-8222-222222222222",
      routingCohort: "routing_v1_control",
    };

    const policy = loadPolicyFromFile(defaultPolicyPath());

    await runPipeline(input, deps);

    const calls = generate.mock.calls as unknown as [readonly [{ modelId?: string }]];
    expect(calls[0]?.[0]?.modelId).toBe(policy.default_model_id);
  });
});
