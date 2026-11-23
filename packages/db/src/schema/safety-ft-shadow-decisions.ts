import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Shadow-mode comparison of Layer-B classifiers (TASK-039).
 * Verdict columns are JSON shapes `{ triaged, category?, severity? }` — no message text.
 */
export const safetyFtShadowDecisions = pgTable(
  "safety_ft_shadow_decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id").notNull(),
    textHash: text("text_hash").notNull(),
    zeroShotVerdict: jsonb("zero_shot_verdict").notNull(),
    fineTunedVerdict: jsonb("fine_tuned_verdict").notNull(),
    zeroShotLatencyMs: integer("zero_shot_latency_ms").notNull(),
    fineTunedLatencyMs: integer("fine_tuned_latency_ms").notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("safety_ft_shadow_observed_at_idx").on(t.observedAt.desc())],
);
