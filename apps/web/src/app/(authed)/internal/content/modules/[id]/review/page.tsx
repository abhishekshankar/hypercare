import { eq } from "drizzle-orm";
import { createDbClient, modules } from "@alongside/db";
import { serverEnv } from "@/lib/env.server";
import { ModuleReviewForm } from "../ModuleReviewForm";

type P = { params: Promise<{ id: string }> };

export default async function ModuleReviewPage(props: P) {
  const { id } = await props.params;
  const db = createDbClient(serverEnv.DATABASE_URL);
  const [m] = await db.select().from(modules).where(eq(modules.id, id)).limit(1);
  if (!m) {
    return <main className="p-4">Not found</main>;
  }
  return (
    <main className="p-4">
      <h1 className="text-lg font-semibold">Review: {m.title}</h1>
      <p className="text-sm text-neutral-600">State: {m.draftStatus}</p>
      <div className="mt-3 max-w-3xl whitespace-pre-wrap rounded border border-neutral-200 bg-white p-3 text-sm">
        {m.bodyMd}
      </div>
      <div className="mt-4">
        <h2 className="text-sm font-medium">Verdict</h2>
        <ModuleReviewForm moduleId={m.id} />
      </div>
    </main>
  );
}
