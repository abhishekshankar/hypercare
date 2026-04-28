import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";
import {
  conversationMemory,
  conversationMemoryForgotten,
  conversations,
  createDbClient,
} from "@alongside/db";
import { maybeDecodePercentEncoding } from "@/lib/url/maybe-decode-uri-component";

import { stripForgottenBulletsFromSummary } from "./memory-display";

export type TransparencyConversationOption = {
  id: string;
  title: string | null;
  updatedAt: string;
  hasMemory: boolean;
};

export type TransparencyMemoryPayload = {
  conversations: TransparencyConversationOption[];
  selectedConversationId: string;
  summaryMd: string | null;
  sourceMessageCount: number;
  refreshedAt: string | null;
  invalidated: boolean;
  hasRenderableSummary: boolean;
};

function pickDefaultConversationId(
  list: TransparencyConversationOption[],
  requested: string | null,
): string | null {
  if (list.length === 0) return null;
  if (requested != null && list.some((c) => c.id === requested)) {
    return requested;
  }
  const withMem = list.find((c) => c.hasMemory);
  return (withMem ?? list[0])!.id;
}

export async function loadTransparencyMemoryPayload(
  databaseUrl: string,
  userId: string,
  conversationIdParam: string | null,
): Promise<TransparencyMemoryPayload> {
  const db = createDbClient(databaseUrl);
  const convs = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      updatedAt: conversations.updatedAt,
    })
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt))
    .limit(15);

  if (convs.length === 0) {
    return {
      conversations: [],
      selectedConversationId: "",
      summaryMd: null,
      sourceMessageCount: 0,
      refreshedAt: null,
      invalidated: false,
      hasRenderableSummary: false,
    };
  }

  const memConvIds = await db
    .select({ conversationId: conversationMemory.conversationId })
    .from(conversationMemory)
    .where(eq(conversationMemory.userId, userId));
  const hasMemSet = new Set(memConvIds.map((r) => r.conversationId));

  const conversationsOpts: TransparencyConversationOption[] = convs.map((c) => ({
    id: c.id,
    title: c.title == null ? null : maybeDecodePercentEncoding(c.title),
    updatedAt: c.updatedAt.toISOString(),
    hasMemory: hasMemSet.has(c.id),
  }));

  const selectedId = pickDefaultConversationId(conversationsOpts, conversationIdParam)!;

  const [mem] = await db
    .select({
      summaryMd: conversationMemory.summaryMd,
      sourceMessageIds: conversationMemory.sourceMessageIds,
      lastRefreshedAt: conversationMemory.lastRefreshedAt,
      invalidated: conversationMemory.invalidated,
    })
    .from(conversationMemory)
    .where(
      and(eq(conversationMemory.conversationId, selectedId), eq(conversationMemory.userId, userId)),
    )
    .limit(1);

  const forgottenRows = await db
    .select({ text: conversationMemoryForgotten.forgottenText })
    .from(conversationMemoryForgotten)
    .where(
      and(
        eq(conversationMemoryForgotten.conversationId, selectedId),
        eq(conversationMemoryForgotten.userId, userId),
      ),
    )
    .orderBy(asc(conversationMemoryForgotten.forgottenAt));
  const forgottenTexts = forgottenRows.map((r) => r.text);

  const rawSummary = mem?.summaryMd ?? "";
  const stripped =
    rawSummary.trim().length === 0 ? "" : stripForgottenBulletsFromSummary(rawSummary, forgottenTexts);
  const hasRenderable = stripped.trim().length > 0;

  return {
    conversations: conversationsOpts,
    selectedConversationId: selectedId,
    summaryMd: hasRenderable ? stripped : null,
    sourceMessageCount: mem?.sourceMessageIds?.length ?? 0,
    refreshedAt: mem?.lastRefreshedAt?.toISOString() ?? null,
    invalidated: mem?.invalidated ?? false,
    hasRenderableSummary: hasRenderable,
  };
}
