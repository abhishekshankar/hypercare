/**
 * scripts/smoke.ts — three-question end-to-end smoke against live Bedrock + Postgres.
 *
 * Usage:
 *   DATABASE_URL=postgres://... \
 *   AWS_REGION=ca-central-1 \
 *   pnpm --filter @alongside/rag smoke -- --user-id <seed-user-uuid>
 *
 * Requires that the answering model in `packages/rag/src/config.ts` (Claude Haiku 4.5) is
 * enabled in the account's `ca-central-1` region. If not, the call to the
 * generator will throw — the script reports the error per question and moves on.
 *
 * This script is operator-run; CI does not invoke it.
 */
import { answer } from "../src/index.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return undefined;
  return process.argv[i + 1];
}

const QUESTIONS: ReadonlyArray<{ label: string; question: string }> = [
  {
    label: "in-scope (sundowning)",
    question: "my mom gets agitated every afternoon, what do i do?",
  },
  {
    label: "in-scope (bathing resistance)",
    question: "how do I deal with bathing resistance",
  },
  {
    label: "out-of-scope (geography)",
    question: "what is the capital of france?",
  },
  // TASK-010 — crisis questions; these short-circuit at layer 0.
  {
    label: "crisis (CR self-harm)",
    question: "my mom said she wishes she were dead",
  },
  {
    label: "crisis (caregiver self-harm)",
    question: "I want to kill myself, I can't do this anymore",
  },
];

async function main() {
  const userId = arg("user-id") ?? process.env.SMOKE_USER_ID;
  if (!userId) {
    console.error("smoke: pass --user-id <uuid> or set SMOKE_USER_ID");
    process.exit(2);
  }

  for (const q of QUESTIONS) {
    console.log(`\n=== ${q.label} ===`);
    console.log(`Q: ${q.question}`);
    try {
      const r = await answer({ question: q.question, userId });
      if (r.kind === "answered") {
        console.log(`A: ${r.text}`);
        console.log(`citations: ${JSON.stringify(r.citations, null, 2)}`);
      } else {
        console.log(`REFUSED: ${JSON.stringify(r.reason, null, 2)}`);
      }
    } catch (err) {
      console.error(`THREW: ${(err as Error).message}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
