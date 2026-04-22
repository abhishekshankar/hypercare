import { and, desc, eq, gte } from "drizzle-orm";
import { conversations, createDbClient, messages } from "@hypercare/db";

const WINDOW_DAYS = 14;
const RECENCY_DAYS = 7;

export interface RecentTopicSignal {
  topTopics: { slug: string; weight: number }[];
  windowDays: number;
  messagesConsidered: number;
  asOf: string;
}

/**
 * Recency half-life: weight multiplies by `exp(-age_days / RECENCY_DAYS)`.
 * Aggregator uses the top-1 slug per user message (see ADR-0013).
 */
export function aggregateRecentTopicWeights(
  rows: Array<{ createdAt: Date; classifiedTopics: unknown }>,
  now: Date,
): { scores: Map<string, number>; messagesConsidered: number } {
  const scores = new Map<string, number>();
  let messagesConsidered = 0;
  const nowMs = now.getTime();
  for (const row of rows) {
    messagesConsidered += 1;
    const arr = row.classifiedTopics;
    if (!Array.isArray(arr) || arr.length === 0) continue;
    const slug = typeof arr[0] === "string" ? arr[0] : null;
    if (!slug) continue;
    const ageMs = nowMs - row.createdAt.getTime();
    const ageDays = ageMs / (24 * 60 * 60 * 1000);
    const w = Math.exp(-ageDays / RECENCY_DAYS);
    scores.set(slug, (scores.get(slug) ?? 0) + w);
  }
  return { scores, messagesConsidered };
}

export function normalizeTopTopics(
  scores: Map<string, number>,
  limit: number = 5,
): { slug: string; weight: number }[] {
  if (scores.size === 0) return [];
  const maxW = Math.max(...scores.values());
  if (maxW <= 0) return [];
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([slug, w]) => ({ slug, weight: w / maxW }));
}

/**
 * Returns a recency-weighted list of recent topic slugs (picker input). No LLM.
 * If `deps.db` is omitted, `DATABASE_URL` (or `deps.databaseUrl`) must be set.
 */
export async function getRecentTopicSignal(
  userId: string,
  deps?: { db?: ReturnType<typeof createDbClient>; now?: () => Date; databaseUrl?: string },
): Promise<RecentTopicSignal> {
  const now = deps?.now?.() ?? new Date();
  const url = deps?.databaseUrl ?? process.env.DATABASE_URL;
  if (!deps?.db && !url) {
    throw new Error("getRecentTopicSignal: pass deps.db or set DATABASE_URL (or deps.databaseUrl)");
  }
  const db = deps?.db ?? createDbClient(url!);
  const cutoff = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      createdAt: messages.createdAt,
      classifiedTopics: messages.classifiedTopics,
    })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(
      and(
        eq(conversations.userId, userId),
        eq(messages.role, "user"),
        gte(messages.createdAt, cutoff),
      ),
    )
    .orderBy(desc(messages.createdAt));

  const { scores, messagesConsidered } = aggregateRecentTopicWeights(rows, now);
  const topTopics = normalizeTopTopics(scores, 5);

  return {
    topTopics,
    windowDays: WINDOW_DAYS,
    messagesConsidered,
    asOf: now.toISOString(),
  };
}
