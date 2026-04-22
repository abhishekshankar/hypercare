import { index, integer, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./users.js";

/** TASK-041: one row per completed library search SSE stream (latency + counts only). */
export const librarySearchStreams = pgTable(
  "library_search_streams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    firstResultAt: timestamp("first_result_at", { withTimezone: true }),
    doneAt: timestamp("done_at", { withTimezone: true }),
    queryLength: integer("query_length").notNull(),
    candidateCount: integer("candidate_count").notNull(),
    resultCount: integer("result_count").notNull().default(0),
  },
  (t) => [index("library_search_streams_started_at_idx").on(t.startedAt)],
);
