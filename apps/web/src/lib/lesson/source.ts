const SOURCES = new Set(["weekly_focus", "library_browse", "search", "conversation_link"]);

export type LessonSource = "weekly_focus" | "library_browse" | "search" | "conversation_link";

export function parseLessonSource(raw: string | null): LessonSource {
  if (raw != null && SOURCES.has(raw)) {
    return raw as LessonSource;
  }
  return "library_browse";
}
