/**
 * TASK-040: one source of truth for lesson “cards” (6 slides) and their SSE `card` events.
 * Transport-only: content is pre-authored markdown (see ADR 0029).
 */
import { pickCoreSections, splitBodyIntoSections } from "@/lib/lesson/load";

import type { ModulePagePayload } from "@/lib/library/load-module";

export type LessonSseCardKind = "intro" | "content" | "technique" | "recap" | "check_in";

export type SlideData =
  | { kind: "setup"; title: string; line: string; stageNote?: string }
  | { kind: "core"; title: string; body: string }
  | { kind: "try"; text: string }
  | { kind: "close" };

export type StreamCard = {
  index: number;
  kind: LessonSseCardKind;
  body_md: string;
};

function streamKindForSlideIndex(index: number, slideKind: SlideData["kind"]): LessonSseCardKind {
  if (slideKind === "setup") return "intro";
  if (slideKind === "try") return "check_in";
  if (slideKind === "close") {
    // Second `check_in` in the 6-card set (TASK-040): empty body, client shows close actions.
    return "check_in";
  }
  if (slideKind === "core") {
    if (index === 1) return "content";
    if (index === 2) return "technique";
    return "recap";
  }
  return "content";
}

export function buildLessonSlidesData(
  mod: ModulePagePayload,
  crFirstName: string | null,
  userStage: "early" | "middle" | "late" | null,
): SlideData[] {
  const sections = splitBodyIntoSections(mod.bodyMd);
  const core = pickCoreSections(sections, mod.summary);
  const name = crFirstName?.trim() ?? null;
  const line =
    name != null && name.length > 0
      ? `Why this matters for ${name} — a short, practical path you can use this week.`
      : "Why this matters — a short, practical path you can use this week.";

  let stageNote: string | undefined;
  if (userStage && mod.stageRelevance.includes(userStage)) {
    const label = userStage === "early" ? "Early" : userStage === "middle" ? "Middle" : "Late";
    stageNote = `This topic often comes up in the ${label} stage — you’re in good company.`;
  }

  const tryText = mod.tryThisToday?.trim() ?? "Try one thing from this lesson today, even a small one.";

  const setup: SlideData = stageNote
    ? { kind: "setup", title: mod.title, line, stageNote }
    : { kind: "setup", title: mod.title, line };
  return [
    setup,
    { kind: "core", title: core[0]!.title, body: core[0]!.body },
    { kind: "core", title: core[1]!.title, body: core[1]!.body },
    { kind: "core", title: core[2]!.title, body: core[2]!.body },
    { kind: "try", text: tryText },
    { kind: "close" },
  ];
}

export function slideToStreamCard(index: number, s: SlideData): StreamCard {
  const kind = streamKindForSlideIndex(index, s.kind);
  let body_md = "";
  if (s.kind === "setup") {
    const stage = s.stageNote != null && s.stageNote.length > 0 ? `\n\n${s.stageNote}` : "";
    body_md = `# ${s.title}\n\n${s.line}${stage}`;
  } else if (s.kind === "core") {
    body_md = `## ${s.title}\n\n${s.body}`;
  } else if (s.kind === "try") {
    body_md = s.text;
  } else {
    body_md = "";
  }
  return { index, kind, body_md };
}

export function slidesToStreamCards(slides: SlideData[]): StreamCard[] {
  return slides.map((s, i) => slideToStreamCard(i, s));
}

/**
 * Yields the same `StreamCard[]` as `slidesToStreamCards` but allows the network
 * to flush between cards (perceived progressive paint on the client).
 */
export async function* streamLessonCards(
  mod: ModulePagePayload,
  crFirstName: string | null,
  userStage: "early" | "middle" | "late" | null,
): AsyncIterable<StreamCard> {
  const slides = buildLessonSlidesData(mod, crFirstName, userStage);
  for (let i = 0; i < slides.length; i++) {
    await Promise.resolve();
    yield slideToStreamCard(i, slides[i]!);
  }
}

/**
 * Synchronous “legacy slicer” output for property tests: same as `[...streamLessonCards]` in order.
 */
export function materializeStreamCards(
  mod: ModulePagePayload,
  crFirstName: string | null,
  userStage: "early" | "middle" | "late" | null,
): StreamCard[] {
  return slidesToStreamCards(buildLessonSlidesData(mod, crFirstName, userStage));
}

/**
 * Reconstructs `SlideData` from an SSE `card` payload (inverse of `slideToStreamCard`).
 */
export function streamCardToSlideData(c: StreamCard): SlideData {
  if (c.kind === "check_in" && c.index === 5) {
    return { kind: "close" };
  }
  if (c.kind === "check_in" && c.index === 4) {
    return { kind: "try", text: c.body_md || " " };
  }
  if (c.kind === "intro") {
    const text = c.body_md.replace(/\r\n/g, "\n");
    const blocks = text
      .split("\n\n")
      .map((b) => b.trim())
      .filter((b) => b.length > 0);
    const h1 = blocks[0] ?? "# Lesson";
    const title = /^#\s+/.test(h1) ? h1.replace(/^#\s+/, "").trim() : h1;
    return {
      kind: "setup",
      title: title || "Lesson",
      line: blocks[1] ?? " ",
      ...(blocks[2] != null && blocks[2]!.length > 0 ? { stageNote: blocks[2] } : {}),
    };
  }
  if (c.kind === "content" || c.kind === "technique" || c.kind === "recap") {
    const body = c.body_md.replace(/\r\n/g, "\n");
    const m = /^##\s+([^\n]+)\n+([\s\S]+)$/.exec(body);
    if (m) {
      return { kind: "core", title: m[1]!.trim(), body: m[2]!.trim() || " " };
    }
    return { kind: "core", title: "Core", body: body.trim() || " " };
  }
  return { kind: "close" };
}
