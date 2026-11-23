"use client";

import { useMemo, useState } from "react";

type Opt = { text: string; next_node: string };
type Node = {
  id: string;
  prompt: string;
  options?: Opt[];
  outcome?: string | null;
};

function isWizardNodes(payload: Record<string, unknown>): payload is { nodes: Node[] } {
  const n = payload.nodes;
  return Array.isArray(n) && n.length > 0 && typeof (n[0] as Node)?.prompt === "string";
}

export function DecisionTreeTool({ payload }: Readonly<{ payload: Record<string, unknown> }>) {
  const wizardPayload = isWizardNodes(payload) ? payload : undefined;
  const nodeList = wizardPayload?.nodes;
  const nodes = useMemo(() => new Map((nodeList ?? []).map((x) => [x.id, x])), [nodeList]);
  const [cur, setCur] = useState(() => nodeList?.[0]?.id ?? "start");

  if (!wizardPayload) {
    return (
      <p className="text-sm text-muted-foreground">
        This decision tree uses a legacy format we cannot render yet.
      </p>
    );
  }

  const node = nodes.get(cur);
  if (!node) return null;

  return (
    <section className="rounded-lg border border-border bg-muted/15 px-4 py-4" data-testid="tool-decision-tree">
      <h2 className="font-serif text-lg font-medium text-foreground">
        {String((wizardPayload as { title?: string }).title ?? "Decision guide")}
      </h2>
      <p className="mt-4 text-base text-foreground">{node.prompt}</p>
      {node.outcome ? <p className="mt-3 text-sm text-muted-foreground">{node.outcome}</p> : null}
      {node.options && node.options.length > 0 ? (
        <div className="mt-4 flex flex-col gap-2">
          {node.options.map((o) => (
            <button
              key={o.text}
              className="rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-accent/20"
              onClick={() => setCur(o.next_node)}
              type="button"
            >
              {o.text}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
