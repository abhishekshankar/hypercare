import type { ConversationMemoryForPrompt } from "./types.js";

export function sectionParseTighterUserPrefix(): string {
  return "Your last summary was not usable (too long, or it mentioned medications/diagnoses, or it quoted too much). Regenerate. Shorten aggressively; use exactly the four level-2 headings; stay under 300 words; no medication or diagnosis phrasing; paraphrase only.";
}

const H_CURRENT = /##\s*Current focus\s*([\s\S]*?)(?=^##\s|\s*$)/m;
const H_TRIED = /##\s*What's been tried\s*([\s\S]*?)(?=^##\s|\s*$)/m;
const H_OPEN = /##\s*Open threads\s*([\s\S]*?)(?=^##\s|\s*$)/m;
const H_SIG = /##\s*Signals the model should carry forward\s*([\s\S]*?)(?=\s*$)/m;

function sectionHasContent(block: string | undefined): boolean {
  if (!block) return false;
  const t = block.trim();
  if (t.length === 0) return false;
  if (/^—\s*\(none noted\)\.?\s*$/i.test(t)) return false;
  return true;
}

export function parseMemorySections(
  summaryMd: string,
): ConversationMemoryForPrompt["sections"] {
  const a = H_CURRENT.exec(summaryMd);
  const b = H_TRIED.exec(summaryMd);
  const c = H_OPEN.exec(summaryMd);
  const d = H_SIG.exec(summaryMd);
  return {
    hasCurrentFocus: sectionHasContent(a?.[1]),
    hasWhatsTried: sectionHasContent(b?.[1]),
    hasOpenThreads: sectionHasContent(c?.[1]),
    hasSignals: sectionHasContent(d?.[1]),
  };
}
