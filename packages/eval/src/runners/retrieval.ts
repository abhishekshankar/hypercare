import { readFile } from "node:fs/promises";

import { buildDefaultDeps, runPipeline, type Deps, type RetrievedChunk } from "@hypercare/rag";

import { DEFAULT_RECALL_AT_K } from "../config.js";
import { goldenPath } from "../paths.js";
import { writeJsonReport } from "../report.js";
import type { RetrievalGoldenCase, RetrievalCaseReport, RetrievalReport } from "../types.js";
import { deterministicEmbedding } from "../fixtures/embedding.js";
import { RETRIEVAL_OFFLINE_HITS } from "../fixtures/retrieval-offline-hits.js";
import { parseRetrievalGolden } from "../validate-golden.js";
import { assertModulesPresent } from "../live/preflight.js";
import { seedEvalUser, type SeededEvalUser } from "../live/seed-user.js";

const live = process.env.EVAL_LIVE === "1";

function topModuleSlugs(hits: RetrievedChunk[], k: number): string[] {
  return hits.slice(0, k).map((h) => h.moduleSlug);
}

function firstExpectedRank(
  sortedHits: RetrievedChunk[],
  expected: string[],
  k: number,
): number | null {
  const top = sortedHits.slice(0, k);
  for (let i = 0; i < top.length; i++) {
    if (expected.includes(top[i]!.moduleSlug)) return i + 1;
  }
  return null;
}

function passCase(
  slugs: string[],
  expected: string[],
  notExpected: string[] | undefined,
): { pass: boolean; violations: string[] } {
  const top = new Set(slugs);
  const has = expected.some((e) => top.has(e));
  const bad = (notExpected ?? []).filter((m) => top.has(m));
  return { pass: has && bad.length === 0, violations: bad };
}

export async function runRetrievalEval(): Promise<{
  report: RetrievalReport;
  exitCode: number;
  regMessage: string;
}> {
  const raw = await readFile(goldenPath("retrieval.json"), "utf8");
  const cases = parseRetrievalGolden(JSON.parse(raw)) as RetrievalGoldenCase[];
  const k = DEFAULT_RECALL_AT_K;
  const perCase: RetrievalCaseReport[] = [];
  const latencies: number[] = [];

  const dbUrl = process.env.DATABASE_URL;
  if (live && !dbUrl) {
    throw new Error("EVAL_LIVE=1 requires DATABASE_URL");
  }
  if (live && dbUrl) await assertModulesPresent(dbUrl);
  const base: Deps | null = live && dbUrl ? buildDefaultDeps({ databaseUrl: dbUrl }) : null;

  let seeded: SeededEvalUser | null = null;
  if (live && dbUrl) {
    seeded = await seedEvalUser(dbUrl, "retrieval");
  }

  try {
    for (const c of cases) {
      const t0 = Date.now();
      let captured: RetrievedChunk[] = [];
      const userId = seeded?.userId ?? `eval-retrieval:${c.id}`;

      let deps: Deps;
      if (live && base) {
        const copy = { ...base };
        const innerSearch = copy.search;
        deps = {
          ...copy,
          search: async (q) => {
            const h = await innerSearch(q);
            captured = h;
            return h;
          },
          safety: { ...copy.safety, disableLlm: true },
          config: { ...copy.config },
        };
      } else {
        const hits = RETRIEVAL_OFFLINE_HITS[c.id];
        if (!hits) {
          throw new Error(`Missing offline hit fixture for case ${c.id}`);
        }
        const offlineTopic: Deps["topicClassify"] = async () => ({
          topics: [],
          confidence: 0,
        });
        deps = {
          embed: async (text) => deterministicEmbedding(c.id + text.slice(0, 40)),
          search: async () => {
            captured = hits;
            return hits;
          },
          loadStage: async () => c.stage,
          generate: async (_gen) => {
            return {
              text: "Eval stub [1].",
              modelId: "eval-offline",
              inputTokens: 1,
              outputTokens: 1,
              stopReason: "end_turn",
            };
          },
          safety: { persist: async () => {}, disableLlm: true },
          topicClassify: offlineTopic,
        };
      }

      await runPipeline(
        { question: c.question, userId },
        { ...deps, config: { ...(deps.config ?? {}), retrievalK: Math.max(6, k) } },
      );
      const ms = Date.now() - t0;
      latencies.push(ms);
      const sorted = [...captured].sort((a, b) => a.distance - b.distance);
      const topSlugs = topModuleSlugs(sorted, k);
      const { pass, violations } = passCase(topSlugs, c.expected_modules, c.expected_not_modules);
      const rank = firstExpectedRank(sorted, c.expected_modules, k);
      perCase.push({
        id: c.id,
        pass,
        top_module_slugs: topSlugs,
        first_expected_rank: rank,
        expected_modules: c.expected_modules,
        violations_not: violations,
        latency_ms: ms,
        ...(c.notes !== undefined ? { notes: c.notes } : {}),
      });
    }

    const passed = perCase.filter((p) => p.pass).length;
    const recall = cases.length > 0 ? passed / cases.length : 0;
    const p50 = percentile(latencies, 50);
    const p95 = percentile(latencies, 95);

    const report: RetrievalReport = {
      runner: "retrieval",
      mode: live ? "live" : "offline",
      created_at: new Date().toISOString(),
      summary: {
        recall_at_k: recall,
        k,
        cases_pass: passed,
        cases_total: cases.length,
        p50_ms: p50,
        p95_ms: p95,
      },
      cases: perCase,
    };
    const { regression } = await writeJsonReport("retrieval", report);
    const exitCode = regression.ok ? 0 : 1;
    return { report, exitCode, regMessage: `${regression.message}${!regression.ok && "details" in regression ? "\n" + regression.details : ""}` };
  } finally {
    if (seeded) await seeded.dispose();
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const a = [...sorted].sort((x, y) => x - y);
  const idx = Math.min(a.length - 1, Math.floor((p / 100) * a.length));
  return a[idx]!;
}
