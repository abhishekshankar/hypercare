import { sql } from "drizzle-orm";
import { check, integer, jsonb, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { messages } from "./messages.js";
import { users } from "./users.js";

export const modelRoutingDecisions = pgTable(
  "model_routing_decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .references(() => messages.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    cohort: text("cohort").notNull(),
    classifierVerdict: jsonb("classifier_verdict").notNull(),
    policyVersion: integer("policy_version").notNull(),
    matchedRule: integer("matched_rule"),
    modelId: text("model_id").notNull(),
    reason: text("reason").notNull(),
    latencyMs: integer("latency_ms"),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    costEstimateUsd: numeric("cost_estimate_usd", { precision: 10, scale: 6 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check(
      "model_routing_decisions_cohort_check",
      sql`${t.cohort} IN ('routing_v1_control', 'routing_v1_treatment')`,
    ),
  ],
);
