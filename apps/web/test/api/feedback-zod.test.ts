import { describe, expect, it } from "vitest";
import { z } from "zod";

/**
 * Shapes mirroring app routes (TASK-036) — no DB; guards contract drift.
 */
const feedbackPost = z.object({
  kind: z.enum(["off_reply", "not_found", "suggestion", "other"]),
  body: z.string().max(2000),
  include_context: z.boolean().optional().default(false),
  message_id: z.string().uuid().optional().nullable(),
});

const triagePost = z.object({
  state: z.enum([
    "new",
    "reading",
    "needs_content_fix",
    "needs_classifier_fix",
    "needs_product_fix",
    "ack_and_close",
    "spam_or_invalid",
  ]),
  resolution_note: z.string().max(8000).optional(),
  linked_module_id: z.string().uuid().optional().nullable(),
  linked_task_id: z.string().regex(/^TASK-\d+$/i).optional().nullable(),
});

describe("feedback API shapes", () => {
  it("accepts minimal feedback body", () => {
    const p = feedbackPost.parse({
      kind: "not_found",
      body: "hello",
    });
    expect(p.include_context).toBe(false);
  });
  it("validates task id pattern", () => {
    expect(() =>
      triagePost.parse({ state: "new", resolution_note: "x", linked_task_id: "not-a-task" }),
    ).toThrow();
    expect(
      triagePost.parse({ state: "new", linked_task_id: "TASK-036" }).linked_task_id,
    ).toBe("TASK-036");
  });
});
