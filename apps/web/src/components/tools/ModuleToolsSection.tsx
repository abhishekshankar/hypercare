"use client";

import { getToolSchemaForType } from "@alongside/content/tools";

import type { ModuleToolRow } from "@/lib/library/load-module";

import { ChecklistTool } from "./checklist";
import { DecisionTreeTool } from "./decision-tree";
import { FlowchartTool } from "./flowchart";
import { ScriptTool } from "./script";
import { TemplateTool } from "./template";

export function ModuleToolsSection({ tools }: Readonly<{ tools: ModuleToolRow[] }>) {
  if (tools.length === 0) return null;
  return (
    <div className="space-y-6" data-testid="module-tools">
      {tools.map((t) => (
        <div key={t.id}>
          <ToolRenderer row={t} />
        </div>
      ))}
    </div>
  );
}

function ToolRenderer({ row }: Readonly<{ row: ModuleToolRow }>) {
  if (row.toolType === "decision_tree") {
    const p = row.payload as Record<string, unknown>;
    if (Array.isArray(p.nodes)) {
      return <DecisionTreeTool payload={{ ...p, title: row.title }} />;
    }
  }
  const schema = getToolSchemaForType(row.toolType);
  const merged = { ...((row.payload as object) ?? {}), tool_type: row.toolType, slug: row.slug, title: row.title };
  const parsed = schema.safeParse(merged);
  if (!parsed.success) {
    return (
      <p className="text-sm text-muted-foreground">
        Tool &ldquo;{row.title}&rdquo; could not be loaded ({parsed.error.message.slice(0, 120)}).
      </p>
    );
  }
  switch (row.toolType) {
    case "checklist":
      return <ChecklistTool data={parsed.data as never} />;
    case "script":
      return <ScriptTool data={parsed.data as never} />;
    case "template":
      return <TemplateTool data={parsed.data as never} />;
    case "flowchart":
      return <FlowchartTool data={parsed.data as never} />;
    default:
      return null;
  }
}
