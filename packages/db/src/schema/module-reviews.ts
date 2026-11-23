import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { modules } from "./modules.js";
import { users } from "./users.js";

export const moduleReviews = pgTable(
  "module_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    reviewerUserId: uuid("reviewer_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reviewRole: text("review_role").notNull(),
    verdict: text("verdict").notNull(),
    commentsMd: text("comments_md"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("module_reviews_module_id_idx").on(t.moduleId, t.reviewedAt)],
);
