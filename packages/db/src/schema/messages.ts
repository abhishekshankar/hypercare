import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { conversations } from "./conversations.js";

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    responseKind: text("response_kind"),
    retrieval: jsonb("retrieval"),
    classifier: jsonb("classifier"),
    verification: jsonb("verification"),
    /**
     * Citations rendered with this assistant turn (TASK-011). Empty array
     * for user/system rows. Stored verbatim as the answer rendered them so
     * a future re-embedding of `module_chunks` cannot retroactively
     * invalidate already-rendered citation chips.
     */
    citations: jsonb("citations")
      .notNull()
      .default(sql`'[]'::jsonb`),
    /**
     * RefusalReason payload from `@hypercare/rag` when the assistant turn
     * refused (any non-`answered` outcome). Null when the assistant
     * answered or for non-assistant rows.
     */
    refusal: jsonb("refusal"),
    modelId: text("model_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check("messages_role_check", sql`${t.role} IN ('user', 'assistant', 'system')`),
    check(
      "messages_response_kind_check",
      sql`(${t.responseKind} IS NULL OR ${t.responseKind} IN ('answer', 'refusal', 'safety_script'))`,
    ),
    index("messages_conversation_id_created_at_idx").on(t.conversationId, t.createdAt),
  ],
);
