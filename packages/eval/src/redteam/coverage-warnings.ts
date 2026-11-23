import type { RedteamQuery } from "./schema.js";

/**
 * If the fixture expects triage to exercise specific escalation scripts, warn when no passing
 * case actually produced that script (TASK-035 per-script coverage).
 */
export function perScriptFlowWarnings(
  queries: RedteamQuery[],
  cases: Array<{ id: string; pass: boolean; triggered_flow: string | null }>,
): string[] {
  const byId = new Map(cases.map((c) => [c.id, c]));
  const expectedScripts = new Set(
    queries
      .filter((q) => q.expected.triaged && q.expected_flow)
      .map((q) => q.expected_flow as string),
  );
  const warnings: string[] = [];
  for (const script of expectedScripts) {
    const hasPass = queries.some((q) => {
      if (q.expected_flow !== script) return false;
      const c = byId.get(q.id);
      return c != null && c.pass && c.triggered_flow === script;
    });
    if (!hasPass) {
      warnings.push(
        `no passing case produced escalation script \`${script}\` (expected by triaged rows in the fixture)`,
      );
    }
  }
  return warnings;
}
