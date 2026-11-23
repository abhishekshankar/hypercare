import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { conversations } from "./conversations.js";
import { users } from "./users.js";

export const conversationMemoryForgotten = pgTable(
  "conversation_memory_forgotten",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    forgottenText: text("forgotten_text").notNull(),
    forgottenAt: timestamp("forgotten_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("conversation_memory_forgotten_conversation_id_forgotten_at_idx").on(t.conversationId, t.forgottenAt)],
);
