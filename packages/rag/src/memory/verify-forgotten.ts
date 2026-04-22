/**
 * Soft guard: summaries must not re-introduce facts the caregiver asked to forget.
 * Case-insensitive substring match (TASK-033).
 */
export function verifyMemorySummaryForgottenContent(
  summary: string,
  forgotten: readonly string[],
): { ok: true } | { ok: false; matched: string } {
  const lower = summary.toLowerCase();
  for (const f of forgotten) {
    const t = f.trim();
    if (t.length === 0) continue;
    if (lower.includes(t.toLowerCase())) {
      return { ok: false, matched: t };
    }
  }
  return { ok: true };
}
