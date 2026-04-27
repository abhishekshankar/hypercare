import "server-only";
import { answer as defaultAnswer } from "@alongside/rag";
import type { AnswerInput, AnswerResult } from "@alongside/rag";

import { isE2ETestRuntime } from "@/lib/env.test-runtime";

/**
 * Server-side adapter around `rag.answer()`.
 *
 * Routes import this instead of `@alongside/rag` directly for two reasons:
 *   1. **One mocking seam.** The Playwright E2E spec sets a process-level
 *      override via `/api/test/conversation-mock` so it can run end-to-end
 *      against the real DB without a live Bedrock account (TASK-011 acceptance:
 *      "Mock the RAG + safety layers at the module boundary for E2E").
 *   2. **One bundling boundary.** This file is `server-only`, so any
 *      accidental client import errors loudly. Bedrock + DB never reach the
 *      browser bundle.
 */

type AnswerFn = (input: AnswerInput) => Promise<AnswerResult>;

type GlobalWithOverride = typeof globalThis & {
  __HYPERCARE_RAG_OVERRIDE__?: AnswerFn;
};

function getOverride(): AnswerFn | undefined {
  if (!isE2ETestRuntime()) return undefined;
  return (globalThis as GlobalWithOverride).__HYPERCARE_RAG_OVERRIDE__;
}

/** True when E2E installed the process-wide RAG mock (TASK-031: force JSON path). */
export function hasActiveRagOverride(): boolean {
  return getOverride() !== undefined;
}

/** Public entry the route handlers call. Identical contract to `answer()`. */
export async function answerForUser(input: AnswerInput): Promise<AnswerResult> {
  const override = getOverride();
  if (override) return override(input);
  return defaultAnswer(input);
}

/**
 * Test-only: install a process-wide override. No-op outside `NODE_ENV=test`.
 * Returns a function that clears the override (idempotent).
 */
export function __setRagOverrideForTests(fn: AnswerFn | null): () => void {
  if (!isE2ETestRuntime()) {
    return () => {};
  }
  const g = globalThis as GlobalWithOverride;
  if (fn === null) {
    delete g.__HYPERCARE_RAG_OVERRIDE__;
    return () => {};
  }
  g.__HYPERCARE_RAG_OVERRIDE__ = fn;
  return () => {
    delete g.__HYPERCARE_RAG_OVERRIDE__;
  };
}
