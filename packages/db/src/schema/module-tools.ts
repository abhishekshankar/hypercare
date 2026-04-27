import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { modules } from "./modules.js";

export const moduleTools = pgTable(
  "module_tools",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    toolType: text("tool_type").notNull(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check(
      "module_tools_type_check",
      sql`${t.toolType} IN ('decision_tree','checklist','script','template','flowchart')`,
    ),
    unique("module_tools_module_slug_unique").on(t.moduleId, t.slug),
    index("module_tools_module_id_idx").on(t.moduleId),
  ],
);
