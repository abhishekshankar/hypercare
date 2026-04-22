import { readFile } from "node:fs/promises";

import { buildDefaultDeps, runPipeline, type AnswerResult, type Deps, type RefusalReason } from "@hypercare/rag";

import { answerModelIdFromEnv } from "../config.js";
import { goldenPath } from "../paths.js";
import { writeJsonReport } from "../report.js";
import type {
  AnswerCaseReport,
  AnswerGoldenCase,
  AnswersReport,
  AnswersReportSummary,
  MismatchKind,
  RefusalReasonCounts,
} from "../types.js";
import { countRefusalKind, refusalCodeOf } from "../types.js";
import { buildAnswerOfflineDeps } from "../fixtures/answer-offline.js";
import { parseAnswersGolden } from "../validate-golden.js";
import { assertModulesPresent } from "../live/preflight.js";
import { seedEvalUser, type SeededEvalUser } from "../live/seed-user.js";

const live = process.env.EVAL_LIVE === "1";

function mismatchKind(
  c: AnswerGoldenCase,
  r: AnswerResult,
): { kind: MismatchKind; pass: boolean } {
  if (c.expected_kind === "answered") {
    if (r.kind !== "answered") {
      return {
        kind: r.kind === "refused" && refusalCodeOf(r.reason) === "safety_triaged" ? "safety_triage" : "kind_mismatch",
        pass: false,
      };
    }
    const mods = c.expected_cited_modules ?? [];
    const cited = r.citations.map((x) => x.moduleSlug);
    const hit = mods.some((m) => cited.includes(m));
    if (!hit) return { kind: "citation_mismatch", pass: false };
    return { kind: "ok", pass: true };
  }
  // expected refused
  if (r.kind === "answered") {
    return { kind: "kind_mismatch", pass: false };
  }
  const code = refusalCodeOf(r.reason);
  if (c.expected_refusal_code && code !== c.expected_refusal_code) {
    return { kind: "refusal_code_mismatch", pass: false };
  }
  return { kind: "ok", pass: true };
}

function verificationRefused(
  c: AnswerGoldenCase,
  r: AnswerResult,
): boolean {
  if (c.expected_kind !== "answered") return false;
  if (r.kind !== "refused") return false;
  return r.reason.code === "uncitable_response";
}

