import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { modules } from "./modules.js";

export const moduleBranches = pgTable(
  "module_branches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    stageKey: text("stage_key").notNull(),
    relationshipKey: text("relationship_key").notNull(),
    livingSituationKey: text("living_situation_key").notNull(),
    bodyMd: text("body_md").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check(
      "module_branches_stage_key_check",
      sql`${t.stageKey} IN ('early','middle','late','any')`,
    ),
    check(
      "module_branches_relationship_key_check",
      sql`${t.relationshipKey} IN ('parent','spouse','sibling','in_law','other','any')`,
    ),
    check(
      "module_branches_living_situation_key_check",
      sql`${t.livingSituationKey} IN (
        'with_caregiver','alone','with_other_family','assisted_living','memory_care','nursing_home','any'
      )`,
    ),
    unique("module_branches_module_axes_unique").on(
      t.moduleId,
      t.stageKey,
      t.relationshipKey,
      t.livingSituationKey,
    ),
    index("module_branches_module_lookup_idx").on(
      t.moduleId,
      t.stageKey,
      t.relationshipKey,
      t.livingSituationKey,
    ),
  ],
);
