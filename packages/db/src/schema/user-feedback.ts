import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uuid, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { conversations } from "./conversations.js";
import { messages } from "./messages.js";
import { modules } from "./modules.js";
import { users } from "./users.js";

export const userFeedback = pgTable(
  "user_feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    body: text("body"),
    conversationId: uuid("conversation_id").references(() => conversations.id, {
      onDelete: "set null",
    }),
    messageId: uuid("message_id").references(() => messages.id, { onDelete: "set null" }),
    includeContext: boolean("include_context").notNull().default(false),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
    triageState: text("triage_state").notNull().default("new"),
    triagePriority: text("triage_priority").notNull().default("normal"),
    triagedBy: uuid("triaged_by").references(() => users.id, { onDelete: "set null" }),
    triagedAt: timestamp("triaged_at", { withTimezone: true }),
    resolutionNote: text("resolution_note"),
    linkedModuleId: uuid("linked_module_id").references(() => modules.id, { onDelete: "set null" }),
    linkedTaskId: text("linked_task_id"),
    /** Care Specialist training label for safety corpus (TASK-039); red-team bucket vocabulary. */
    safetyRelabel: text("safety_relabel"),
  },
  (t) => [
    check(
      "user_feedback_kind_check",
      sql`${t.kind} IN ('off_reply','not_found','suggestion','other','thumbs_down')`,
    ),
    check(
      "user_feedback_triage_state_check",
      sql`${t.triageState} IN ('new','reading','needs_content_fix','needs_classifier_fix','needs_product_fix','ack_and_close','spam_or_invalid')`,
    ),
    check(
      "user_feedback_triage_priority_check",
      sql`${t.triagePriority} IN ('normal','high')`,
    ),
    check(
      "user_feedback_safety_relabel_check",
      sql`${t.safetyRelabel} IS NULL OR ${t.safetyRelabel} IN (
        'crisis_self_harm','crisis_recipient_safety','crisis_external',
        'gray_zone','safe_self_care','safe_factual'
      )`,
    ),
    index("user_feedback_triage_idx").on(t.triageState, t.submittedAt),
    index("user_feedback_submitted_at_idx").on(t.submittedAt),
    uniqueIndex("user_feedback_thumbs_one_per_message")
      .on(t.messageId)
      .where(sql`${t.kind} = 'thumbs_down' AND ${t.messageId} IS NOT NULL`),
  ],
);
