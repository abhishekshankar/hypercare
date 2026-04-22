import type { RetrievedChunk, Stage } from "@hypercare/rag";

const BASE = {
  moduleId: "00000000-0000-0000-0000-000000000001",
  attributionLine: "Eval fixture — 2024.",
} as const;

const MODULES: Record<
  "behavior" | "daily" | "self",
  {
    moduleSlug: string;
    moduleTitle: string;
    category: string;
    stages: readonly Stage[];
  }
> = {
  behavior: {
    moduleSlug: "behavior-sundowning",
    moduleTitle: "Sundowning: afternoon and evening agitation",
    category: "behaviors",
    stages: ["early", "middle"],
  },
  daily: {
    moduleSlug: "daily-bathing-resistance",
    moduleTitle: "When bathing is a battle",
    category: "daily_care",
    stages: ["middle", "late"],
  },
  self: {
    moduleSlug: "self-care-caregiver-burnout",
    moduleTitle: "Caregiver burnout: when the tank is empty",
    category: "caring_for_yourself",
    stages: ["early", "middle", "late"],
  },
} as const;

export function makeRetrievedChunk(
  key: keyof typeof MODULES,
  opts: { chunkId: string; distance: number; chunkIndex: number; content: string; sectionHeading: string },
): RetrievedChunk {
  const m = MODULES[key];
  return {
    chunkId: opts.chunkId,
    moduleId: BASE.moduleId,
    moduleSlug: m.moduleSlug,
    moduleTitle: m.moduleTitle,
    moduleTier: 1,
    category: m.category,
    attributionLine: BASE.attributionLine,
    sectionHeading: opts.sectionHeading,
    stageRelevance: m.stages,
    chunkIndex: opts.chunkIndex,
    content: opts.content,
    distance: opts.distance,
  };
}
