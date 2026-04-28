import { describe, expect, it, vi } from "vitest";
import type { ClassifyDeps } from "@alongside/safety";

import type { GenerateInput, GenerateOutput } from "../src/bedrock/claude.js";
import type { CareRetrievalAxes } from "../src/care/profile.js";
import { runPipeline, type Deps } from "../src/pipeline.js";
import type { RetrievedChunk, Stage } from "../src/types.js";
import { fakeEmbedding, makeChunk } from "./fixtures.js";

type SearchArgs = {
  embedding: number[];
  stage: Stage | null;
  relationship: string | null;
  livingSituation: string | null;
  k: number;
};

function defaultAxes(): CareRetrievalAxes {
  return { stage: "middle", relationship: "parent", livingSituation: "with_caregiver" };
}

const offlineSafety: ClassifyDeps = {
  persist: vi.fn(async () => ({ repeatInWindow: false })),
  disableLlm: true,
};

const offlineTopicClassify: Deps["topicClassify"] = async () => ({
  topics: [],
  confidence: 0,
});

function buildDeps(over: Partial<Deps> = {}): Deps {
  const { config: configOverride, warn, onUsage, ...rest } = over;
  return {
    topicClassify: rest.topicClassify ?? offlineTopicClassify,
    embed: rest.embed ?? vi.fn(async (_t: string): Promise<number[]> => fakeEmbedding()),
    search:
      rest.search ??
      vi.fn(async (_q: SearchArgs): Promise<RetrievedChunk[]> => [
        makeChunk({ chunkId: "a", distance: 0.1 }),
        makeChunk({ chunkId: "b", distance: 0.15 }),
        makeChunk({ chunkId: "c", distance: 0.25 }),
      ]),
    loadCareAxes: rest.loadCareAxes ?? vi.fn(async (_u: string): Promise<CareRetrievalAxes> => defaultAxes()),
    generate:
      rest.generate ??
      vi.fn(
        async (_in: GenerateInput): Promise<GenerateOutput> => ({
          text: "Sundowning is a late-day pattern of agitation that often eases with routine [1].",
          modelId: "test-model",
          inputTokens: 50,
          outputTokens: 25,
          stopReason: "end_turn",
        }),
      ),
    safety: rest.safety ?? offlineSafety,
    ...(configOverride !== undefined ? { config: configOverride } : {}),
    ...(warn !== undefined ? { warn } : {}),
    ...(onUsage !== undefined ? { onUsage } : {}),
  };
}

