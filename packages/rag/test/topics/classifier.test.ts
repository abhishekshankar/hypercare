import { describe, expect, it, vi } from "vitest";

import { classifyTopics, type TopicClassifyDeps } from "../../src/topics/classifier.js";

describe("classifyTopics", () => {
  it("empty input — no LLM", async () => {
    const invoke = vi.fn(async () => {
      throw new Error("should not be called");
    });
    const r = await classifyTopics({ userId: "u1", question: "   " }, { invoke });
    expect(r).toEqual({ topics: [], confidence: 0 });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("bathing question — maps to bathing-resistance when LLM returns it", async () => {
    const invoke: TopicClassifyDeps["invoke"] = async () =>
      JSON.stringify({ topics: ["bathing-resistance"], confidence: 0.9 });
    const r = await classifyTopics(
      { userId: "u1", question: "How do I get her to take a shower?" },
      { invoke },
    );
    expect(r.topics[0]).toBe("bathing-resistance");
    expect(r.confidence).toBe(0.9);
  });

  it("off-vocab slug is dropped and warn is called", async () => {
    const warn = vi.fn();
    const invoke: TopicClassifyDeps["invoke"] = async () =>
      JSON.stringify({ topics: ["not-a-real-slug", "sundowning"], confidence: 0.5 });
    const r = await classifyTopics({ userId: "u1", question: "evenings are hard" }, { invoke, warn });
    expect(r.topics).toEqual(["sundowning"]);
    expect(warn).toHaveBeenCalledWith(
      "rag.topics.classifier.off_vocab_slug",
      expect.objectContaining({ slug: "not-a-real-slug" }),
    );
  });

  it("LLM throw — empty result and warn", async () => {
    const warn = vi.fn();
    const invoke: TopicClassifyDeps["invoke"] = async () => {
      throw new Error("bedrock down");
    };
    const r = await classifyTopics({ userId: "u1", question: "help with agitation" }, { invoke, warn });
    expect(r).toEqual({ topics: [], confidence: 0 });
    expect(warn).toHaveBeenCalledWith("rag.topics.classifier.invoke_failed", expect.anything());
  });
});
