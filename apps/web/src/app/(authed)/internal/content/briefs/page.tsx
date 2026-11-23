import { createDbClient, moduleBriefs } from "@alongside/db";
import { serverEnv } from "@/lib/env.server";
import { desc } from "drizzle-orm";

export default async function BriefsPage() {
  const db = createDbClient(serverEnv.DATABASE_URL);
  const rows = await db.select().from(moduleBriefs).orderBy(desc(moduleBriefs.createdAt));
  return (
    <main className="p-4">
      <h1 className="text-lg font-semibold">Module briefs</h1>
      <p className="text-sm text-neutral-600">Queue: content plan + (future) refusal-path auto-briefs.</p>
      <table className="mt-4 w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-1 pr-2">Topic</th>
            <th className="py-1 pr-2">Status</th>
            <th className="py-1 pr-2">Reason</th>
            <th className="py-1">Created</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.id} className="border-b border-neutral-100">
              <td className="py-1 pr-2">{b.topic}</td>
              <td className="py-1 pr-2">{b.status}</td>
              <td className="py-1 pr-2">{b.queueReason}</td>
              <td className="py-1">{b.createdAt.toISOString().slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
