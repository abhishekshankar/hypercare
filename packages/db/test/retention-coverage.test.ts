import postgres from "postgres";
import { expect, it } from "vitest";
import { assertDatabaseUrl } from "../src/env.js";
import { type RetentionTableName, RETENTION_SCHEDULE } from "../src/retention/schedule.js";

const withDb = Boolean(process.env.DATABASE_URL);

it.skipIf(!withDb)("retention rule exists for every public base table in Postgres", async () => {
  const url = assertDatabaseUrl(process.env.DATABASE_URL!);
  const c = postgres(url, { max: 1, prepare: false });
  try {
    const rows = await c<{ tablename: string }[]>`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename != '_drizzle_migrations'
    `;
    const dbTables = new Set(rows.map((r) => r.tablename));
    const schedule = new Set(Object.keys(RETENTION_SCHEDULE) as RetentionTableName[]);
    for (const t of dbTables) {
      expect(
        schedule.has(t as RetentionTableName),
        `Table "${t}" is missing from RETENTION_SCHEDULE`,
      ).toBe(true);
    }
    for (const t of schedule) {
      expect(dbTables.has(t), `RETENTION_SCHEDULE has unknown table "${t}"`).toBe(true);
    }
  } finally {
    await c.end({ timeout: 5 });
  }
});

it("retention map is non-empty and stable", () => {
  expect(Object.keys(RETENTION_SCHEDULE).length).toBeGreaterThan(10);
});
