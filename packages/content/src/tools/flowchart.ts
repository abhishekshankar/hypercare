import { z } from "zod";

const flowId = z.union([z.string().min(1), z.number()]);

export const FlowchartNodeSchema = z.object({
  id: flowId,
  step: z.string().min(1),
  next: z.array(flowId).default([]),
});

export const FlowchartSchema = z.object({
  tool_type: z.literal("flowchart"),
  slug: z.string().min(1),
  title: z.string().min(1),
  nodes: z.array(FlowchartNodeSchema).min(1),
});

export type Flowchart = z.infer<typeof FlowchartSchema>;
