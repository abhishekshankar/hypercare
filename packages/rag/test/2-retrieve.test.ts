import { describe, expect, it, vi } from "vitest";

import { retrieve, type RetrieveDeps } from "../src/layers/2-retrieve.js";
import type { RetrievedChunk, Stage } from "../src/types.js";
import { fakeEmbedding, makeChunk } from "./fixtures.js";

type SearchArgs = {
  embedding: number[];
  stage: Stage | null;
  relationship: string | null;
  livingSituation: string | null;
  k: number;
};

function makeDeps(over: Partial<RetrieveDeps> = {}): RetrieveDeps {
  return {
    embed: vi.fn(async (_t: string): Promise<number[]> => fakeEmbedding()),
    search: vi.fn(async (_q: SearchArgs): Promise<RetrievedChunk[]> => []),
    ...over,
  };
}

describe("layer 2 — retrieve (unit, mocked)", () => {
  it("calls embed with the scrubbed question and forwards stage + k to search", async () => {
    const embed = vi.fn(async (_t: string): Promise<number[]> => fakeEmbedding());
    const search = vi.fn(async (_q: SearchArgs): Promise<RetrievedChunk[]> => [
      makeChunk({ distance: 0.1 }),
    ]);

    const out = await retrieve(
      { scrubbedQuestion: "why agitated", stage: "middle", relationship: "parent", livingSituation: "with_caregiver", k: 6 },
      { embed, search },
    );

    expect(embed).toHaveBeenCalledWith("why agitated");
    expect(search).toHaveBeenCalledTimes(1);
    const call = search.mock.calls[0];
    if (!call) throw new Error("expected at least one search call");
    const arg = call[0];
    expect(arg.embedding.length).toBe(1024);
    expect(arg.stage).toBe<Stage>("middle");
    expect(arg.relationship).toBe("parent");
    expect(arg.livingSituation).toBe("with_caregiver");
    expect(arg.k).toBe(6);
    expect(out.hits).toHaveLength(1);
    expect(out.embedDims).toBe(1024);
  });

  it("sorts results ascending by distance even if search returned them out of order", async () => {
    const unordered: RetrievedChunk[] = [
      makeChunk({ chunkId: "c", distance: 0.7 }),
      makeChunk({ chunkId: "a", distance: 0.1 }),
      makeChunk({ chunkId: "b", distance: 0.3 }),
    ];
    const deps = makeDeps({
      search: vi.fn(async (_q: SearchArgs): Promise<RetrievedChunk[]> => unordered),
    });
    const out = await retrieve({ scrubbedQuestion: "x", stage: null, relationship: null, livingSituation: null, k: 6 }, deps);
    expect(out.hits.map((h) => h.chunkId)).toEqual(["a", "b", "c"]);
  });

  it("throws when the embedding model returns the wrong dimensionality", async () => {
    const deps = makeDeps({
      embed: vi.fn(async (_t: string): Promise<number[]> => new Array(512).fill(0)),
    });
    await expect(
      retrieve({ scrubbedQuestion: "x", stage: null, relationship: null, livingSituation: null, k: 6 }, deps),
    ).rejects.toThrow(/1024/);
  });

  it("returns empty hits and skips embed when the question is empty", async () => {
    const embed = vi.fn(async (_t: string): Promise<number[]> => fakeEmbedding());
    const search = vi.fn(async (_q: SearchArgs): Promise<RetrievedChunk[]> => []);
    const out = await retrieve(
      { scrubbedQuestion: "", stage: null, relationship: null, livingSituation: null, k: 6 },
      { embed, search },
    );
    expect(out.hits).toEqual([]);
    expect(embed).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
  });
});

// Live integration — gated. Hits Bedrock + Postgres.
describe.skipIf(!process.env.RAG_LIVE)("layer 2 — retrieve (live, RAG_LIVE=1)", () => {
  it("returns >0 hits for a sundowning-style question", async () => {
    const { embedTitanV2 } = await import("@alongside/content");
    const { searchChunks } = await import("../src/db/search.js");
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL must be set with RAG_LIVE=1");
    const out = await retrieve(
      {
        scrubbedQuestion: "my mom gets agitated every afternoon, what do i do?",
        stage: null,
        relationship: null,
        livingSituation: null,
        k: 6,
      },
      {
        embed: (t) => embedTitanV2(t),
        search: ({ embedding, stage, relationship, livingSituation, k }) =>
          searchChunks({ databaseUrl, embedding, stage, relationship, livingSituation, k }),
      },
    );
    expect(out.hits.length).toBeGreaterThan(0);
    expect(out.hits[0]!.distance).toBeLessThan(0.6);
  }, 30_000);
});
