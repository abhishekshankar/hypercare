import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { modules } from "./modules.js";
import { users } from "./users.js";

export const moduleStateTransitions = pgTable(
  "module_state_transitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    fromStatus: text("from_status").notNull(),
    toStatus: text("to_status").notNull(),
    byUserId: uuid("by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("module_state_transitions_module_id_idx").on(t.moduleId, t.createdAt)],
);
