import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { REGRESSION_PP_THRESHOLD } from "./config.js";
import { reportDirForRunner, reportLatestPath } from "./paths.js";
import type {
  AnswersReport,
  AnyReport,
  RetrievalReport,
  SafetyReport,
} from "./types.js";

const execFileAsync = promisify(execFile);

export function isoTimestampForFilename(d = new Date()): string {
  return d.toISOString().replace(/[:.]/g, "-");
}

async function readGitHeadLatest(
  runner: "retrieval" | "safety" | "answers",
): Promise<unknown | null> {
  const p = `packages/eval/reports/${runner}/latest.json`;
  try {
    const { stdout } = await execFileAsync("git", ["show", `HEAD:${p}`], {
      maxBuffer: 10 * 1024 * 1024,
    });
    return JSON.parse(stdout) as unknown;
  } catch {
    return null;
  }
}

function num(x: unknown): number | null {
  return typeof x === "number" && Number.isFinite(x) ? x : null;
}

export type RegressionResult =
  | { ok: true; message: string }
  | { ok: false; message: string; details: string };

export function checkRegression(
  runner: "retrieval" | "answers" | "safety",
  previous: unknown,
  current: AnyReport,
): RegressionResult {
  if (!previous) {
    return { ok: true, message: "No previous committed latest.json in HEAD (baseline). Regression check skipped." };
  }
  const prevO = previous as Record<string, unknown>;
  const prevS = (prevO.summary ?? {}) as Record<string, unknown>;
  const curS = (current as { summary: Record<string, unknown> }).summary;

  if (runner === "retrieval") {
    const a = num(prevS.recall_at_k);
    const b = num(curS.recall_at_k);
    if (a !== null && b !== null) {
      const drop = (a - b) * 100;
      if (drop > REGRESSION_PP_THRESHOLD) {
        return {
          ok: false,
          message: `Retrieval recall@k dropped by ${drop.toFixed(1)}pp vs HEAD (threshold ${String(REGRESSION_PP_THRESHOLD)}pp).`,
          details: formatCaseFlip(runner, previous, current),
        };
      }
    }
    return { ok: true, message: "Retrieval — within regression band vs HEAD (or not comparable). Nice and steady." };
  }
  if (runner === "safety") {
    const a = num(prevS.triage_f1);
    const b = num(curS.triage_f1);
    if (a !== null && b !== null) {
      const drop = (a - b) * 100;
      if (drop > REGRESSION_PP_THRESHOLD) {
        return {
          ok: false,
          message: `Safety triage F1 dropped by ${drop.toFixed(1)}pp vs HEAD (threshold ${String(REGRESSION_PP_THRESHOLD)}pp).`,
          details: formatCaseFlip(runner, previous, current),
        };
      }
    }
    return { ok: true, message: "Safety — within regression band vs HEAD. Nice and steady." };
  }
  // answers
  const aHit = num(prevS.answer_hit_rate);
  const bHit = num(curS.answer_hit_rate);
  if (aHit !== null && bHit !== null) {
    const drop = (aHit - bHit) * 100;
    if (drop > REGRESSION_PP_THRESHOLD) {
      return {
        ok: false,
        message: `Answer hit-rate dropped by ${drop.toFixed(1)}pp vs HEAD (threshold ${String(REGRESSION_PP_THRESHOLD)}pp).`,
        details: formatCaseFlip(runner, previous, current),
      };
    }
  }
  const aVer = num(prevS.verification_refusal_rate);
  const bVer = num(curS.verification_refusal_rate);
  if (aVer !== null && bVer !== null) {
    const rise = (bVer - aVer) * 100;
    if (rise > REGRESSION_PP_THRESHOLD) {
      return {
        ok: false,
        message: `Verification-refusal rate rose by ${rise.toFixed(1)}pp vs HEAD (threshold ${String(REGRESSION_PP_THRESHOLD)}pp).`,
        details: formatCaseFlip(runner, previous, current),
      };
    }
  }
  return { ok: true, message: "Answers — within regression band vs HEAD. Shipped a win on the golden set — celebrate the small things." };
}

function formatCaseFlip(
  runner: "retrieval" | "safety" | "answers",
  previous: unknown,
  current: AnyReport,
): string {
  const prevCases = (previous as { cases?: { id: string; pass?: boolean; pass_triage?: boolean }[] })
    .cases;
  const curCases = (current as { cases: { id: string; pass?: boolean; pass_triage?: boolean }[] })
    .cases;
  if (!prevCases || !curCases) return "Case-level diff: (unavailable — compare JSON manually).";
  const prevMap = new Map<string, boolean>();
  for (const c of prevCases) {
    const ok =
      runner === "safety" ? (c as { pass?: boolean }).pass === true : c.pass === true;
    prevMap.set(c.id, ok);
  }
  const flipped: string[] = [];
  for (const c of curCases) {
    const was = prevMap.get(c.id);
    const now =
      runner === "safety" ? (c as { pass?: boolean }).pass === true : c.pass === true;
    if (was === true && now === false) flipped.push(c.id);
  }
  if (flipped.length === 0) return "No prior pass→fail case ids detected (or missing ids). Check summary numbers.";
  return `Cases that were pass in HEAD and fail now: ${flipped.join(", ")}`;
}

export async function writeJsonReport(
  runner: "retrieval" | "safety" | "answers",
  report: AnyReport,
): Promise<{ outPath: string; regression: RegressionResult }> {
  const dir = reportDirForRunner(runner);
  await mkdir(dir, { recursive: true });
  const name = `${isoTimestampForFilename()}.json`;
  const outPath = `${dir}/${name}`;
  const body = `${JSON.stringify(report, null, 2)}\n`;
  await writeFile(outPath, body, "utf8");
  const latest = reportLatestPath(runner);
  await copyFile(outPath, latest);
  const prev = await readGitHeadLatest(runner);
  const reg = checkRegression(
    runner,
    prev,
    report,
  ) as RegressionResult;
  return { outPath, regression: reg };
}

export async function readLatestReport(
  runner: "retrieval" | "safety" | "answers",
): Promise<AnyReport | null> {
  const p = reportLatestPath(runner);
  try {
    const raw = await readFile(p, "utf8");
    return JSON.parse(raw) as AnyReport;
  } catch {
    return null;
  }
}

export { readGitHeadLatest };

// Typed exports for consumers
export type { RetrievalReport, SafetyReport, AnswersReport };
