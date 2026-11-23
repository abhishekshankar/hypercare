import { z } from "zod";

export const checklistItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  rationale: z.string().min(1),
  what_to_look_for: z.string().min(1),
});

export const ChecklistSchema = z.object({
  tool_type: z.literal("checklist"),
  slug: z.string().min(1),
  title: z.string().min(1),
  context: z.string().min(1),
  items: z.array(checklistItemSchema).min(1),
});

export type Checklist = z.infer<typeof ChecklistSchema>;
