import { pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { messages } from "./messages.js";
import { users } from "./users.js";

export const savedAnswers = pgTable(
  "saved_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    note: text("note"),
    savedAt: timestamp("saved_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique("saved_answers_user_id_message_id_unique").on(t.userId, t.messageId)],
);
