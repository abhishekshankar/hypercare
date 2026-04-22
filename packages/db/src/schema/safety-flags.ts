import { sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { conversations } from "./conversations.js";
import { messages } from "./messages.js";
import { users } from "./users.js";

/**
 * Safety triage rows written by `@hypercare/safety` (TASK-010).
 *
 * The classifier runs at RAG layer 0 — *before* a user message is persisted —
 * so `message_id` and `conversation_id` are nullable. They are wired up by
 * downstream callers (TASK-011 chat route) when a triage happens to coincide
 * with a turn that does get persisted.
 *
 * `message_text` is the verbatim caregiver question. PII-adjacent but stored
 * intentionally for downstream human review of misses (ADR 0009 §4).
 */
export const safetyFlags = pgTable(
  "safety_flags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id").references(() => messages.id, {
      onDelete: "cascade",
    }),
    conversationId: uuid("conversation_id").references(() => conversations.id, {
      onDelete: "cascade",
    }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    messageText: text("message_text").notNull(),
    category: text("category").notNull(),
    severity: text("severity").notNull(),
    source: text("source").notNull(),
    matchedSignals: jsonb("matched_signals")
      .notNull()
      .default(sql`'[]'::jsonb`),
    /** Legacy v0 fields, kept nullable for back-compat with TASK-004 schema. */
    confidence: numeric("confidence", { precision: 3, scale: 2 }),
    classifierOutput: jsonb("classifier_output"),
    escalationRendered: text("escalation_rendered"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check(
      "safety_flags_category_check",
      sql`${t.category} IN (
        'self_harm_user', 'self_harm_cr', 'acute_medical',
        'abuse_cr_to_caregiver', 'abuse_caregiver_to_cr', 'neglect'
      )`,
    ),
    check(
      "safety_flags_severity_check",
      sql`${t.severity} IN ('high', 'medium')`,
    ),
    check(
      "safety_flags_source_check",
      sql`${t.source} IN ('rule', 'llm')`,
    ),
    check(
      "safety_flags_confidence_check",
      sql`${t.confidence} IS NULL OR (${t.confidence} >= 0 AND ${t.confidence} <= 1)`,
    ),
    index("safety_flags_user_id_created_at_idx").on(t.userId, t.createdAt.desc()),
    index("safety_flags_category_created_at_idx").on(t.category, t.createdAt.desc()),
  ],
);
