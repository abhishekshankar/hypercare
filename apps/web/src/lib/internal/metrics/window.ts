export type MetricsWindow = "7d" | "14d" | "30d" | "90d" | "all";

const VALID = new Set<MetricsWindow>(["7d", "14d", "30d", "90d", "all"]);

export function parseWindow(raw: string | null | undefined): MetricsWindow {
  if (raw != null && VALID.has(raw as MetricsWindow)) {
    return raw as MetricsWindow;
  }
  return "30d";
}

export function windowBounds(
  w: MetricsWindow,
  now: Date = new Date(),
): { start: Date | null; end: Date; label: string } {
  const end = now;
  if (w === "all") {
    return { start: null, end, label: "All time" };
  }
  const days = w === "7d" ? 7 : w === "14d" ? 14 : w === "30d" ? 30 : 90;
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return { start, end, label: `Last ${String(days)}d` };
}
