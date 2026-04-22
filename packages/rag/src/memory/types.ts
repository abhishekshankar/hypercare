/** Row shape for prompt injection (invalidated rows are never passed here). */
export type ConversationMemoryForPrompt = {
  summaryMd: string;
  /** Which sections had substantive content (for observability). */
  sections: {
    hasCurrentFocus: boolean;
    hasWhatsTried: boolean;
    hasOpenThreads: boolean;
    hasSignals: boolean;
  };
};

export type MemoryRefreshLog = {
  conversationId: string;
  userId: string;
  summaryTokens: number;
  refreshCount: number;
  latencyMs: number;
  sourceMessageCount: number;
};
