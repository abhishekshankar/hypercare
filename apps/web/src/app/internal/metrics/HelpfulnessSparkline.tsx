import type { MetricsPayload } from "@/lib/internal/metrics/load-payload";

const TARGET = 70;

/**
 * 120×32 SVG — target dashed line at 70% (PRD §3.1).
 */
export function HelpfulnessSparkline({ spark }: Readonly<Pick<MetricsPayload, "spark">>) {
  const pts = spark
    .map((s) => s.rate)
    .filter((x): x is number => x != null && !Number.isNaN(x));
  if (pts.length === 0) {
    return <span className="text-xs text-zinc-500">No weekly data</span>;
  }
  const w = 120;
  const h = 32;
  const max = 100;
  const minR = 0;
  const step = pts.length > 1 ? w / (pts.length - 1) : 0;
  const toY = (p: number) => h - ((p - minR) / (max - minR)) * (h - 4) - 2;
  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(i * step).toFixed(1)} ${toY(p).toFixed(1)}`)
    .join(" ");
  const ty = toY(TARGET);
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="inline-block h-8 w-[120px] text-violet-600"
      role="img"
      aria-label="Helpfulness rate by week with 70% target"
    >
      <line
        x1="0"
        y1={ty}
        x2={w}
        y2={ty}
        stroke="currentColor"
        strokeDasharray="3 2"
        strokeOpacity="0.5"
        className="text-zinc-500"
      />
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.2" className="text-violet-600" />
    </svg>
  );
}
