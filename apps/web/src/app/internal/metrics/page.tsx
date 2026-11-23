import { HelpfulnessSparkline } from "./HelpfulnessSparkline";
import { SafetySparkline } from "./SafetySparkline";
import { SqlBlock } from "./SqlBlock";
import { WindowPicker } from "./WindowPicker";

import { loadMetricsPayload } from "@/lib/internal/metrics/load-payload";
import { parseWindow } from "@/lib/internal/metrics/window";

export const dynamic = "force-dynamic";

function pct(n: number | null, digits = 1): string {
  if (n == null || Number.isNaN(n)) {
    return "—";
  }
  return `${n.toFixed(digits)}%`;
}

function Row({
  title,
  hint,
  children,
  sqlName,
}: Readonly<{
  title: string;
  hint?: string;
  children: React.ReactNode;
  sqlName?: string;
}>) {
  return (
    <section className="mb-6 border-b border-zinc-200 pb-5">
      <h2 className="text-sm font-semibold text-zinc-800">{title}</h2>
      {hint != null && hint.length > 0 ? <p className="mt-1 text-xs text-zinc-600">{hint}</p> : null}
      <div className="mt-2">{children}</div>
      {sqlName != null ? (
        <details className="mt-2 text-xs text-zinc-600">
          <summary className="cursor-pointer">↓ see SQL</summary>
          <SqlBlock name={sqlName} />
        </details>
      ) : null}
    </section>
  );
}

