import { TOPICS_V0 } from "@hypercare/db";
import { z } from "zod";
import { defaultInvoke } from "@hypercare/safety";

import { buildTopicClassifierSystemPrompt } from "./prompt.js";

type TopicRow = (typeof TOPICS_V0)[number];

const ALLOWED = new Set(TOPICS_V0.map((t: TopicRow) => t.slug));

const outSchema = z.object({
  topics: z.array(z.string()).max(3),
  confidence: z.number().min(0).max(1),
});

export type TopicClassifyInput = {
  userId: string;
  question: string;
  /** For short follow-ups: previous user line in the same thread. */
  priorUserTurn?: string | null;
};

export type TopicClassifyResult = {
  /** 0–3 slugs from the closed vocabulary, most relevant first. */
  topics: string[];
  /** Model-reported [0,1] when at least one topic; use 0 when short-circuited empty. */
  confidence: number;
};

export type TopicClassifyDeps = {
  /**
   * Bedrock (or test double). Same contract as the safety LLM: system + user message.
   * If omitted, `defaultInvoke` from `@hypercare/safety` is used.
   */
  invoke?: (input: { systemPrompt: string; userMessage: string }) => Promise<string>;
  warn?: (msg: string, ctx?: Record<string, unknown>) => void;
};

function stripFence(s: string): string {
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced ? (fenced[1] ?? s) : s;
}

function buildUserMessage(input: TopicClassifyInput): string {
  const q = input.question;
  if (input.priorUserTurn?.trim()) {
    return `Previous user message (for context on short follow-ups only):\n${input.priorUserTurn.trim()}\n\nCurrent user message:\n${q.trim()}`;
  }
  return q.trim();
}

/**
 * Classify a user question into 0–3 topic slugs from the seeded `topics` vocabulary.
 * Empty/whitespace short-circuits (no LLM). LLM errors downgrade to { topics: [], confidence: 0 }.
 */
export async function classifyTopics(
  input: TopicClassifyInput,
  deps: TopicClassifyDeps,
): Promise<TopicClassifyResult> {
  if (input.question.trim().length === 0) {
    return { topics: [], confidence: 0 };
  }

  const invoke = deps.invoke ?? defaultInvoke;
  const systemPrompt = buildTopicClassifierSystemPrompt();
  const userMessage = buildUserMessage(input);
  let raw: string;
  try {
    raw = await invoke({ systemPrompt, userMessage });
  } catch (err) {
    deps.warn?.("rag.topics.classifier.invoke_failed", {
      error: err instanceof Error ? err.message : String(err),
      userId: input.userId,
    });
    return { topics: [], confidence: 0 };
  }

  const cleaned = stripFence(raw).trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    deps.warn?.("rag.topics.classifier.parse_failed", {
      error: err instanceof Error ? err.message : String(err),
      preview: cleaned.slice(0, 120),
    });
    return { topics: [], confidence: 0 };
  }

  const zResult = outSchema.safeParse(parsed);
  if (!zResult.success) {
    deps.warn?.("rag.topics.classifier.schema_failed", {
      issues: zResult.error.issues.map((i) => i.message),
      preview: cleaned.slice(0, 120),
    });
    return { topics: [], confidence: 0 };
  }

  const { topics, confidence } = zResult.data;
  const filtered: string[] = [];
  for (const slug of topics) {
    if (ALLOWED.has(slug)) {
      if (!filtered.includes(slug)) filtered.push(slug);
    } else {
      deps.warn?.("rag.topics.classifier.off_vocab_slug", { slug, userId: input.userId });
    }
  }
  return { topics: filtered, confidence: filtered.length > 0 ? confidence : 0 };
}
