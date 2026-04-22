/**
 * Persistence helper — writes one row to `safety_flags` per triage.
 *
 * The classifier runs at RAG layer 0 *before* a message row exists, so we
 * intentionally write with `messageId`/`conversationId` left null. TASK-011
 * (chat surface) will pass them in once a turn is materialised.
 *
 * Failures here are logged and swallowed: a Postgres outage must not stop a
 * crisis user from seeing the resource pointer. The triage decision (the
 * thing the user *sees*) has already been made by the time we reach this
 * function.
 */

import { safetyFlags } from "@hypercare/db";
import type { drizzle } from "drizzle-orm/postgres-js";

import type { SafetyCategory, SafetySeverity, SafetySource } from "./types.js";

export type SafetyDb = ReturnType<typeof drizzle>;

export type PersistInput = {
  userId: string;
  messageText: string;
  category: SafetyCategory;
  severity: SafetySeverity;
  source: SafetySource;
  matchedSignals: string[];
  /** Optional — set when caller already has a persisted message/conversation row. */
  messageId?: string;
  conversationId?: string;
};

export type PersistFn = (row: PersistInput) => Promise<void>;

export type PersistDeps = {
  db: SafetyDb;
  warn?: (msg: string, ctx?: Record<string, unknown>) => void;
};

export function makeDbPersist(deps: PersistDeps): PersistFn {
  return async function persist(row: PersistInput): Promise<void> {
    try {
      await deps.db.insert(safetyFlags).values({
        userId: row.userId,
        messageText: row.messageText,
        category: row.category,
        severity: row.severity,
        source: row.source,
        matchedSignals: row.matchedSignals,
        ...(row.messageId !== undefined ? { messageId: row.messageId } : {}),
        ...(row.conversationId !== undefined
          ? { conversationId: row.conversationId }
          : {}),
        // `confidence` and `classifier_output` are nullable v0 legacy fields
        // (TASK-004 schema). We do not write them.
      });
    } catch (err) {
      deps.warn?.("safety.persist.failed", {
        error: err instanceof Error ? err.message : String(err),
        category: row.category,
        source: row.source,
      });
    }
  };
}
