import { loadSql } from "@/lib/internal/metrics/run-sql";

export function SqlBlock({ name }: Readonly<{ name: string }>) {
  const text = loadSql(name);
  return (
    <pre className="mt-1 max-h-40 overflow-auto rounded border border-zinc-200 bg-zinc-100 p-2 text-xs leading-snug text-zinc-800">
      {text.trim()}
    </pre>
  );
}
