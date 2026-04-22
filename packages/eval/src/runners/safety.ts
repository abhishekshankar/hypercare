import { readFile } from "node:fs/promises";

import { createDbClient } from "@hypercare/db";
import { classify, buildDefaultDeps, type SafetyResult } from "@hypercare/safety";

import { goldenPath } from "../paths.js";
import { writeJsonReport } from "../report.js";
import { parseSafetyGolden } from "../validate-golden.js";
import { seedEvalUser, type SeededEvalUser } from "../live/seed-user.js";
import type {
  ConfusionEntry,
  SafetyGoldenCase,
  SafetyCaseReport,
  SafetyReport,
  SafetyReportSummary,
} from "../types.js";

const live = process.env.EVAL_LIVE === "1";

function key(a: string, b: string): string {
  return `${a}→${b}`;
}

function categoryPass(
  c: SafetyGoldenCase,
  r: SafetyResult,
): { pass: boolean; passT: boolean; passC: boolean | "n/a" } {
  if (!c.expected_triaged) {
    return { pass: r.triaged === false, passT: r.triaged === false, passC: "n/a" };
  }
  if (r.triaged !== true) {
    return { pass: false, passT: false, passC: "n/a" };
  }
  if (!c.expected_category) return { pass: true, passT: true, passC: "n/a" };
  const ok = r.category === c.expected_category;
  return { pass: ok, passT: true, passC: ok };
}

export async function runSafetyEval(): Promise<{
  report: SafetyReport;
  exitCode: number;
  regMessage: string;
}> {
  const raw = await readFile(goldenPath("safety.json"), "utf8");
  const cases = parseSafetyGolden(JSON.parse(raw)) as SafetyGoldenCase[];
  const perCase: SafetyCaseReport[] = [];
  const latencies: number[] = [];
  const dbUrl = process.env.DATABASE_URL;
  const offlineDeps = { persist: async () => {}, disableLlm: true };
  const liveDeps =
    live && dbUrl
      ? buildDefaultDeps({
          db: createDbClient(dbUrl),
          warn: (m, c) => console.warn(m, c ?? {}),
        })
      : null;
  if (live && !dbUrl) throw new Error("EVAL_LIVE=1 requires DATABASE_URL");

  // Seed a real users.id for safety_flags FK / uuid type. Tear down on any exit.
  let seeded: SeededEvalUser | null = null;
  if (live && dbUrl) {
    seeded = await seedEvalUser(dbUrl, "safety");
  }
  const userId = seeded?.userId ?? "00000000-0000-0000-0000-000000000000";

  try {
    const confusion: Record<string, number> = {};

    for (const c of cases) {
      const t0 = Date.now();
      const deps = liveDeps ?? offlineDeps;
      const r = await classify({ userId, text: c.text }, deps);
      const ms = Date.now() - t0;
      latencies.push(ms);
      const cp = categoryPass(c, r);
      const sub: SafetyCaseReport = {
        id: c.id,
        pass: (cp.passT && (cp.passC === "n/a" || cp.passC === true)) === true,
        pass_triage: cp.passT,
        pass_category: cp.passC,
        expected_triaged: c.expected_triaged,
        actual_triaged: r.triaged,
        ...(c.expected_category !== undefined ? { expected_category: c.expected_category } : {}),
        ...(r.triaged
          ? {
              actual_category: r.category,
            }
          : {}),
        latency_ms: ms,
        ...(c.notes !== undefined ? { notes: c.notes } : {}),
      };
      if (c.expected_triaged && c.expected_category && r.triaged === true) {
        const k2 = key(c.expected_category, r.category);
        confusion[k2] = (confusion[k2] ?? 0) + 1;
      }
      perCase.push(sub);
    }

    let tp = 0;
    let fp = 0;
    let fn = 0;
    let tn = 0;
    for (let i = 0; i < cases.length; i++) {
      const c = cases[i]!;
      const a = c.expected_triaged;
      const p = perCase[i]!.actual_triaged;
      if (a && p) tp++;
      else if (!a && p) fp++;
      else if (a && !p) fn++;
      else if (!a && !p) tn++;
    }
    const prec = tp + fp > 0 ? tp / (tp + fp) : 0;
    const rec = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = prec + rec > 0 ? (2 * prec * rec) / (prec + rec) : 0;

    let categoryHits = 0;
    let categoryTotal = 0;
    for (const c of cases) {
      if (c.expected_triaged && c.expected_category) {
        categoryTotal += 1;
        const p = perCase.find((r) => r.id === c.id);
        if (p && p.pass_category === true) categoryHits += 1;
      }
    }

    const p50 = percentile(latencies, 50);
    const p95 = percentile(latencies, 95);

    const category_confusion: ConfusionEntry[] = Object.entries(confusion).map(([k, count]) => {
      const [expected, predicted] = k.split("→");
      return {
        expected: expected!,
        predicted: predicted!,
        count,
      } as ConfusionEntry;
    });

    const summary: SafetyReportSummary = {
      triage_precision: prec,
      triage_recall: rec,
      triage_f1: f1,
      tp,
      fp,
      fn,
      tn,
      p50_ms: p50,
      p95_ms: p95,
      category_hits: categoryHits,
      category_total: categoryTotal,
    };

    const report: SafetyReport = {
      runner: "safety",
      mode: live ? "live" : "offline",
      created_at: new Date().toISOString(),
      summary,
      category_confusion,
      cases: perCase,
    };
    const { regression } = await writeJsonReport("safety", report);
    return {
      report,
      exitCode: regression.ok ? 0 : 1,
      regMessage: `${regression.message}${!regression.ok && "details" in regression ? "\n" + regression.details : ""}`,
    };
  } finally {
    if (seeded) await seeded.dispose();
  }
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const a = [...arr].sort((x, y) => x - y);
  const idx = Math.min(a.length - 1, Math.floor((p / 100) * a.length));
  return a[idx]!;
}
