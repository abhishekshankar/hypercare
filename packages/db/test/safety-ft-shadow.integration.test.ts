import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { createDbClient, safetyFtShadowDecisions } from "../src/index.js";

describe.skipIf(process.env.SHADOW_INTEGRATION !== "1")(
  "safety_ft_shadow_decisions (integration)",
  () => {
    it("inserts a comparison row", async () => {
      const url = process.env.DATABASE_URL;
      if (!url) throw new Error("DATABASE_URL");
      const db = createDbClient(url);
      const inserted = await db
        .insert(safetyFtShadowDecisions)
        .values({
          requestId: crypto.randomUUID(),
          textHash: "deadbeef",
          zeroShotVerdict: { triaged: false },
          fineTunedVerdict: { triaged: true, category: "neglect", severity: "medium" },
          zeroShotLatencyMs: 10,
          fineTunedLatencyMs: 20,
        })
        .returning({ id: safetyFtShadowDecisions.id });
      const id = inserted[0]?.id;
      expect(id).toMatch(/^[0-9a-f-]{36}$/i);
      await db.delete(safetyFtShadowDecisions).where(eq(safetyFtShadowDecisions.id, id!));
    });
  },
);
