/**
 * Persistence — writes to `safety_flags` with 5-minute same-category dedupe.
 *
 * The classifier runs at RAG layer 0 *before* a user message row exists, so
 * we may write with `messageId` left null. Chat routes should pass
 * `conversationId` for dedupe + linkage (TASK-025).
 *
 * Failures are logged and swallowed: a Postgres outage must not block the
 * crisis user from the script-rendered response.
 */

import { and, desc, eq, gt } from "drizzle-orm";
import { safetyFlags } from "@hypercare/db";
import type { drizzle } from "drizzle-orm/postgres-js";

import { readScriptVersionOnly } from "./scripts/parse.js";
import type { SafetyCategory, SafetySeverity, SafetySource } from "./types.js";
import type { SafetyClassifierCategory } from "./types.js";

export type SafetyDb = ReturnType<typeof drizzle>;

export type PersistInput = {
  userId: string;
  messageText: string;
  category: SafetyCategory;
  severity: SafetySeverity;
  source: SafetySource;
  matchedSignals: string[];
  messageId?: string;
  conversationId?: string;
};

export type PersistOutcome = { repeatInWindow: boolean };

export type PersistFn = (row: PersistInput) => Promise<PersistOutcome>;

export type PersistDeps = {
  db: SafetyDb;
  warn?: (msg: string, ctx?: Record<string, unknown>) => void;
};

function classifierCategory(c: SafetyCategory): c is SafetyClassifierCategory {
  return c !== "self_care_burnout";
}

export function makeDbPersist(deps: PersistDeps): PersistFn {
  return async function persist(row: PersistInput): Promise<PersistOutcome> {
    try {
      const scriptVersion = classifierCategory(row.category)
        ? readScriptVersionOnly(row.category, row.messageText)
        : 1;

      const since = new Date(Date.now() - 5 * 60 * 1000);

      if (row.conversationId) {
        const [latest] = await deps.db
          .select()
          .from(safetyFlags)
          .where(
            and(
              eq(safetyFlags.userId, row.userId),
              eq(safetyFlags.conversationId, row.conversationId),
              eq(safetyFlags.category, row.category),
              gt(safetyFlags.createdAt, since),
            ),
          )
          .orderBy(desc(safetyFlags.createdAt))
          .limit(1);

        if (latest) {
          await deps.db
            .update(safetyFlags)
            .set({
              repeatCount: (latest as { repeatCount: number }).repeatCount + 1,
              lastMessageText: row.messageText,
            })
            .where(eq(safetyFlags.id, latest.id));
          return { repeatInWindow: true };
        }
      }

      await deps.db.insert(safetyFlags).values({
        userId: row.userId,
        messageText: row.messageText,
        category: row.category,
        severity: row.severity,
        source: row.source,
        matchedSignals: row.matchedSignals,
        scriptVersion,
        repeatCount: 0,
        ...(row.messageId !== undefined ? { messageId: row.messageId } : {}),
        ...(row.conversationId !== undefined ? { conversationId: row.conversationId } : {}),
      });
      return { repeatInWindow: false };
    } catch (err) {
      deps.warn?.("safety.persist.failed", {
        error: err instanceof Error ? err.message : String(err),
        category: row.category,
        source: row.source,
      });
      return { repeatInWindow: false };
    }
  };
}