describe("pipeline orchestrator (end-to-end, all mocks)", () => {
  it("returns an answered result when retrieval + verification pass", async () => {
    const deps = buildDeps();
    const r = await runPipeline(
      { question: "my mom gets agitated every afternoon, what do i do?", userId: "u1" },
      deps,
    );
    expect(r.kind).toBe("answered");
    if (r.kind === "answered") {
      expect(r.text).toContain("[1]");
      expect(r.citations).toHaveLength(1);
      expect(r.citations[0]!.chunkId).toBe("a");
      expect(r.usage.inputTokens).toBe(50);
      expect(r.usage.outputTokens).toBe(25);
      expect(r.usage.modelId).toBe("test-model");
    }
  });

  it("threads Bedrock usage into answered usage (TASK-017)", async () => {
    const deps = buildDeps({
      generate: vi.fn(
        async (_in: GenerateInput): Promise<GenerateOutput> => ({
          text: "Sundowning is a late-day pattern of agitation that often eases with routine [1].",
          modelId: "us.test.model",
          inputTokens: 123,
          outputTokens: 45,
          stopReason: "end_turn",
        }),
      ),
    });
    const r = await runPipeline(
      { question: "my mom gets agitated every afternoon, what do i do?", userId: "u1" },
      deps,
    );
    expect(r.kind).toBe("answered");
    if (r.kind === "answered") {
      expect(r.usage.inputTokens).toBe(123);
      expect(r.usage.outputTokens).toBe(45);
      expect(r.usage.modelId).toBe("us.test.model");
    }
  });

  it("invokes onUsage after generation (including when layer 6 refuses)", async () => {
    const onUsage = vi.fn();
    const deps = buildDeps({
      onUsage,
      generate: vi.fn(
        async (_in: GenerateInput): Promise<GenerateOutput> => ({
          text: "Sundowning is a late-day pattern that often eases with routine.",
          modelId: "m",
          inputTokens: 10,
          outputTokens: 20,
          stopReason: null,
        }),
      ),
    });
    const r = await runPipeline({ question: "agitation help", userId: "u1" }, deps);
    expect(r.kind).toBe("refused");
    if (r.kind === "refused") expect(r.reason.code).toBe("uncitable_response");
    expect(onUsage).toHaveBeenCalledWith({
      inputTokens: 10,
      outputTokens: 20,
      modelId: "m",
    });
  });

  it("refuses with no_content when retrieval returns nothing", async () => {
    const deps = buildDeps({
      search: vi.fn(async (_q: SearchArgs): Promise<RetrievedChunk[]> => []),
    });
    const r = await runPipeline({ question: "x", userId: "u1" }, deps);
    expect(r.kind).toBe("refused");
    if (r.kind === "refused") expect(r.reason.code).toBe("no_content");
  });

  it("refuses with low_confidence when top-1 distance is too far", async () => {
    const deps = buildDeps({
      search: vi.fn(async (_q: SearchArgs): Promise<RetrievedChunk[]> => [
        makeChunk({ distance: 0.7 }),
        makeChunk({ distance: 0.72 }),
      ]),
    });
    const r = await runPipeline(
      { question: "what is the capital of france?", userId: "u1" },
      deps,
    );
    expect(r.kind).toBe("refused");
    if (r.kind === "refused") expect(r.reason.code).toBe("low_confidence");
  });

  it("refuses with off_topic when top-1 distance is enormous", async () => {
    const deps = buildDeps({
      search: vi.fn(async (_q: SearchArgs): Promise<RetrievedChunk[]> => [
        makeChunk({ distance: 0.97, category: "behaviors" }),
      ]),
    });
    const r = await runPipeline({ question: "anything", userId: "u1" }, deps);
    expect(r.kind).toBe("refused");
    if (r.kind === "refused") expect(r.reason.code).toBe("off_topic");
  });

  it("refuses with uncitable_response when the model emits no citations", async () => {
    const deps = buildDeps({
      generate: vi.fn(
        async (_in: GenerateInput): Promise<GenerateOutput> => ({
          text: "Sundowning is a late-day pattern that often eases with routine.",
          modelId: "x",
          inputTokens: 1,
          outputTokens: 1,
          stopReason: null,
        }),
      ),
    });
    const r = await runPipeline({ question: "agitation help", userId: "u1" }, deps);
    expect(r.kind).toBe("refused");
    if (r.kind === "refused") expect(r.reason.code).toBe("uncitable_response");
  });

  it("converts INSUFFICIENT_CONTEXT into a low_confidence refusal", async () => {
    const deps = buildDeps({
      generate: vi.fn(
        async (_in: GenerateInput): Promise<GenerateOutput> => ({
          text: "INSUFFICIENT_CONTEXT",
          modelId: "x",
          inputTokens: 1,
          outputTokens: 1,
          stopReason: null,
        }),
      ),
    });
    const r = await runPipeline({ question: "agitation help", userId: "u1" }, deps);
    expect(r.kind).toBe("refused");
    if (r.kind === "refused") expect(r.reason.code).toBe("low_confidence");
  });

  it("forwards the inferred stage from loadCareAxes into search", async () => {
    const search = vi.fn(async (_q: SearchArgs): Promise<RetrievedChunk[]> => [
      makeChunk({ chunkId: "a", distance: 0.1 }),
      makeChunk({ chunkId: "b", distance: 0.2 }),
      makeChunk({ chunkId: "c", distance: 0.3 }),
    ]);
    const deps = buildDeps({
      loadCareAxes: vi.fn(async (): Promise<CareRetrievalAxes> => ({
        stage: "late",
        relationship: "parent",
        livingSituation: "with_caregiver",
      })),
      search,
    });
    await runPipeline({ question: "anything", userId: "u9" }, deps);
    expect(search).toHaveBeenCalled();
    const call1 = search.mock.calls[0];
    if (!call1) throw new Error("expected search call");
    expect(call1[0].stage).toBe<Stage>("late");
  });

  it("passes stage=null when loadCareAxes returns null stage (insufficient profile)", async () => {
    const search = vi.fn(async (_q: SearchArgs): Promise<RetrievedChunk[]> => [
      makeChunk({ chunkId: "a", distance: 0.1 }),
      makeChunk({ chunkId: "b", distance: 0.2 }),
      makeChunk({ chunkId: "c", distance: 0.3 }),
    ]);
    const deps = buildDeps({
      loadCareAxes: vi.fn(async (): Promise<CareRetrievalAxes> => ({
        stage: null,
        relationship: null,
        livingSituation: null,
      })),
      search,
    });
    await runPipeline({ question: "anything", userId: "u9" }, deps);
    const call2 = search.mock.calls[0];
    if (!call2) throw new Error("expected search call");
    expect(call2[0].stage).toBeNull();
  });

  /** Thrown dep (e.g. embed/Bedrock) must not hang the user — refusal path. */
  it("converts unexpected throws into internal_error refusals", async () => {
    const deps = buildDeps({
      embed: vi.fn(async (_t: string): Promise<number[]> => {
        throw new Error("boom");
      }),
    });
    const r = await runPipeline({ question: "x", userId: "u1" }, deps);
    expect(r.kind).toBe("refused");
    if (r.kind === "refused") expect(r.reason.code).toBe("internal_error");
  });

  it("calls warn with structured context when loadCareAxes throws (internal_error)", async () => {
    const err = new Error("invalid uuid");
    const warn = vi.fn();
    const deps = buildDeps({
      warn,
      loadCareAxes: vi.fn(async () => {
        throw err;
      }),
    });
    const r = await runPipeline(
      { question: "a".repeat(200), userId: "user-id-for-eval" },
      deps,
    );
    expect(r.kind).toBe("refused");
    if (r.kind === "refused") {
      expect(r.reason.code).toBe("internal_error");
      if (r.reason.code === "internal_error") {
        expect(r.reason.detail).toBe(err.message);
      }
    }
    expect(warn).toHaveBeenCalledOnce();
    const [msg, ctx] = warn.mock.calls[0]!;
    expect(msg).toBe("rag.pipeline.internal_error");
    expect(ctx).toMatchObject({
      errMessage: err.message,
      errStack: err.stack,
      errName: err.name,
      userId: "user-id-for-eval",
      questionPreview: "a".repeat(120),
    });
  });

  it("short-circuits with safety_triaged on a Layer-A crisis match — never reaches retrieval", async () => {
    const search = vi.fn(async (_q: SearchArgs): Promise<RetrievedChunk[]> => [
      makeChunk({ chunkId: "a", distance: 0.1 }),
    ]);
    const generate = vi.fn(
      async (_in: GenerateInput): Promise<GenerateOutput> => ({
        text: "should never run",
        modelId: "x",
        inputTokens: 0,
        outputTokens: 0,
        stopReason: null,
      }),
    );
    const persist = vi.fn(async () => ({ repeatInWindow: false }));
    const deps = buildDeps({
      search,
      generate,
      safety: { persist, disableLlm: true },
    });
    const r = await runPipeline(
      { question: "my mom said she wishes she were dead", userId: "u1" },
      deps,
    );
    expect(r.kind).toBe("refused");
    if (r.kind === "refused") {
      expect(r.reason.code).toBe("safety_triaged");
      if (r.reason.code === "safety_triaged") {
        expect(r.reason.category).toBe("self_harm_cr");
        expect(r.reason.suggestedAction).toBe("call_988");
        expect(r.reason.severity).toBe("high");
        expect(r.reason.source).toBe("rule");
      }
    }
    expect(search).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("answers normally on a non-crisis golden question (sundowning) — no safety flag", async () => {
    const persist = vi.fn(async () => ({ repeatInWindow: false }));
    const deps = buildDeps({ safety: { persist, disableLlm: true } });
    const r = await runPipeline(
      { question: "how do I help with sundowning", userId: "u1" },
      deps,
    );
    expect(r.kind).toBe("answered");
    expect(persist).not.toHaveBeenCalled();
  });
});
