import { eq } from "drizzle-orm";
import { createDbClient, modules } from "@hypercare/db";
import { serverEnv } from "@/lib/env.server";
import { ModuleEditForm } from "../ModuleEditForm";

type P = { params: Promise<{ id: string }> };

export default async function ModuleEditPage(props: P) {
  const { id } = await props.params;
  const db = createDbClient(serverEnv.DATABASE_URL);
  const [m] = await db.select().from(modules).where(eq(modules.id, id)).limit(1);
  if (!m) {
    return <main className="p-4">Not found</main>;
  }
  return (
    <main className="p-4">
      <h1 className="text-lg font-semibold">Edit module</h1>
      <ModuleEditForm moduleId={m.id} initialBody={m.bodyMd} initialTitle={m.title} />
    </main>
  );
}