export default async function InternalMetricsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ w?: string }>;
}>) {
  const { w: rawW } = await searchParams;
  const w = parseWindow(rawW);
  const p = await loadMetricsPayload(w);

  return (
    <div>
      <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold">Internal metrics</h1>
          <p className="text-xs text-zinc-600">Operator view · {p.windowLabel}</p>
        </div>
        <WindowPicker />
      </div>

      <Row
        title="North star — behavior change (weekly check-in)"
        hint="If below 50%, focus on making lessons and answers more actionable, not on growth."
        sqlName="behavior_change_rate"
      >
        <p className="text-3xl font-semibold tabular-nums">{pct(p.behavior.rate)}</p>
        <p className="text-xs text-zinc-500">% of check-ins in window (active users) with “tried something” = yes</p>
      </Row>

      <Row
        title="Helpfulness"
        hint="If below 60%, treat as content/retrieval quality, not as a growth problem (PRD §12)."
        sqlName="helpfulness_rate"
      >
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <p className="text-3xl font-semibold tabular-nums">{pct(p.help.helpRate)}</p>
            <p className="text-xs text-zinc-500">
              thumbs-up / rated · UI shown: {p.help.shownUi} · <span className="text-zinc-400">Target 70%</span>
            </p>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-zinc-500">8w</span>
            <HelpfulnessSparkline spark={p.spark} />
          </div>
        </div>
        <details className="mt-2 text-xs text-zinc-600">
          <summary className="cursor-pointer">↓ see SQL (spark by week)</summary>
          <SqlBlock name="helpfulness_by_week" />
        </details>
      </Row>

      <Row
        title="Feedback loop health (TASK-036)"
        hint="Triage quality for in-app feedback + thumbs-down queue."
        sqlName="feedback_loop_health"
      >
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          <li>
            <span className="text-zinc-500">New this window</span>
            <p className="text-xl font-medium tabular-nums">{p.feedback.newThisWeek}</p>
          </li>
          <li>
            <span className="text-zinc-500">Still “new” &gt; 72h (SLA)</span>
            <p className="text-xl font-medium tabular-nums text-amber-800">{p.feedback.staleNewOver72h}</p>
          </li>
          <li>
            <span className="text-zinc-500">% triaged within 72h of submit</span>
            <p className="text-xl font-medium tabular-nums">{pct(p.feedback.pctTriagedWithin72h)}</p>
          </li>
          <li>
            <span className="text-zinc-500">Thumbs-down → needs_content_fix</span>
            <p className="text-xl font-medium tabular-nums">{pct(p.feedback.pctThumbsToContentFix)}</p>
          </li>
          <li className="sm:col-span-2">
            <span className="text-zinc-500">Median hours to triage (window)</span>
            <p className="text-xl font-medium tabular-nums">
              {p.feedback.medianTriageHours != null ? p.feedback.medianTriageHours.toFixed(1) : "—"}h
            </p>
          </li>
        </ul>
        <p className="mt-1 text-xs text-zinc-500">
          <a className="text-violet-700 underline" href="/internal/feedback">
            ↓ open feedback queue
          </a>
        </p>
      </Row>

      <Row title="Return — cohort (PRD W2 / W4 / W8)" sqlName="return_cohort">
        <ul className="grid gap-2 text-sm sm:grid-cols-3">
          <li>
            <span className="text-zinc-500">W2 (target 50%)</span>
            <p className="text-xl font-medium tabular-nums">{pct(p.returns.w2.pct)}</p>
            <p className="text-xs text-zinc-500">n={p.returns.w2.n}</p>
          </li>
          <li>
            <span className="text-zinc-500">W4 (40%)</span>
            <p className="text-xl font-medium tabular-nums">{pct(p.returns.w4.pct)}</p>
            <p className="text-xs text-zinc-500">n={p.returns.w4.n}</p>
          </li>
          <li>
            <span className="text-zinc-500">W8 (25%)</span>
            <p className="text-xl font-medium tabular-nums">{pct(p.returns.w8.pct)}</p>
            <p className="text-xs text-zinc-500">n={p.returns.w8.n}</p>
          </li>
        </ul>
        <p className="mt-1 text-xs text-zinc-500">Same query with $1 = 2, 4, or 8 (week index).</p>
      </Row>

      <Row title="Safety" sqlName="flag_counts_by_category">
        <div className="flex flex-wrap items-end gap-4">
          <ul className="text-sm">
            {p.flags.length === 0 ? (
              <li className="text-zinc-500">No flags in last 14d</li>
            ) : (
              p.flags.map((f) => (
                <li key={f.category}>
                  {f.category}: {f.count} (repeat sum {f.repeatSum})
                </li>
              ))
            )}
          </ul>
          <div className="flex items-center gap-1">
            <span className="text-xs text-zinc-500">red-team v2</span>
            <SafetySparkline spark={p.redteamSpark} />
          </div>
        </div>
        <p className="mt-1 text-sm">
          Suppression active: {p.safety.suppressionActive} · Modules w/ review due ≤30d:{" "}
          {p.safety.modulesNearingReview}
        </p>
        <p className="mt-1 text-xs text-zinc-500">Sparkline: overall pass rate from `packages/eval/artifacts/redteam-v2-history.jsonl` (weekly run).</p>
        <a className="text-xs text-violet-700 underline" href="/internal/safety-flags">
          ↓ safety flags table
        </a>
        <details className="mt-1 text-xs text-zinc-600">
          <summary className="cursor-pointer">see SQL (extras)</summary>
          <SqlBlock name="safety_extras" />
        </details>
      </Row>

      <Row title="Content" sqlName="content_library">
        <p className="text-sm">
          Published modules: {p.content.published} · Last publish:{" "}
          {p.content.lastPublish != null ? p.content.lastPublish.toISOString() : "—"}
        </p>
        <p className="text-sm">Thin refusals in window: {p.content.refusalsInWindow}</p>
        <p className="text-xs text-zinc-500">Top refusal-like question clusters (by first 80 chars):</p>
        <ol className="ml-4 list-decimal text-sm text-zinc-800">
          {p.content.refusalClusters.map((c) => (
            <li key={c.key || "(empty)"}>
              {c.count}× {c.key || "—"}
            </li>
          ))}
        </ol>
        <details className="mt-1 text-xs text-zinc-600">
          <summary className="cursor-pointer">see SQL (refusals + clusters)</summary>
          <SqlBlock name="refusals_in_window" />
          <SqlBlock name="refusals_by_cluster" />
        </details>
      </Row>

      <Row title="Retrieval" sqlName="retrieval_tier1">
        <p className="text-sm">
          Tier-1 share (answered): {pct(p.retrieval.tier1Share)} · “Retrieval zero” (thin refusal):{" "}
          {p.retrieval.zeroCount} · p50 gen latency:{" "}
          {p.retrieval.p50ms > 0 ? `${p.retrieval.p50ms.toFixed(0)}ms` : "—"}
        </p>
        <details className="mt-1 text-xs text-zinc-600">
          <summary className="cursor-pointer">see SQL (zero + median)</summary>
          <SqlBlock name="retrieval_zero_count" />
          <SqlBlock name="median_latency" />
        </details>
      </Row>

      <Row
        title="Streaming lessons (TASK-040)"
        hint="GET → first card / `done` from `lesson_stream_telemetry` (SSE on when both STREAMING flags are on)."
        sqlName="lesson_stream_latency"
      >
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          <li>
            <span className="text-zinc-500">p50 first card</span>
            <p className="text-xl font-medium tabular-nums">
              {p.lessonStream.count > 0 ? `${p.lessonStream.p50FirstCardMs.toFixed(0)}ms` : "—"}
            </p>
          </li>
          <li>
            <span className="text-zinc-500">p95 first card</span>
            <p className="text-xl font-medium tabular-nums">
              {p.lessonStream.count > 0 ? `${p.lessonStream.p95FirstCardMs.toFixed(0)}ms` : "—"}
            </p>
          </li>
          <li>
            <span className="text-zinc-500">p50 stream done</span>
            <p className="text-xl font-medium tabular-nums">
              {p.lessonStream.count > 0 ? `${p.lessonStream.p50DoneMs.toFixed(0)}ms` : "—"}
            </p>
          </li>
          <li>
            <span className="text-zinc-500">p95 stream done</span>
            <p className="text-xl font-medium tabular-nums">
              {p.lessonStream.count > 0 ? `${p.lessonStream.p95DoneMs.toFixed(0)}ms` : "—"}
            </p>
          </li>
        </ul>
        <p className="mt-2 text-sm text-zinc-600">Streams in window: {p.lessonStream.count}</p>
      </Row>

      <Row
        title="Library search streaming (TASK-041)"
        hint="POST `/api/app/library/search` → first `result` / `done` from `library_search_streams` (no query text stored)."
        sqlName="library_search_latency"
      >
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          <li>
            <span className="text-zinc-500">p50 first result</span>
            <p className="text-xl font-medium tabular-nums">
              {p.librarySearch.withFirstResult > 0 ? `${p.librarySearch.p50FirstResultMs.toFixed(0)}ms` : "—"}
            </p>
          </li>
          <li>
            <span className="text-zinc-500">p95 first result</span>
            <p className="text-xl font-medium tabular-nums">
              {p.librarySearch.withFirstResult > 0 ? `${p.librarySearch.p95FirstResultMs.toFixed(0)}ms` : "—"}
            </p>
          </li>
          <li>
            <span className="text-zinc-500">p50 stream done</span>
            <p className="text-xl font-medium tabular-nums">
              {p.librarySearch.count > 0 ? `${p.librarySearch.p50DoneMs.toFixed(0)}ms` : "—"}
            </p>
          </li>
          <li>
            <span className="text-zinc-500">p95 stream done</span>
            <p className="text-xl font-medium tabular-nums">
              {p.librarySearch.count > 0 ? `${p.librarySearch.p95DoneMs.toFixed(0)}ms` : "—"}
            </p>
          </li>
        </ul>
        <p className="mt-2 text-sm text-zinc-600">
          Completed streams: {p.librarySearch.count} · With ≥1 result: {p.librarySearch.withFirstResult}
        </p>
      </Row>

      <Row
        title="Streaming answers (TASK-031)"
        hint="POST → first committed chunk. Refusal-after-stream counts rows with stream metrics + refusal (excludes user_cancelled)."
        sqlName="streaming_latency"
      >
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          <li>
            <span className="text-zinc-500">p50 first chunk</span>
            <p className="text-xl font-medium tabular-nums">
              {p.streaming.answerCount > 0 ? `${p.streaming.p50FirstChunkMs.toFixed(0)}ms` : "—"}
            </p>
          </li>
          <li>
            <span className="text-zinc-500">p95 first chunk</span>
            <p className="text-xl font-medium tabular-nums">
              {p.streaming.answerCount > 0 ? `${p.streaming.p95FirstChunkMs.toFixed(0)}ms` : "—"}
            </p>
          </li>
        </ul>
        <p className="mt-2 text-sm text-zinc-600">
          Streaming assistant rows in window: {p.streaming.answerCount} · Refusal after stream started:{" "}
          {p.streaming.refusalAfterStream}
        </p>
      </Row>

      <Row title="Cost (Bedrock, last 24h, sanity only)" sqlName="cost_last_day">
        <p className="text-sm">
          ≈${p.cost.usd.toFixed(2)} (tokens in/out: {p.cost.inputTokens} / {p.cost.outputTokens})
        </p>
        <p className="text-xs text-zinc-500">Constants in lib/internal/metrics/bedrock-pricing.ts</p>
      </Row>

      <Row
        title="Model routing A/B (TASK-042)"
        hint="Requires `MODEL_ROUTING=1` + migration `0021_model_routing.sql`. Compares treatment vs control on logged decisions."
        sqlName="routing_ab_comparison"
      >
        {p.routingAb.length === 0 ? (
          <p className="text-sm text-zinc-500">No `model_routing_decisions` rows in this window.</p>
        ) : (
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {p.routingAb.map((r) => (
              <li key={r.cohort}>
                <span className="text-zinc-500">{r.cohort}</span>
                <p className="text-xl font-medium tabular-nums">
                  helpful {r.helpfulPct != null ? `${r.helpfulPct.toFixed(1)}%` : "—"}
                </p>
                <p className="text-xs text-zinc-500">
                  rated {r.rated} · decisions {r.decisions} · avg latency{" "}
                  {r.avgLatencyMs != null ? `${r.avgLatencyMs.toFixed(0)}ms` : "—"} · est. cost sum $
                  {r.sumCostUsd.toFixed(4)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Row>

      <Row
        title="Transparency — “Forget this” taps"
        hint="High counts may mean memory bullets feel wrong or too personal. TASK-033."
        sqlName="transparency_forget_taps"
      >
        <p className="text-3xl font-semibold tabular-nums">{p.transparency.forgetTapsInWindow}</p>
        <p className="text-xs text-zinc-500">User-initiated forget actions in the selected window</p>
      </Row>
    </div>
  );
}
