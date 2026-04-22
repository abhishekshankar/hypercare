import { createDbClient, safetyFtShadowDecisions } from "@hypercare/db";
import { desc, gte } from "drizzle-orm";

import { serverEnv } from "@/lib/env.server";

export const dynamic = "force-dynamic";

function pct(n: number, d: number): string {
  return d > 0 ? ((n / d) * 100).toFixed(1) : "—";
}

function sortedCopy(nums: number[]): number[] {
  return [...nums].sort((a, b) => a - b);
}

function percentile(arr: number[], p: number): number | null {
  if (arr.length === 0) return null;
  const s = sortedCopy(arr);
  const idx = Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1);
  return s[Math.max(0, idx)]!;
}

export default async function InternalSafetyShadowPage() {
  const db = createDbClient(serverEnv.DATABASE_URL);
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const rows = await db
    .select()
    .from(safetyFtShadowDecisions)
    .where(gte(safetyFtShadowDecisions.observedAt, weekAgo))
    .orderBy(desc(safetyFtShadowDecisions.observedAt))
    .limit(8000);

  const total = rows.length;
  const agree = rows.filter(
    (r) => JSON.stringify(r.zeroShotVerdict) === JSON.stringify(r.fineTunedVerdict),
  ).length;
  const zsLat = rows.map((r) => r.zeroShotLatencyMs);
  const ftLat = rows.map((r) => r.fineTunedLatencyMs);
  const disagreeSamples = rows
    .filter((r) => JSON.stringify(r.zeroShotVerdict) !== JSON.stringify(r.fineTunedVerdict))
    .slice(0, 18);

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold">Safety fine-tune shadow</h1>
      <p className="mb-4 text-xs text-zinc-600">
        Rolling 7-day view of `safety_ft_shadow_decisions` (TASK-039). Verdicts are JSON only — no message
        text.
      </p>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded border border-zinc-200 bg-white p-3 text-sm">
          <p className="text-xs text-zinc-500">Rows (7d, capped)</p>
          <p className="text-xl font-semibold tabular-nums">{total}</p>
        </div>
        <div className="rounded border border-zinc-200 bg-white p-3 text-sm">
          <p className="text-xs text-zinc-500">Agreement rate</p>
          <p className="text-xl font-semibold tabular-nums">{pct(agree, total)}%</p>
        </div>
        <div className="rounded border border-zinc-200 bg-white p-3 text-sm">
          <p className="text-xs text-zinc-500">Zero-shot P50 / P95 ms</p>
          <p className="text-xl font-semibold tabular-nums">
            {percentile(zsLat, 50) ?? "—"} / {percentile(zsLat, 95) ?? "—"}
          </p>
        </div>
        <div className="rounded border border-zinc-200 bg-white p-3 text-sm">
          <p className="text-xs text-zinc-500">Fine-tuned P50 / P95 ms</p>
          <p className="text-xl font-semibold tabular-nums">
            {percentile(ftLat, 50) ?? "—"} / {percentile(ftLat, 95) ?? "—"}
          </p>
        </div>
      </div>
      <h2 className="mb-2 text-sm font-semibold text-zinc-800">Recent disagreements</h2>
      {disagreeSamples.length === 0 ? (
        <p className="text-sm text-zinc-500">No disagreements in window (or no rows yet).</p>
      ) : (
        <ul className="space-y-2 text-xs text-zinc-800">
          {disagreeSamples.map((r) => (
            <li className="rounded border border-zinc-200 bg-white p-2 font-mono" key={r.id}>
              <span className="text-zinc-500">{r.observedAt.toISOString()}</span>
              <div className="mt-1 grid gap-1 sm:grid-cols-2">
                <div>
                  <span className="text-zinc-500">zero_shot</span> {JSON.stringify(r.zeroShotVerdict)}
                </div>
                <div>
                  <span className="text-zinc-500">fine_tuned</span> {JSON.stringify(r.fineTunedVerdict)}
                </div>
              </div>
              <p className="mt-1 text-zinc-500">
                latency ms — zs: {r.zeroShotLatencyMs}, ft: {r.fineTunedLatencyMs}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
