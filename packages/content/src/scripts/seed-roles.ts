/**
 * One-off CLI: set `users.role` for known user IDs. Run with:
 *   DATABASE_URL=... tsx src/scripts/seed-roles.ts
 *
 * JSON on stdin, array of { "userId": "uuid", "role": "content_lead" }.
 */
import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { createDbClient, users } from "@hypercare/db";

const appRole = z.enum([
  "caregiver",
  "content_writer",
  "content_lead",
  "medical_director",
  "care_specialist",
  "caregiver_support_clinician",
  "lived_experience_reviewer",
  "admin",
]);

const rowSchema = z.object({
  userId: z.string().uuid(),
  role: appRole,
});

const inputSchema = z.array(rowSchema);

function requireUrl(): string {
  const u = process.env.DATABASE_URL;
  if (u == null || u.length === 0) {
    console.error("Set DATABASE_URL to a postgres URL.");
    process.exit(1);
  }
  if (!u.startsWith("postgres://") && !u.startsWith("postgresql://")) {
    console.error("DATABASE_URL must be a postgres connection string.");
    process.exit(1);
  }
  return u;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) {
    chunks.push(c as Buffer);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

async function main(): Promise<void> {
  const raw = await readStdin();
  const list = inputSchema.parse(JSON.parse(raw) as unknown);
  const url = requireUrl();
  const db = createDbClient(url);
  const ids = list.map((r) => r.userId);
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.id, ids));
  const have = new Set(existing.map((e) => e.id));
  for (const r of list) {
    if (!have.has(r.userId)) {
      throw new Error(`No user for id ${r.userId}`);
    }
  }
  for (const r of list) {
    await db.update(users).set({ role: r.role }).where(eq(users.id, r.userId));
  }
  console.log(`Updated ${String(list.length)} user(s).`);
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
