import { and, asc, desc, eq, isNotNull, ne } from "drizzle-orm";
import { createDbClient, messages, modules, safetyFlags } from "@alongside/db";
import { serverEnv } from "@/lib/env.server";

export default async function ContentAuditPage() {
  const db = createDbClient(serverEnv.DATABASE_URL);
  const refusals = await db
    .select({
      id: messages.id,
      createdAt: messages.createdAt,
      refusalReasonCode: messages.refusalReasonCode,
    })
    .from(messages)
    .where(
      and(
        eq(messages.role, "assistant"),
        isNotNull(messages.refusal),
        eq(messages.responseKind, "refusal"),
      ),
    )
    .orderBy(desc(messages.createdAt))
    .limit(50);
  const flags = await db
    .select({
      id: safetyFlags.id,
      category: safetyFlags.category,
      createdAt: safetyFlags.createdAt,
    })
    .from(safetyFlags)
    .orderBy(desc(safetyFlags.createdAt))
    .limit(50);
  const reviewSoon = await db
    .select({
      id: modules.id,
      title: modules.title,
      nextReviewDue: modules.nextReviewDue,
    })
    .from(modules)
    .where(
      and(
        isNotNull(modules.nextReviewDue),
        eq(modules.published, true),
        ne(modules.draftStatus, "retired"),
      ),
    )
    .orderBy(asc(modules.nextReviewDue))
    .limit(20);
  return (
    <main className="p-4">
      <h1 className="text-lg font-semibold">Content weekly audit</h1>
      <p className="text-sm text-neutral-600">
        Read-only v0. Last 50 assistant refusals, last 50 safety flags, modules with upcoming review
        (PRD §8.4 / §10.2). Retrieval heatmap: planned (TASK-029).
      </p>
      <section className="mt-4">
        <h2 className="text-sm font-medium">Refusal rows (last 50)</h2>
        <ul className="mt-1 text-xs text-neutral-700">
          {refusals.map((r) => (
            <li key={r.id}>
              {r.createdAt.toISOString()} {r.refusalReasonCode ?? "—"}
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-4">
        <h2 className="text-sm font-medium">Safety flags (last 50)</h2>
        <ul className="mt-1 text-xs text-neutral-700">
          {flags.map((f) => (
            <li key={f.id}>
              {f.createdAt.toISOString()} {f.category}
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-4">
        <h2 className="text-sm font-medium">Upcoming / stale reviews (heuristic)</h2>
        <ul className="mt-1 text-xs text-neutral-700">
          {reviewSoon.map((m) => (
            <li key={m.id}>
              <a className="underline" href={`/internal/content/modules/${m.id}`}>
                {m.title}
              </a>{" "}
              due {m.nextReviewDue ? String(m.nextReviewDue) : "—"}
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-4 text-xs text-neutral-500">
        Retrieval-zero modules (30d): not available without product analytics in v0 — use logs / TASK-029.
      </section>
    </main>
  );
}
