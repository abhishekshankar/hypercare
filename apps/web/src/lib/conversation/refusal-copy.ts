/**
 * User-visible copy for every `RefusalReason.code` (TASK-011 §"Refusal UX").
 *
 * Centralised so the strings are reviewable in one place — refusal copy is
 * trust-critical surface area and we deliberately avoid generic "something
 * went wrong" messaging anywhere except `internal_error`.
 *
 * The `safety_triaged` reason has its own dedicated component (TriageCard)
 * — this table only carries the message text used by other reasons.
 */

import type { RefusalReason } from "@alongside/rag";

export type NonTriageRefusalCode = Exclude<RefusalReason["code"], "safety_triaged">;

export type RefusalCopy = {
  /** Card body. */
  body: string;
  /** Optional sub-action shown beside the "See resources" link. */
  secondaryActionLabel?: string;
};

export const REFUSAL_COPY: Record<NonTriageRefusalCode, RefusalCopy> = {
  no_content: {
    body:
      "I don’t have anything for that question yet. Our content library is growing — try a different phrasing, or see Help.",
  },
  low_confidence: {
    body:
      "I’m not confident enough to answer that from what I’ve got. Try a more specific question, or see Help.",
  },
  off_topic: {
    body:
      "That’s outside what I can help with. I’m focused on day-to-day caregiving for someone with dementia.",
  },
  uncitable_response: {
    body:
      "Something went wrong answering that. I don’t want to guess — please try again.",
    secondaryActionLabel: "Report this",
  },
  internal_error: {
    body: "Something broke on our end. Try again in a moment.",
  },
  verifier_rejected: {
    body:
      "I wasn’t able to write a safe answer to that. Try asking in a different way, or see Help.",
  },
  user_cancelled: {
    body: "You cancelled this reply. Send another message whenever you’re ready.",
  },
};

/** Display headings paired with each card so screen readers announce intent. */
export const REFUSAL_HEADINGS: Record<NonTriageRefusalCode, string> = {
  no_content: "I can’t answer this yet",
  low_confidence: "Not confident enough",
  off_topic: "Outside what I can help with",
  uncitable_response: "Couldn’t finish that answer",
  internal_error: "Something broke",
  verifier_rejected: "Couldn’t finish safely",
  user_cancelled: "Reply cancelled",
};
