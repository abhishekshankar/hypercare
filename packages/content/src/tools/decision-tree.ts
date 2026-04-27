import { z } from "zod";

/** Node payload: either a branching question or a terminal outcome (Hermes tools prompt). */
export type DecisionTreeNode = Record<string, unknown>;

export const DecisionTreeSchema = z.object({
  tool_type: z.literal("decision_tree"),
  slug: z.string().min(1),
  title: z.string().min(1),
  root: z.string().min(1),
  nodes: z.record(z.string(), z.record(z.string(), z.unknown())),
});

export type DecisionTree = z.infer<typeof DecisionTreeSchema>;
