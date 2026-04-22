import type { ClassifyDeps } from "@hypercare/safety";
import type { Deps, RetrievedChunk } from "@hypercare/rag";

import type { AnswerGoldenCase } from "../types.js";
import { makeRetrievedChunk } from "./chunk.js";
import { deterministicEmbedding } from "./embedding.js";
import { RETRIEVAL_OFFLINE_HITS } from "./retrieval-offline-hits.js";

const noopPersist: ClassifyDeps["persist"] = async () => {};

const offlineSafety: ClassifyDeps = {
  persist: noopPersist,
  disableLlm: true,
};

const offlineTopicClassify: Deps["topicClassify"] = async () => ({
  topics: [],
  confidence: 0,
});

type Gen = Deps["generate"];

function genOk(_module: "behavior" | "daily" | "self"): Gen {
  return (async () => ({
    text: "A grounded first step is to keep evenings calm and lower stimulation before the sun sets, which many caregivers find useful [1].",
    modelId: "eval-offline",
    inputTokens: 120,
    outputTokens: 40,
    stopReason: "end_turn",
  })) as Gen;
}

function genWith(_module: "behavior" | "daily" | "self", line: string): Gen {
  return (async () => ({
    text: line,
    modelId: "eval-offline",
    inputTokens: 100,
    outputTokens: 30,
    stopReason: "end_turn",
  })) as Gen;
}

function hitsFor(
  k: "behavior" | "daily" | "self",
  dTop: number,
  extra: { secondaries: { mod: "behavior" | "daily" | "self"; d: number }[] },
): RetrievedChunk[] {
  const lead = makeRetrievedChunk(k, {
    chunkId: `${k}-a`,
    distance: dTop,
    chunkIndex: 0,
    content: "Primary content line for eval.",
    sectionHeading: "H",
  });
  return [
    lead,
    ...extra.secondaries.map((e, i) =>
      makeRetrievedChunk(e.mod, {
        chunkId: `${e.mod}-x${String(i)}`,
        distance: e.d,
        chunkIndex: i + 1,
        content: "Support chunk.",
        sectionHeading: "H2",
      }),
    ),
  ];
}

type Built = Pick<Deps, "embed" | "search" | "loadStage" | "generate" | "safety" | "topicClassify">;

/**
 * Return deps that make `runPipeline` behave deterministically for a golden answer id (offline only).
 */
export function buildAnswerOfflineDeps(c: AnswerGoldenCase, _userId: string): Built {
  const stage = c.stage;
  const loadStage = async (_uid: string) => stage;
  const embed = async (_t: string) => deterministicEmbedding(c.id);
  // Refusals: safety first
  if (c.id === "a_ref_safety") {
    return {
      embed,
      search: async () => [],
      loadStage,
      safety: offlineSafety,
      generate: genOk("behavior"),
      topicClassify: offlineTopicClassify,
    };
  }
  if (c.id === "a_ref_france") {
    const h = [
      makeRetrievedChunk("behavior", {
        chunkId: "fr-1",
        distance: 0.92,
        chunkIndex: 0,
        content: "unrelated",
        sectionHeading: "X",
      }),
    ];
    return {
      embed,
      search: async () => h,
      loadStage,
      safety: offlineSafety,
      generate: genOk("behavior"),
      topicClassify: offlineTopicClassify,
    };
  }
  if (c.id === "a_ref_math") {
    return {
      embed,
      search: async () =>
        hitsFor("daily", 0.45, {
          secondaries: [
            { mod: "daily", d: 0.7 },
            { mod: "daily", d: 0.71 },
            { mod: "daily", d: 0.72 },
          ],
        }),
      loadStage,
      safety: offlineSafety,
      generate: genOk("daily"),
      topicClassify: offlineTopicClassify,
    };
  }
  if (c.id === "a_ref_uncite") {
    return {
      embed,
      search: async () =>
        hitsFor("behavior", 0.2, {
          secondaries: [
            { mod: "behavior", d: 0.35 },
            { mod: "behavior", d: 0.38 },
            { mod: "daily", d: 0.4 },
          ],
        }),
      loadStage,
      safety: offlineSafety,
      generate: genWith(
        "behavior",
        "Sundowning is a late-day pattern that can be very stressful and you may need a calm approach for your family when evenings feel impossible.",
      ),
      topicClassify: offlineTopicClassify,
    };
  }
  if (c.id === "a_ref_empty") {
    return {
      embed,
      search: async () => [],
      loadStage,
      safety: offlineSafety,
      generate: genOk("behavior"),
      topicClassify: offlineTopicClassify,
    };
  }
  // Answered paths — reuse same distance profile as a successful ground from TASK-008-shaped chunks
  const answerHits = (k: "behavior" | "daily" | "self") =>
    hitsFor(k, 0.18, {
      secondaries: [
        { mod: k, d: 0.22 },
        { mod: k, d: 0.3 },
        { mod: k, d: 0.4 },
      ],
    });
  if (c.id.startsWith("a_bs_")) {
    return {
      embed,
      search: async () => answerHits("behavior"),
      loadStage,
      safety: offlineSafety,
      generate: genOk("behavior"),
      topicClassify: offlineTopicClassify,
    };
  }
  if (c.id.startsWith("a_db_")) {
    return {
      embed,
      search: async () => answerHits("daily"),
      loadStage,
      safety: offlineSafety,
      generate: genOk("daily"),
      topicClassify: offlineTopicClassify,
    };
  }
  if (c.id.startsWith("a_sc_")) {
    return {
      embed,
      search: async () => answerHits("self"),
      loadStage,
      safety: offlineSafety,
      generate: genOk("self"),
      topicClassify: offlineTopicClassify,
    };
  }
  return {
    embed,
    search: async (_q) => {
      const r = await Promise.resolve(
        (RETRIEVAL_OFFLINE_HITS as Record<string, RetrievedChunk[] | undefined>)[`r_bs_01`],
      );
      return r ?? [];
    },
    loadStage,
    safety: offlineSafety,
    generate: genOk("behavior"),
    topicClassify: offlineTopicClassify,
  };
}
