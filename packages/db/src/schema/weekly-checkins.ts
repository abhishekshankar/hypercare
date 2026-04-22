import { boolean, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const weeklyCheckins = pgTable(
  "weekly_checkins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    promptedAt: timestamp("prompted_at", { withTimezone: true }).defaultNow().notNull(),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    triedSomething: boolean("tried_something"),
    whatHelped: text("what_helped"),
  },
  (t) => [
    unique("weekly_checkins_user_id_prompted_at_unique").on(t.userId, t.promptedAt),
    index("weekly_checkins_user_id_answered_at_idx").on(
      t.userId,
      t.answeredAt.desc().nullsLast(),
    ),
    index("weekly_checkins_user_id_prompted_at_idx").on(
      t.userId,
      t.promptedAt.desc().nullsLast(),
    ),
  ],
);
