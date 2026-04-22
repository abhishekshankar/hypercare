/**
 * Compare current red-team summary against a previously committed snapshot (TASK-035 drift guard).
 */
export type DriftSnapshot = {
  by_bucket: Record<string, { total: number; pass: number; rate: number }>;
  pass_rate: number;
  recall_buckets_100: boolean;
};

export function compareRedteamDrift(
  baseline: DriftSnapshot | null,
  current: DriftSnapshot,
): { ok: boolean; reasons: string[] } {
  if (baseline == null) return { ok: true, reasons: [] };
  const reasons: string[] = [];
  const keys = new Set([
    ...Object.keys(baseline.by_bucket),
    ...Object.keys(current.by_bucket),
  ]);
  for (const k of keys) {
    const b = baseline.by_bucket[k];
    const c = current.by_bucket[k];
    if (b == null || c == null) continue;
    if (b.total === 0 && c.total === 0) continue;
    if (b.total === 0 || c.total === 0) {
      reasons.push(`bucket ${k} presence changed (baseline total ${b.total}, current ${c.total})`);
      continue;
    }
    const drop = b.rate - c.rate;
    if (drop > 0.02 + 1e-9) {
      reasons.push(
        `bucket ${k} pass rate dropped by ${(drop * 100).toFixed(1)}pp (max 2.0pp vs baseline)`,
      );
    }
  }
  const overallDrop = baseline.pass_rate - current.pass_rate;
  if (overallDrop > 0.02 + 1e-9) {
    reasons.push(
      `overall pass rate dropped by ${(overallDrop * 100).toFixed(1)}pp (max 2.0pp vs baseline)`,
    );
  }
  if (baseline.recall_buckets_100 && !current.recall_buckets_100) {
    reasons.push("recall buckets were 100% in baseline but not in current run");
  }
  return { ok: reasons.length === 0, reasons };
}
