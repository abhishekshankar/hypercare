import { count, desc, eq } from "drizzle-orm";
import { createDbClient, moduleChunks, moduleEvidence, moduleReviews, moduleStateTransitions, modules } from "@hypercare/db";
import { serverEnv } from "@/lib/env.server";

type PageProps = { params: Promise<{ id: string }> };

export default async function ModuleDetailPage(props: PageProps) {
  const { id } = await props.params;
  const db = createDbClient(serverEnv.DATABASE_URL);
  const [m] = await db.select().from(modules).where(eq(modules.id, id)).limit(1);
  if (!m) {
    return <main className="p-4">Not found</main>;
  }
  const [chunkCount] = await db
    .select({ c: count() })
    .from(moduleChunks)
    .where(eq(moduleChunks.moduleId, id));
  const evidence = await db
    .select()
    .from(moduleEvidence)
    .where(eq(moduleEvidence.moduleId, id))
    .orderBy(desc(moduleEvidence.addedAt));
  const reviews = await db
    .select()
    .from(moduleReviews)
    .where(eq(moduleReviews.moduleId, id))
    .orderBy(desc(moduleReviews.reviewedAt));
  const trans = await db
    .select()
    .from(moduleStateTransitions)
    .where(eq(moduleStateTransitions.moduleId, id))
    .orderBy(desc(moduleStateTransitions.createdAt));
  return (
    <main className="space-y-4 p-4">
      <h1 className="text-lg font-semibold">{m.title}</h1>
      <p className="text-sm text-neutral-600">
        <span className="font-mono text-xs">{m.slug}</span> · {m.draftStatus}
        {m.draftStatus === "retired" && (
          <span className="ml-2 rounded bg-amber-100 px-1.5 text-amber-900">retired</span>
        )}
      </p>
      <div className="flex flex-wrap gap-2 text-sm">
        <a className="text-blue-700 underline" href={`/internal/content/modules/${m.id}/edit`}>
          Edit
        </a>
        <a className="text-blue-700 underline" href={`/internal/content/modules/${m.id}/review`}>
          Review
        </a>
        <a className="text-blue-700 underline" href="/app/library">
          View library
        </a>
      </div>
      {m.draftStatus === "published" && (
        <p className="text-sm">Indexed chunks: {String(chunkCount?.c ?? 0)} (live embeddings for RAG)</p>
      )}
      <section>
        <h2 className="text-sm font-medium">Evidence</h2>
        <ul className="mt-1 list-inside list-disc text-sm">
          {evidence.map((e) => (
            <li key={e.id}>
              (tier {String(e.sourceTier)}) {e.citation}
            </li>
          ))}
          {evidence.length === 0 && <li className="text-neutral-400">—</li>}
        </ul>
      </section>
      <section>
        <h2 className="text-sm font-medium">Reviews</h2>
        <ul className="mt-1 space-y-1 text-sm">
          {reviews.map((r) => (
            <li key={r.id}>
              {r.reviewRole}: <strong>{r.verdict}</strong>
              {r.commentsMd && <div className="ml-0 whitespace-pre-wrap text-neutral-700">{r.commentsMd}</div>}
            </li>
          ))}
          {reviews.length === 0 && <li className="text-neutral-400">—</li>}
        </ul>
      </section>
      <section>
        <h2 className="text-sm font-medium">State transitions</h2>
        <ul className="mt-1 text-xs text-neutral-700">
          {trans.map((t) => (
            <li key={t.id}>
              {t.fromStatus} → {t.toStatus} {t.reason ? `(${t.reason})` : ""} · {t.createdAt.toISOString()}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