export async function runAnswersEval(): Promise<{
  report: AnswersReport;
  exitCode: number;
  regMessage: string;
}> {
  const raw = await readFile(goldenPath("answers.json"), "utf8");
  const cases = parseAnswersGolden(JSON.parse(raw)) as AnswerGoldenCase[];
  const perCase: AnswerCaseReport[] = [];
  const latencies: number[] = [];
  const dbUrl = process.env.DATABASE_URL;
  if (live && !dbUrl) throw new Error("EVAL_LIVE=1 requires DATABASE_URL");
  if (live && dbUrl) await assertModulesPresent(dbUrl);
  const base: Deps | null = live && dbUrl ? buildDefaultDeps({ databaseUrl: dbUrl }) : null;

  let inTok = 0;
  let outTok = 0;
  const modelId = answerModelIdFromEnv();

  // Seed a real users.id so layer 1.5 (loadStageForUser) and persist FKs work.
  // EVAL_USER_ID overrides the seed entirely for callers who want a specific
  // pre-existing user (e.g. their own care_profile) — no teardown in that case.
  const overrideUserId = live ? process.env.EVAL_USER_ID?.trim() : undefined;
  let seeded: SeededEvalUser | null = null;
  if (live && dbUrl && !overrideUserId) {
    seeded = await seedEvalUser(dbUrl, "answers");
  }

  try {
  for (const c of cases) {
    const t0 = Date.now();
    const userId = overrideUserId || seeded?.userId || `eval-answers:${c.id}`;
    const deps: Deps =
      live && base ? { ...base, safety: { ...base.safety, warn: (m, x) => console.warn(m, x ?? {}) } } : (buildAnswerOfflineDeps(c, userId) as Deps);
    const r = await runPipeline({ question: c.question, userId }, deps);
    const ms = Date.now() - t0;
    latencies.push(ms);
    const mm = mismatchKind(c, r);
    const cited =
      r.kind === "answered" ? r.citations.map((x) => x.moduleSlug) : [];
    let inT: number | null = null;
    let outT: number | null = null;
    if (live) {
      // We don't have a hook; leave null in live. Offline mocks could attach — skip.
      inT = null;
      outT = null;
    } else {
      inT = 100;
      outT = 30;
    }
    inTok += inT ?? 0;
    outTok += outT ?? 0;
    perCase.push({
      id: c.id,
      pass: mm.pass,
      mismatch: mm.kind,
      expected_kind: c.expected_kind,
      actual_kind: r.kind,
      ...(c.expected_cited_modules !== undefined
        ? { expected_cited_modules: c.expected_cited_modules }
        : {}),
      cited_module_slugs: cited,
      reason_code: r.kind === "refused" ? (r.reason.code as AnswerCaseReport["reason_code"]) : null,
      verification_refused: verificationRefused(c, r),
      latency_ms: ms,
      input_tokens: inT,
      output_tokens: outT,
      model_id: modelId,
      ...(c.notes !== undefined ? { notes: c.notes } : {}),
    });
  }

  const kindMatch = perCase.filter((p) => p.pass).length;

  const kindOnly = perCase.filter((p) => {
    const c = cases.find((x) => x.id === p.id);
    if (!c) return false;
    return c.expected_kind === p.actual_kind;
  }).length;

  const answeredExpected = cases.filter((c) => c.expected_kind === "answered");
  const answeredAndExpected = perCase.filter((p) => {
    const c = cases.find((x) => x.id === p.id);
    return c?.expected_kind === "answered" && p.actual_kind === "answered";
  });
  const citedOk = answeredAndExpected.filter((p) => {
    const c = cases.find((x) => x.id === p.id);
    if (!c) return false;
    return (c.expected_cited_modules ?? []).some((m) => p.cited_module_slugs.includes(m));
  });
  const citedRate = answeredAndExpected.length ? citedOk.length / answeredAndExpected.length : 1;

  const verifRef = answeredExpected.filter((c) => {
    const p = perCase.find((x) => x.id === c.id);
    return p?.verification_refused;
  });

  const answerHitRate = cases.length > 0 ? kindMatch / cases.length : 0;
  const kindAcc = cases.length > 0 ? kindOnly / cases.length : 0;

  const breakdown: Record<string, number> = {};
  for (const p of perCase) {
    if (!p.pass) {
      breakdown[p.mismatch] = (breakdown[p.mismatch] ?? 0) + 1;
    }
  }

  const reasonsFull: Array<RefusalReason["code"] | "answered" | null> = perCase.map(
    (p) => (p.actual_kind === "answered" ? "answered" : p.reason_code),
  );
  const refusalReasons: RefusalReasonCounts = countRefusalKind(reasonsFull);

  const p50 = percentile(latencies, 50);
  const p95 = percentile(latencies, 95);

  const summary: AnswersReportSummary = {
    kind_accuracy: kindAcc,
    cited_module_hit_rate: citedRate,
    answer_hit_rate: answerHitRate,
    verification_refusal_rate: answeredExpected.length
      ? verifRef.length / answeredExpected.length
      : 0,
    model_id: modelId,
    total_input_tokens: inTok,
    total_output_tokens: outTok,
    p50_ms: p50,
    p95_ms: p95,
    mismatch_breakdown: breakdown,
    refusal_reasons: refusalReasons,
  };

  const report: AnswersReport = {
    runner: "answers",
    mode: live ? "live" : "offline",
    created_at: new Date().toISOString(),
    summary,
    cases: perCase,
  };
  const { regression } = await writeJsonReport("answers", report);
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
