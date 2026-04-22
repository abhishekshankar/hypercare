import "server-only";

import { estimateBedrockCostUsd } from "./bedrock-pricing";
import { loadRedteamSpark } from "./redteam-history";
import { runSqlFile } from "./run-sql";
import type { MetricsWindow } from "./window";
import { windowBounds } from "./window";

export type MetricsPayload = Awaited<ReturnType<typeof loadMetricsPayload>>;

export async function loadMetricsPayload(w: MetricsWindow) {
  const { start, end, label: windowLabel } = windowBounds(w);
  const t0 = start ?? new Date(0);
  const t1 = end;

  const [help, behavior, w2, w4, w8, flags, safetyEx, content, refWindow, refClusters, tier1, retZero, p50, costDay, spark, feedback, redteamSpark, forgetTaps, streamLat, lessonStream, librarySearch] =
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
      runSqlFile<{
        new_this_week: number;
        stale_new_over_72h: number;
        pct_triaged_within_72h: number | null;
        pct_thumbs_down_to_content_fix: number | null;
        median_triage_hours: number | null;
      }>("feedback_loop_health", [t0, t1]),
      loadRedteamSpark(),
      runSqlFile<{ forget_taps: number }>("transparency_forget_taps", [t0, t1]),
      runSqlFile<{
        p50_first_chunk_ms: number;
        p95_first_chunk_ms: number;
        stream_answer_count: string | bigint;
        refusal_after_stream_started: string | bigint;
      }>("streaming_latency", [t0, t1]),
      runSqlFile<{
        p50_first_card_ms: number;
        p95_first_card_ms: number;
        p50_done_ms: number;
        p95_done_ms: number;
        n: string | bigint;
      }>("lesson_stream_latency", [t0, t1]),
      runSqlFile<{
        p50_first_result_ms: number;
        p95_first_result_ms: number;
        p50_done_ms: number;
        p95_done_ms: number;
        streams_with_first_result: string | bigint;
        stream_count: string | bigint;
      }>("library_search_latency", [t0, t1]),
    ]);

  let routingAb: Array<{
    cohort: string;
    routing_decisions_n: string | bigint;
    helpful_n: string | bigint;
    rated_n: string | bigint;
    helpful_pct: string | number | null;
    avg_latency_ms: number | null;
    sum_cost_estimate_usd: number | null;
  }> = [];
  try {
    routingAb = await runSqlFile("routing_ab_comparison", [t0, t1]);
  } catch {
    routingAb = [];
  }

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

  const fb = feedback[0];
  const t1Row = tier1[0];
  const tier1Share =
    t1Row != null && Number(t1Row.total_answered) > 0
      ? (Number(t1Row.tier1_answers) / Number(t1Row.total_answered)) * 100
      : null;

  return {
    window: w,
    windowLabel,
    redteamSpark,
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
    feedback: {
      newThisWeek: fb != null ? Number(fb.new_this_week) : 0,
      staleNewOver72h: fb != null ? Number(fb.stale_new_over_72h) : 0,
      pctTriagedWithin72h: fb != null && fb.pct_triaged_within_72h != null ? Number(fb.pct_triaged_within_72h) * 100 : null,
      pctThumbsToContentFix:
        fb != null && fb.pct_thumbs_down_to_content_fix != null ? Number(fb.pct_thumbs_down_to_content_fix) * 100 : null,
      medianTriageHours: fb != null && fb.median_triage_hours != null ? Number(fb.median_triage_hours) : null,
    },
    transparency: {
      forgetTapsInWindow: forgetTaps[0] != null ? Number(forgetTaps[0].forget_taps) : 0,
    },
    streaming: {
      p50FirstChunkMs: streamLat[0] != null ? Number(streamLat[0].p50_first_chunk_ms) : 0,
      p95FirstChunkMs: streamLat[0] != null ? Number(streamLat[0].p95_first_chunk_ms) : 0,
      answerCount: streamLat[0] != null ? Number(streamLat[0].stream_answer_count) : 0,
      refusalAfterStream: streamLat[0] != null ? Number(streamLat[0].refusal_after_stream_started) : 0,
    },
    lessonStream: {
      p50FirstCardMs: lessonStream[0] != null ? Number(lessonStream[0].p50_first_card_ms) : 0,
      p95FirstCardMs: lessonStream[0] != null ? Number(lessonStream[0].p95_first_card_ms) : 0,
      p50DoneMs: lessonStream[0] != null ? Number(lessonStream[0].p50_done_ms) : 0,
      p95DoneMs: lessonStream[0] != null ? Number(lessonStream[0].p95_done_ms) : 0,
      count: lessonStream[0] != null ? Number(lessonStream[0].n) : 0,
    },
    librarySearch: {
      p50FirstResultMs: librarySearch[0] != null ? Number(librarySearch[0].p50_first_result_ms) : 0,
      p95FirstResultMs: librarySearch[0] != null ? Number(librarySearch[0].p95_first_result_ms) : 0,
      p50DoneMs: librarySearch[0] != null ? Number(librarySearch[0].p50_done_ms) : 0,
      p95DoneMs: librarySearch[0] != null ? Number(librarySearch[0].p95_done_ms) : 0,
      count: librarySearch[0] != null ? Number(librarySearch[0].stream_count) : 0,
      withFirstResult: librarySearch[0] != null ? Number(librarySearch[0].streams_with_first_result) : 0,
    },
    routingAb: routingAb.map((r) => ({
      cohort: r.cohort,
      decisions: Number(r.routing_decisions_n),
      helpful: Number(r.helpful_n),
      rated: Number(r.rated_n),
      helpfulPct: r.helpful_pct != null ? Number(r.helpful_pct) : null,
      avgLatencyMs: r.avg_latency_ms,
      sumCostUsd: r.sum_cost_estimate_usd != null ? Number(r.sum_cost_estimate_usd) : 0,
    })),
  };
}
