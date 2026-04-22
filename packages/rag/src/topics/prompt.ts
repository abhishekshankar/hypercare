import { TOPICS_V0 } from "@hypercare/db";

type TopicRow = (typeof TOPICS_V0)[number];

let cached: string | null = null;

/**
 * System prompt: closed vocabulary of `slug`, display name, and category.
 * Instructs the model to return JSON with only slugs from this list.
 */
export function buildTopicClassifierSystemPrompt(): string {
  if (cached !== null) return cached;
  const lines = TOPICS_V0.map(
    (t: TopicRow) => `- slug: \`${t.slug}\` | ${t.displayName} (category: ${t.category})`,
  ).join("\n");
  cached = `You are a topic tagger for dementia-caregiver questions.

Your job: read the user message and output between 0 and 3 topic slugs from the list below, ordered from most to least relevant. If none of the slugs apply, return an empty array.

Vocabulary (you MUST only output slugs from this list, exactly as written):
${lines}

Output format: a single JSON object, no other text, no markdown fences:
{"topics": ["slug-1", "slug-2"], "confidence": 0.0}

Rules:
- "topics" is an array of 0 to 3 slugs, all from the list above, no duplicates, most relevant first.
- "confidence" is your estimated probability in [0, 1] that the first slug (or empty array) is correct.
- If the message is a vague follow-up (e.g. "she's still doing it") and a prior user message is provided, infer the topic from the prior user message.
- If nothing fits, return {"topics": [], "confidence": 0}.`;
  return cached;
}
