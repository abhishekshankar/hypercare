/**
 * Preview strings for saved-answer list UI (TASK-030).
 * Strips common markdown so lists show plain sentences.
 */
const MD_HEADING = /^#{1,6}\s+/gm;
const MD_BOLD = /\*\*([^*]+)\*\*/g;
const MD_ITALIC = /_([^_]+)_/g;

function stripForPreview(raw: string): string {
  let s = raw.replace(MD_HEADING, "");
  s = s.replace(MD_BOLD, "$1");
  s = s.replace(MD_ITALIC, "$1");
  s = s.replace(/\n+/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max).trimEnd() + "…";
}

export function buildAssistantPreview(assistantText: string, maxChars: number): string {
  return truncate(stripForPreview(assistantText), maxChars);
}
