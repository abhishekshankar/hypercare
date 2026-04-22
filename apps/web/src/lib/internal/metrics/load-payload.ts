import "server-only";

import { estimateBedrockCostUsd } from "./bedrock-pricing";
import { runSqlFile } from "./run-sql";
import type { MetricsWindow } from "./window";
import { windowBounds } from "./window";

export type MetricsPayload = Awaited<ReturnType<typeof loadMetricsPayload>>;

export async function loadMetricsPayload(w: MetricsWindow) {
  const { start, end, label: windowLabel } = windowBounds(w);
  const t0 = start ?? new Date(0);
  const t1 = end;

  const [help, behavior, w2, w4, w8, flags, safetyEx, content, refWindow, refClusters, tier1, retZero, p50, costDay, spark] =
    await Promise.all([
      runSqlFile<{
        rated_helpful: number;
        rated_total: number;
        shown_rating_ui_total: number;
      }>("helpfulness_rate", [t0, t1]),
      runSqlFile<{ tried_something_true: number; weekly_checkin_answered_total: number }>(
        "behavior_change_rate",
        [t0, t1],
      ),
      runSqlFile<{ cohort_size: number; returned: number }>("return_cohort", [2]),
      runSqlFile<{ cohort_size: number; returned: number }>("return_cohort", [4]),
      runSqlFile<{ cohort_size: number; returned: number }>("return_cohort", [8]),
      runSqlFile<{ category: string; count: string | bigint; repeat_count_sum: string | bigint }>(
        "flag_counts_by_category",
        [],
      ),
      runSqlFile<{ suppression_active: string | bigint; modules_nearing_review: string | bigint }>(
        "safety_extras",
        [],
      ),
      runSqlFile<{ published_count: string | bigint; last_publish: Date | null }>("content_library", []),
      runSqlFile<{ refusals: string | bigint }>("refusals_in_window", [t0, t1]),
      runSqlFile<{ cluster_key: string; count: string | bigint }>("refusals_by_cluster", [t0, t1]),
      runSqlFile<{ tier1_answers: number; total_answered: number }>("retrieval_tier1", [t0, t1]),
      runSqlFile<{ retrieval_zero: string | bigint }>("retrieval_zero_count", [t0, t1]),
      runSqlFile<{ p50_ms: number }>("median_latency", [t0, t1]),
      runSqlFile<{ input_sum: string | bigint; output_sum: string | bigint }>("cost_last_day", []),
      runSqlFile<{ week: string; up_n: string | number; denom: string | number }>("helpfulness_by_week", []),
    ]);

  const h = help[0];
  const helpRate =
    h != null && Number(h.rated_total) > 0 ? (Number(h.rated_helpful) / Number(h.rated_total)) * 100 : null;
  const b = behavior[0];
  const behaviorRate =
    b != null && Number(b.weekly_checkin_answered_total) > 0
      ? (Number(b.tried_something_true) / Number(b.weekly_checkin_answered_total)) * 100
      : null;

  const toPct = (row: { cohort_size: number; returned: number } | undefined) => {
    if (row == null || Number(row.cohort_size) === 0) {
      return { pct: null, n: 0 };
    }
    return { pct: (Number(row.returned) / Number(row.cohort_size)) * 100, n: Number(row.cohort_size) };
  };
  const w2d = toPct(w2[0]);
  const w4d = toPct(w4[0]);
  const w8d = toPct(w8[0]);

  const se = safetyEx[0];
  const c = costDay[0];
  const inTok = c != null ? Number(c.input_sum) : 0;
  const outTok = c != null ? Number(c.output_sum) : 0;
  const costUsd = estimateBedrockCostUsd(inTok, outTok);

  const t1Row = tier1[0];
  const tier1Share =
    t1Row != null && Number(t1Row.total_answered) > 0
      ? (Number(t1Row.tier1_answers) / Number(t1Row.total_answered)) * 100
      : null;

  return {
    window: w,
    windowLabel,
    help: {
      helpRate,
      helpfulCount: h != null ? Number(h.rated_helpful) : 0,
      ratedTotal: h != null ? Number(h.rated_total) : 0,
      shownUi: h != null ? Number(h.shown_rating_ui_total) : 0,
    },
    behavior: { rate: behaviorRate },
    returns: { w2: w2d, w4: w4d, w8: w8d },
    flags: flags.map((f) => ({
      category: f.category,
      count: Number(f.count),
      repeatSum: Number(f.repeat_count_sum),
    })),
    safety: {
      suppressionActive: se != null ? Number(se.suppression_active) : 0,
      modulesNearingReview: se != null ? Number(se.modules_nearing_review) : 0,
    },
    content: {
      published: content[0] != null ? Number(content[0].published_count) : 0,
      lastPublish: content[0]?.last_publish ?? null,
      refusalsInWindow: refWindow[0] != null ? Number(refWindow[0].refusals) : 0,
      refusalClusters: refClusters.map((r) => ({ key: r.cluster_key, count: Number(r.count) })),
    },
    retrieval: {
      tier1Share,
      zeroCount: retZero[0] != null ? Number(retZero[0].retrieval_zero) : 0,
      p50ms: p50[0] != null ? p50[0].p50_ms : 0,
    },
    cost: { usd: costUsd, inputTokens: inTok, outputTokens: outTok },
    spark: spark.map((s) => {
      const den = Number(s.denom);
      const u = Number(s.up_n);
      return {
        week: String(s.week),
        rate: den > 0 ? (u / den) * 100 : null,
      };
    }),
  };
}
