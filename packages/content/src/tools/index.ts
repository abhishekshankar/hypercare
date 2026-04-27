import { z } from "zod";
import { ChecklistSchema } from "./checklist.js";
import { DecisionTreeSchema } from "./decision-tree.js";
import { FlowchartSchema } from "./flowchart.js";
import { ScriptSchema } from "./script.js";
import { TemplateSchema } from "./template.js";

export { ChecklistSchema, type Checklist } from "./checklist.js";
export { DecisionTreeSchema, type DecisionTree, type DecisionTreeNode } from "./decision-tree.js";
export { FlowchartSchema, type Flowchart } from "./flowchart.js";
export { ScriptSchema, type Script } from "./script.js";
export { TemplateSchema, type Template } from "./template.js";

export const TOOL_TYPES = ["decision_tree", "checklist", "script", "template", "flowchart"] as const;

export type ToolType = (typeof TOOL_TYPES)[number];

export function getToolSchemaForType(toolType: string): z.ZodTypeAny {
  switch (toolType) {
    case "checklist":
      return ChecklistSchema;
    case "decision_tree":
      return DecisionTreeSchema;
    case "script":
      return ScriptSchema;
    case "template":
      return TemplateSchema;
    case "flowchart":
      return FlowchartSchema;
    default:
      return z.never();
  }
}
