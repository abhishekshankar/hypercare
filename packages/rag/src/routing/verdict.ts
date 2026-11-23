import { TOPICS_V0 } from "@alongside/db";
import type { ClassifierVerdict, RoutingTopic } from "@alongside/model-router";

import type { Stage } from "../types.js";

const slugToCategory = new Map(TOPICS_V0.map((t) => [t.slug, t.category]));

function mapSlugToTopic(slug: string): RoutingTopic {
  const cat = slugToCategory.get(slug);
  if (slug === "medication-management") return "medication";
  if (cat === "medical") return "medical";
  if (cat === "behaviors") return "behavioral";
  if (cat === "caring_for_yourself") return "self_care";
  if (cat === "legal_financial" || cat === "transitions") return "logistics";
  if (cat === "daily_care" || cat === "communication") return "self_care";
  return "other";
}

function heuristicTopicFromQuestion(q: string): RoutingTopic | null {
  const s = q.toLowerCase();
  if (/\b(mg|mcg|dose|dosage|pill|tablet|medication|prescription|drug|interaction)\b/.test(s)) {
    return "medication";
  }
  if (/\b(symptom|diagnosis|hospital|doctor|nurse|pain|fever|infection)\b/.test(s)) {
    return "medical";
  }
  return null;
}

export type BuildVerdictInput = {
  classifiedTopics: string[];
  question: string;
  stage: Stage | null;
  /** When true, the composed prompt is a refusal-style template (rare on answer path). */
  isRefusalTemplate?: boolean;
};

/**
 * Maps MODULE-022 topic slugs + light lexical cues into the Layer-2-style
 * classifier verdict shape consumed by `@alongside/model-router`.
 */
export function buildClassifierVerdictForRouting(input: BuildVerdictInput): ClassifierVerdict {
  let topic: RoutingTopic = "other";
  for (const slug of input.classifiedTopics) {
    topic = mapSlugToTopic(slug);
    if (topic !== "other") break;
  }
  if (topic === "other" && input.classifiedTopics.length === 0) {
    topic = heuristicTopicFromQuestion(input.question) ?? "other";
  }

  return {
    topic,
    urgency: "normal",
    stage: input.stage,
    is_refusal_template: input.isRefusalTemplate ?? false,
  };
}
