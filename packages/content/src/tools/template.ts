import { z } from "zod";

export const templateFieldSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    kind: z.string().min(1),
  })
  .passthrough();

export const TemplateSchema = z.object({
  tool_type: z.literal("template"),
  slug: z.string().min(1),
  title: z.string().min(1),
  fields: z.array(templateFieldSchema).min(1),
  instructions: z.string().min(1),
});

export type Template = z.infer<typeof TemplateSchema>;
