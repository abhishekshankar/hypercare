import { createDbClient, modules } from "@hypercare/db";
import { serverEnv } from "@/lib/env.server";
import { asc, desc } from "drizzle-orm";

const STATES = [
  "draft",
  "content_lead_review",
  "expert_review",
  "lived_experience_review",
  "approved",
  "published",
  "retired",
] as const;

export default async function InternalContentHome() {
  const db = createDbClient(serverEnv.DATABASE_URL);
  const rows = await db
    .select({
      id: modules.id,
      title: modules.title,
      slug: modules.slug,
      draftStatus: modules.draftStatus,
      lastPublishedAt: modules.lastPublishedAt,
    })
    .from(modules)
    .orderBy(asc(modules.draftStatus), desc(modules.updatedAt));
  const byState = new Map<string, typeof rows>();
  for (const st of STATES) {
    byState.set(st, []);
  }
  for (const r of rows) {
    const list = byState.get(r.draftStatus);
    if (list) {
      list.push(r);
    }
  }
  return (
    <main className="p-4">
      <h1 className="text-lg font-semibold">Content pipeline</h1>
      <p className="text-sm text-neutral-600">One column per `draft_status` (TASK-028).</p>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {STATES.map((st) => (
          <section key={st} className="rounded border border-neutral-200 bg-white p-3">
            <h2 className="text-sm font-medium capitalize text-neutral-800">{st.replaceAll("_", " ")}</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {(byState.get(st) ?? []).map((m) => (
                <li key={m.id}>
                  <a className="text-blue-700 underline" href={`/internal/content/modules/${m.id}`}>
                    {m.title}
                  </a>{" "}
                  <span className="text-neutral-500">({m.slug})</span>
                </li>
              ))}
              {(byState.get(st) ?? []).length === 0 && (
                <li className="text-neutral-400">—</li>
              )}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
