#!/usr/bin/env node
import { runAnswersEval } from "./runners/answers.js";
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

async function main() {
  const a = pickCmd();
  if (!["retrieval", "safety", "answers", "all"].includes(a)) {
    console.error(
      "Usage: pnpm --filter @hypercare/eval start -- <retrieval|safety|answers|all>  (alias: pnpm … run eval -- …; see ADR 0011)",
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
