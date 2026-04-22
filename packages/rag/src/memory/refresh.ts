import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { conversationMemory, createDbClient, messages } from "@hypercare/db";

import { MEMORY_MAX_TOKENS, MEMORY_MODEL_ID, MEMORY_MODEL_REGION, MEMORY_REFRESH_EVERY_N } from "../config.js";
import type { GenerateInput, GenerateOutput } from "../bedrock/claude.js";
import { parseMemorySections, sectionParseTighterUserPrefix } from "./section-parse.js";
import { verifyMemorySummaryBannedContent } from "./verify-banned.js";
import { estimateTokenCount } from "./tokens.js";
import type { MemoryRefreshLog } from "./types.js";

const _dir = dirname(fileURLToPath(import.meta.url));
let cachedSystem: string | null = null;
function getMemorySystemPrompt(): string {
  if (cachedSystem) return cachedSystem;
  const p = join(_dir, "prompt.md");
  cachedSystem = readFileSync(p, "utf8");
  return cachedSystem;
}

function buildTranscriptLines(
  rows: Array<{ role: string; content: string }>,
): string {
  const out: string[] = [];
  for (const r of rows) {
    const label = r.role === "user" ? "Caregiver" : "Assistant";
    out.push(`${label}: ${r.content.trim()}`);
  }
  return out.join("\n\n");
}

export function shouldRunMemoryRefresh(
  args: {
    userMessageCountAfterThisTurn: number;
    memoryInvalidated: boolean;
  },
  everyN: number = MEMORY_REFRESH_EVERY_N,
): boolean {
  if (args.memoryInvalidated) return true;
  if (args.userMessageCountAfterThisTurn < everyN) return false;
  return args.userMessageCountAfterThisTurn % everyN === 0;
}

export type MemoryRefreshGenerate = (input: GenerateInput) => Promise<GenerateOutput>;

export type RunConversationMemoryRefreshInput = {
  databaseUrl: string;
  conversationId: string;
  userId: string;
  userMessageCount: number;
  generate: MemoryRefreshGenerate;
  warn?: (msg: string, ctx?: Record<string, unknown>) => void;
  log?: (e: MemoryRefreshLog) => void;
  refreshEveryN?: number;
};

export async function runConversationMemoryRefresh(
  input: RunConversationMemoryRefreshInput,
): Promise<void> {
  const t0 = Date.now();
  const everyN = input.refreshEveryN ?? MEMORY_REFRESH_EVERY_N;
  const db = createDbClient(input.databaseUrl);

  const [memRow] = await db
    .select({
      invalidated: conversationMemory.invalidated,
      refreshCount: conversationMemory.refreshCount,
      summaryMd: conversationMemory.summaryMd,
    })
    .from(conversationMemory)
    .where(
      and(
        eq(conversationMemory.conversationId, input.conversationId),
        eq(conversationMemory.userId, input.userId),
      ),
    )
    .limit(1);

  const previousSummary = memRow?.summaryMd ?? null;
  const previousRefreshCount = memRow?.refreshCount ?? 0;
  const invalidated = memRow?.invalidated ?? false;

  if (
    !shouldRunMemoryRefresh(
      {
        userMessageCountAfterThisTurn: input.userMessageCount,
        memoryInvalidated: invalidated,
      },
      everyN,
    )
  ) {
    return;
  }

  const recent = await db
    .select({
      id: messages.id,
      role: messages.role,
      content: messages.content,
    })
    .from(messages)
    .where(
      and(eq(messages.conversationId, input.conversationId), inArray(messages.role, ["user", "assistant"])),
    )
    .orderBy(desc(messages.createdAt))
    .limit(6);

  recent.reverse();
  if (recent.length === 0) {
    return;
  }

  const systemPrompt = getMemorySystemPrompt();
  const transcript = buildTranscriptLines(recent);
  const sourceIds = recent.map((r) => r.id);
  const userMessage = `Here are the most recent messages in the conversation (oldest first). Summarize for the four headings in your instructions.\n\n${transcript}`;

  const tryOnce = async (tight: boolean) => {
    const up = tight ? `${sectionParseTighterUserPrefix()}\n\n${userMessage}` : userMessage;
    return input.generate({
      systemPrompt,
      userPrompt: up,
      maxTokens: 600,
      temperature: 0.1,
      modelId: MEMORY_MODEL_ID,
      region: MEMORY_MODEL_REGION,
    });
  };

  const isBad = (body: string) =>
    verifyMemorySummaryBannedContent(body).ok === false || estimateTokenCount(body) > MEMORY_MAX_TOKENS;

  let out = await tryOnce(false);
  let text = out.text.trim();
  if (isBad(text)) {
    out = await tryOnce(true);
    text = out.text.trim();
  }

  if (isBad(text)) {
    if (previousSummary) {
      input.warn?.("rag.memory.fallback_prior", { conversationId: input.conversationId, reason: "banned_or_overflow" });
      await db
        .insert(conversationMemory)
        .values({
          conversationId: input.conversationId,
          userId: input.userId,
          summaryMd: previousSummary,
          summaryTokens: estimateTokenCount(previousSummary),
          lastRefreshedAt: new Date(),
          refreshCount: previousRefreshCount,
          invalidated: false,
          sourceMessageIds: sourceIds,
        })
        .onConflictDoUpdate({
          target: conversationMemory.conversationId,
          set: {
            summaryMd: previousSummary,
            summaryTokens: estimateTokenCount(previousSummary),
            lastRefreshedAt: new Date(),
            refreshCount: previousRefreshCount,
            invalidated: false,
            sourceMessageIds: sourceIds,
            userId: input.userId,
          },
        });
    } else {
      input.warn?.("rag.memory.refresh_aborted", { conversationId: input.conversationId, reason: "banned_or_overflow" });
    }
    return;
  }

  const summaryTokens = estimateTokenCount(text);
  const newRefreshCount = previousRefreshCount + 1;
  const sections = parseMemorySections(text);
  const latencyMs = Date.now() - t0;

  await db
    .insert(conversationMemory)
    .values({
      conversationId: input.conversationId,
      userId: input.userId,
      summaryMd: text,
      summaryTokens,
      lastRefreshedAt: new Date(),
      refreshCount: newRefreshCount,
      invalidated: false,
      sourceMessageIds: sourceIds,
    })
    .onConflictDoUpdate({
      target: conversationMemory.conversationId,
      set: {
        summaryMd: text,
        summaryTokens,
        lastRefreshedAt: new Date(),
        refreshCount: newRefreshCount,
        invalidated: false,
        sourceMessageIds: sourceIds,
        userId: input.userId,
      },
    });

  input.log?.({
    conversationId: input.conversationId,
    userId: input.userId,
    summaryTokens,
    refreshCount: newRefreshCount,
    latencyMs,
    sourceMessageCount: sourceIds.length,
  });

  input.warn?.("rag.memory.context_sections", {
    conversation_id: input.conversationId,
    has_current_focus: sections.hasCurrentFocus,
    has_what_tried: sections.hasWhatsTried,
    has_open_threads: sections.hasOpenThreads,
    has_signals: sections.hasSignals,
  });
}

export async function countUserMessagesInConversation(
  databaseUrl: string,
  conversationId: string,
): Promise<number> {
  const db = createDbClient(databaseUrl);
  const [r] = await db
    .select({ n: count() })
    .from(messages)
    .where(and(eq(messages.conversationId, conversationId), eq(messages.role, "user")));
  return Number(r?.n ?? 0);
}
