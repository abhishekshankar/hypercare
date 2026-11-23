/**
 * API shape for saved-answer list items (TASK-030).
 */
export type SavedItem = {
  id: string;
  message_id: string;
  conversation_id: string;
  saved_at: string;
  note?: string;
  assistant_text_preview: string;
  question_text: string;
  module_slugs: string[];
  /** Conversation title, or null when unset */
  conversation_title: string | null;
};
