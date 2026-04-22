import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const moduleBriefs = pgTable(
  "module_briefs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    topic: text("topic").notNull(),
    audience: text("audience").notNull(),
    stageRelevance: text("stage_relevance").array().notNull().default(sql`'{}'::text[]`),
    desiredOutcome: text("desired_outcome").notNull(),
    proposedTitle: text("proposed_title"),
    queueReason: text("queue_reason").notNull().default("content_plan"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    status: text("status").notNull().default("open"),
    claimedBy: uuid("claimed_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    index("module_briefs_status_created_at_idx").on(t.status, t.createdAt),
  ],
);
