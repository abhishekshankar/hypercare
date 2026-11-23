import type { SQL } from "drizzle-orm";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { createDbClient, safetyFlags } from "@alongside/db";
import Link from "next/link";

import { serverEnv } from "@/lib/env.server";

export const dynamic = "force-dynamic";

export default async function SafetyFlagsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ category?: string; severity?: string; from?: string; to?: string }>;
}>) {
  const sp = await searchParams;
  const category = sp.category;
  const severity = sp.severity;
  const from = sp.from != null && sp.from.length > 0 ? new Date(sp.from) : null;
  const to = sp.to != null && sp.to.length > 0 ? new Date(sp.to) : null;

  const parts: SQL[] = [];
  if (category != null && category.length > 0) {
    parts.push(eq(safetyFlags.category, category));
  }
  if (severity != null && severity.length > 0) {
    parts.push(eq(safetyFlags.severity, severity));
  }
  if (from != null) {
    parts.push(gte(safetyFlags.createdAt, from));
  }
  if (to != null) {
    parts.push(lte(safetyFlags.createdAt, to));
  }

  const db = createDbClient(serverEnv.DATABASE_URL);
  const baseQuery = db
    .select({
      id: safetyFlags.id,
      category: safetyFlags.category,
      severity: safetyFlags.severity,
      source: safetyFlags.source,
      messageText: safetyFlags.messageText,
      userId: safetyFlags.userId,
      repeatCount: safetyFlags.repeatCount,
      createdAt: safetyFlags.createdAt,
      conversationId: safetyFlags.conversationId,
    })
    .from(safetyFlags);
  const q =
    parts.length > 0 ? baseQuery.where(and(...parts)) : baseQuery;
  const rows = await q.orderBy(desc(safetyFlags.createdAt)).limit(200);
  return (
    <div>
      <h1 className="text-lg font-semibold">Safety flags (read-only)</h1>
      <form className="mb-3 flex flex-wrap gap-2 text-sm" method="get">
        <input className="rounded border border-zinc-300 px-2" name="category" placeholder="category" defaultValue={category} />
        <input className="rounded border border-zinc-300 px-2" name="severity" placeholder="severity" defaultValue={severity} />
        <input className="rounded border border-zinc-300 px-2" name="from" type="date" defaultValue={sp.from} />
        <input className="rounded border border-zinc-300 px-2" name="to" type="date" defaultValue={sp.to} />
        <button className="rounded border border-zinc-400 bg-zinc-100 px-2" type="submit">
          Filter
        </button>
      </form>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-200">
              <th className="p-1.5">When</th>
              <th className="p-1.5">Category</th>
              <th className="p-1.5">Sev</th>
              <th className="p-1.5">Src</th>
              <th className="p-1.5">Message</th>
              <th className="p-1.5">user_id</th>
              <th className="p-1.5">Rpt</th>
              <th className="p-1.5">Links</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-zinc-100 align-top">
                <td className="p-1.5 text-zinc-600">{r.createdAt.toISOString()}</td>
                <td className="p-1.5 font-mono">{r.category}</td>
                <td className="p-1.5">{r.severity}</td>
                <td className="p-1.5">{r.source}</td>
                <td className="p-1.5 max-w-[240px] break-words">{r.messageText.slice(0, 200)}</td>
                <td className="p-1.5 font-mono text-xs">{r.userId}</td>
                <td className="p-1.5 tabular-nums">{r.repeatCount}</td>
                <td className="p-1.5">
                  {r.conversationId != null ? (
                    <span className="flex flex-col gap-0.5">
                      <Link className="text-violet-700 underline" href={`/internal/conversation/${r.conversationId}/memory`}>
                        memory
                      </Link>
                      <Link
                        className="text-violet-700 underline"
                        href={`/internal/conversation/${r.conversationId}/transcript`}
                      >
                        transcript
                      </Link>
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
