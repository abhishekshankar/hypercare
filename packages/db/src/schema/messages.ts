import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, pgTable, real, smallint, text, timestamp, uuid } from "drizzle-orm/pg-core";
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
    /**
     * TASK-022: 0–3 `topics.slug` values from the closed vocabulary (user rows only; `[]` for assistant).
     */
    classifiedTopics: jsonb("classified_topics")
      .notNull()
      .default(sql`'[]'::jsonb`),
    /** Classifier self-reported score in [0, 1] when `classified_topics` is non-empty; else null. */
    topicConfidence: real("topic_confidence"),
    /** Thumbs-up/down time (PRD helpfulness, TASK-029). Assistant rows only. */
    ratedAt: timestamp("rated_at", { withTimezone: true }),
    /** Thumbs; assistant rows that received a rating. */
    rating: text("rating"),
    /** When true, the UI showed a helpfulness control for this assistant turn. */
    ratingInvited: boolean("rating_invited"),
    /** Top search hit module `tier` when retrieval ran; null for refusals before hit / safety-only paths. */
    retrievalTopTier: smallint("retrieval_top_tier"),
    /** `RefusalReason.code` string for `response_kind = refusal` (metrics clustering). */
    refusalReasonCode: text("refusal_reason_code"),
    bedrockInputTokens: integer("bedrock_input_tokens"),
    bedrockOutputTokens: integer("bedrock_output_tokens"),
    generationLatencyMs: integer("generation_latency_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check("messages_role_check", sql`${t.role} IN ('user', 'assistant', 'system')`),
    check(
      "messages_response_kind_check",
      sql`(${t.responseKind} IS NULL OR ${t.responseKind} IN ('answer', 'refusal', 'safety_script'))`,
    ),
    check(
      "messages_rating_check",
      sql`${t.rating} IS NULL OR ${t.rating} IN ('up', 'down')`,
    ),
    check(
      "messages_retrieval_top_tier_check",
      sql`${t.retrievalTopTier} IS NULL OR ${t.retrievalTopTier} IN (1, 2, 3)`,
    ),
    index("messages_conversation_id_created_at_idx").on(t.conversationId, t.createdAt),
  ],
);
