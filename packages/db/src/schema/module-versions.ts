import { index, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { modules } from "./modules.js";
import { users } from "./users.js";

export const moduleVersions = pgTable(
  "module_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    bodyMd: text("body_md").notNull(),
    tryThisToday: text("try_this_today"),
    summary: text("summary"),
    publishedAt: timestamp("published_at", { withTimezone: true }).defaultNow().notNull(),
    publishedBy: uuid("published_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    unique("module_versions_module_id_version_unique").on(t.moduleId, t.version),
    index("module_versions_module_id_idx").on(t.moduleId, t.version),
  ],
);
