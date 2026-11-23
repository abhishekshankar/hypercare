import { index, integer, pgTable, smallint, timestamp, uuid } from "drizzle-orm/pg-core";
import { modules } from "./modules.js";
import { users } from "./users.js";

/** TASK-040: GET /api/app/lesson/* SSE one row per successful stream. */
export const lessonStreamTelemetry = pgTable(
  "lesson_stream_telemetry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    firstCardMs: integer("first_card_ms").notNull(),
    doneMs: integer("done_ms").notNull(),
    cardCount: smallint("card_count").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("lesson_stream_telemetry_created_at_idx").on(t.createdAt)],
);
