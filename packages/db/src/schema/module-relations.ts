import { sql } from "drizzle-orm";
import { check, index, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { modules } from "./modules.js";

export const moduleRelations = pgTable(
  "module_relations",
  {
    fromModuleId: uuid("from_module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    toModuleId: uuid("to_module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    relationType: text("relation_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check(
      "module_relations_type_check",
      sql`${t.relationType} IN ('prerequisite','follow_up','deeper','contradicts','soft_flag_companion')`,
    ),
    primaryKey({
      name: "module_relations_pk",
      columns: [t.fromModuleId, t.toModuleId, t.relationType],
    }),
    index("module_relations_from_idx").on(t.fromModuleId, t.relationType),
  ],
);
