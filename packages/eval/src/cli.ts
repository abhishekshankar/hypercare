#!/usr/bin/env node
import { runAnswersEval } from "./runners/answers.js";
import { runRedteamEval, runRedteamExport } from "./runners/redteam.js";
import { runRetrievalEval } from "./runners/retrieval.js";
import { runSafetyEval } from "./runners/safety.js";

function printSummary(
  name: string,
  reg: string,
  summary: Record<string, unknown>,
) {
  console.log(`\n--- ${name} ---`);
  console.log(reg);
  console.log(JSON.stringify(summary, null, 2));
}

function pickCmd(): string {
  const a = process.argv.slice(2).filter((x) => x !== "--");
  return a[0] ?? "all";
}

function hasFlag(name: string): boolean {
  const a = process.argv.slice(2);
  return a.includes(name);
}

function argAfter(flag: string): string | undefined {
  const a = process.argv.slice(2);
  const i = a.indexOf(flag);
  if (i === -1) return undefined;
  return a[i + 1];
}

async function main() {
  const a = pickCmd();
  if (a === "redteam:export") {
    const fmt = argAfter("--format") ?? "external-review";
    if (fmt !== "external-review") {
      console.error("Usage: … redteam:export --format external-review");
      process.exit(2);
    }
    await runRedteamExport({ format: "external-review" });
    process.exit(0);
  }
  if (a === "redteam") {
    const doubleRun = hasFlag("--double-run");
    const fixture = argAfter("--fixture");
    const r = await runRedteamEval({
      offline: hasFlag("--offline"),
      doubleRun,
      ...(fixture !== undefined ? { fixture } : {}),
    });
    console.log(r.message);
    console.log(
      JSON.stringify(
        { pass_rate: r.report.summary.pass_rate, by_bucket: r.report.summary.by_bucket, gate: r.report.summary.gate },
        null,
        2,
      ),
    );
    process.exit(r.exitCode);
  }
  if (!["retrieval", "safety", "answers", "all"].includes(a)) {
    console.error(
      "Usage: pnpm --filter @hypercare/eval start -- <retrieval|safety|answers|all|redteam|redteam:export>  (alias: pnpm … run eval -- …; see ADR 0011 / 0016)",
    );
    process.exit(2);
  }
  if (a === "all") {
    const r0 = await runRetrievalEval();
    printSummary("retrieval", r0.regMessage, r0.report.summary as unknown as Record<string, unknown>);
    const r1 = await runSafetyEval();
    printSummary("safety", r1.regMessage, r1.report.summary as unknown as Record<string, unknown>);
    const r2 = await runAnswersEval();
    printSummary("answers", r2.regMessage, r2.report.summary as unknown as Record<string, unknown>);
    const code = Math.max(r0.exitCode, r1.exitCode, r2.exitCode);
    process.exit(code);
  }
  if (a === "retrieval") {
    const r = await runRetrievalEval();
    printSummary("retrieval", r.regMessage, r.report.summary as unknown as Record<string, unknown>);
    process.exit(r.exitCode);
  }
  if (a === "safety") {
    const r = await runSafetyEval();
    printSummary("safety", r.regMessage, r.report.summary as unknown as Record<string, unknown>);
    process.exit(r.exitCode);
  }
  const r = await runAnswersEval();
  printSummary("answers", r.regMessage, r.report.summary as unknown as Record<string, unknown>);
  process.exit(r.exitCode);
}

void main();
