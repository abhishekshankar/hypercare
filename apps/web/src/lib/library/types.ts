export type StageKey = "early" | "middle" | "late";

export type LibraryModuleListItem = {
  slug: string;
  title: string;
  summary: string;
  category: string;
  stageRelevance: string[];
  topicTags: { slug: string; displayName: string }[];
};
