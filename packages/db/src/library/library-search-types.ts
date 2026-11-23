export type LibraryModuleListItem = {
  slug: string;
  title: string;
  summary: string;
  category: string;
  stageRelevance: string[];
  topicTags: { slug: string; displayName: string }[];
};

export type LibrarySearchCandidateKind = "saved_answer" | "recent_topic" | "bookmarked_module";

/**
 * One searchable row in the library index (TASK-041).
 * `module` is set for `bookmarked_module` so the web client can render `ModuleCard`.
 */
export type LibrarySearchCandidate = {
  kind: LibrarySearchCandidateKind;
  id: string;
  title: string;
  snippet: string;
  /** Lowercased haystack for substring scoring (must match client `searchHaystack` for modules). */
  haystack: string;
  source: string;
  module?: LibraryModuleListItem;
  /** Conversation + assistant message for deep-linking saved answers (optional). */
  conversationId?: string;
  messageId?: string;
};
