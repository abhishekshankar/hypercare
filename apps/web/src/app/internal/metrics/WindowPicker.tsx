"use client";

import { useRouter, useSearchParams } from "next/navigation";

import type { MetricsWindow } from "@/lib/internal/metrics/window";

const OPTIONS: { w: MetricsWindow; label: string }[] = [
  { w: "7d", label: "7d" },
  { w: "14d", label: "14d" },
  { w: "30d", label: "30d" },
  { w: "90d", label: "90d" },
  { w: "all", label: "All" },
];

export function WindowPicker() {
  const r = useRouter();
  const sp = useSearchParams();
  const cur = (sp.get("w") as MetricsWindow | null) ?? "30d";
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-zinc-700">
      <span className="font-medium">Window</span>
      {OPTIONS.map(({ w, label }) => (
        <button
          key={w}
          type="button"
          className={`rounded border px-2 py-0.5 ${
            (cur === w) || (cur == null && w === "30d")
              ? "border-zinc-900 bg-zinc-200"
              : "border-zinc-300 bg-white hover:bg-zinc-100"
          }`}
          onClick={() => {
            r.push(`/internal/metrics?w=${w}`);
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
