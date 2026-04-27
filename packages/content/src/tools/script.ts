import { z } from "zod";

export const ScriptSchema = z.object({
  tool_type: z.literal("script"),
  slug: z.string().min(1),
  title: z.string().min(1),
  context: z.string().min(1),
  openings: z.array(z.string().min(1)).min(1),
  if_they: z
    .array(
      z.object({
        response: z.string().min(1),
        what_to_say: z.string().min(1),
      }),
    )
    .min(1),
  things_not_to_say: z.array(z.string().min(1)).min(1),
});

export type Script = z.infer<typeof ScriptSchema>;
