import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { modules } from "./modules.js";
import { users } from "./users.js";

export const moduleEvidence = pgTable(
  "module_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    sourceTier: integer("source_tier").notNull(),
    sourceType: text("source_type").notNull(),
    citation: text("citation").notNull(),
    url: text("url"),
    quotedSupport: text("quoted_support"),
    quotedExcerpt: text("quoted_excerpt"),
    urlSnapshot: text("url_snapshot"),
    claimAnchor: text("claim_anchor"),
    addedBy: uuid("added_by").references(() => users.id, { onDelete: "set null" }),
    addedAt: timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("module_evidence_module_id_idx").on(t.moduleId),
    index("module_evidence_module_claim_idx").on(t.moduleId, t.claimAnchor),
  ],
);
