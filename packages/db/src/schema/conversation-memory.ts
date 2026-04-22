import { sql } from "drizzle-orm";
import { boolean, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { conversations } from "./conversations.js";
import { users } from "./users.js";

export const conversationMemory = pgTable(
  "conversation_memory",
  {
    conversationId: uuid("conversation_id")
      .primaryKey()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    summaryMd: text("summary_md").notNull(),
    summaryTokens: integer("summary_tokens").notNull(),
    lastRefreshedAt: timestamp("last_refreshed_at", { withTimezone: true }).defaultNow().notNull(),
    refreshCount: integer("refresh_count").notNull().default(0),
    invalidated: boolean("invalidated").notNull().default(false),
    sourceMessageIds: uuid("source_message_ids")
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
  },
  (t) => [
    index("conversation_memory_user_id_idx").on(t.userId),
    index("conversation_memory_user_id_invalidated_idx").on(t.userId, t.invalidated),
  ],
);
