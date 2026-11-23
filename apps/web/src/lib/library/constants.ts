/** PRD §7.1 order — `modules.category` values. */
export const LIBRARY_CATEGORY_ORDER = [
  "behaviors",
  "daily_care",
  "communication",
  "medical",
  "legal_financial",
  "transitions",
  "caring_for_yourself",
] as const;

export type LibraryCategory = (typeof LIBRARY_CATEGORY_ORDER)[number];

export const CATEGORY_SECTION_TITLES: Record<LibraryCategory, string> = {
  behaviors: "Behaviors",
  daily_care: "Daily care",
  communication: "Communication",
  medical: "Medical",
  legal_financial: "Legal & financial",
  transitions: "Transitions",
  caring_for_yourself: "Caring for yourself",
};
