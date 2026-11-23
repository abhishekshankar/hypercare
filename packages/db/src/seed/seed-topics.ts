import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { requireDatabaseUrl } from "../env.js";
import { topics } from "../schema/topics.js";
import { TOPICS_V0 } from "./topic-seed-data.js";

const url = requireDatabaseUrl();
const client = postgres(url, { max: 1, prepare: false });
const db = drizzle(client);

const rows = TOPICS_V0.map((t) => ({
  slug: t.slug,
  category: t.category,
  displayName: t.displayName,
}));

await db.insert(topics).values(rows).onConflictDoNothing();

const countRows = await client<{ count: string }[]>`select count(*)::text as count from "topics"`;
const count = countRows[0]?.count ?? "?";
console.log(`seed-topics: upserted v0 set; topics row count = ${count}`);

await client.end({ timeout: 10 });
