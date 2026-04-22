import { expect, it } from "vitest";
import { runRetentionCron } from "../src/scripts/retention-cron.js";

it.skipIf(!process.env.DATABASE_URL)("retention dry-run does not throw", async () => {
  const logs: string[] = [];
  await runRetentionCron(process.env.DATABASE_URL!, {
    dryRun: true,
    log: (s: string) => logs.push(s),
  });
  expect(logs.length).toBeGreaterThan(0);
});
