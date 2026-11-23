import { TOPICS_V0 } from "@alongside/db";
import { getToolSchemaForType } from "../tools/index.js";
import type { ParsedHeavyModule } from "./parse-heavy-module-from-disk.js";

const topicSet = new Set(TOPICS_V0.map((t) => t.slug));

export type HeavyModuleValidationResult = {
  errors: string[];
  warnings: string[];
};

function collectClaimAnchors(markdown: string): Set<string> {
  const out = new Set<string>();
  const re = /\[(\d+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    out.add(`[${m[1]!}]`);
  }
  return out;
}

/** Body segments after `<!-- provenance: composite -->` until the next provenance HTML comment or EOF. */
function extractCompositeBlocks(markdown: string): string[] {
  const re = /<!--\s*provenance:\s*composite\s*-->\s*([\s\S]*?)(?=<!--\s*provenance:|$)/gi;
  const blocks: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    blocks.push(m[1]!);
  }
  return blocks;
}

/**
 * First-person inside **quote markers** in `provenance: composite` passages (Hermes-02).
 * Quote-open patterns only — no `, I` / `; I` (false positives on third-person dialogue like
 * `Tuesday, I realized` inside a scripted quote). Skips bold action lines, bullets, `opening:`;
 * ignores editorial `… to "I…` / `… from "I…` handoffs.
 */
function compositeFirstPersonQuoteViolations(block: string, label: string): string[] {
  const out: string[] = [];
  const re = /["'""''`](\s*)I\b|["'""''`]I[,`\s]|`I\b|’I\b|'I\b/gi;

  let lineStart = 0;
  for (const rawLine of block.split("\n")) {
    const line = rawLine;

    if (/^\s*-\s/.test(line)) {
      lineStart += rawLine.length + 1;
      continue;
    }
    if (/^\s*\*\*/.test(line)) {
      lineStart += rawLine.length + 1;
      continue;
    }
    if (/opening:/i.test(line)) {
      lineStart += rawLine.length + 1;
      continue;
    }

    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      const idx = lineStart + m.index;
      const lead = block.slice(Math.max(0, idx - 16), idx);
      const matched = m[0] ?? "";
      if (matched.startsWith('"') || matched.startsWith("'") || matched.startsWith("”") || matched.startsWith("’")) {
        if (/\bto\s+$/i.test(lead) || /\bfrom\s+$/i.test(lead)) {
          continue;
        }
      }
      out.push(
        `${label}: composite passage may contain first-person quoted voice at offset ${String(idx)} (matched: ${JSON.stringify(matched)})`,
      );
      return out;
    }
    lineStart += rawLine.length + 1;
  }
  return out;
}

export function validateHeavyModule(
  parsed: ParsedHeavyModule,
  existingModuleSlugs: ReadonlySet<string>,
): HeavyModuleValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { front, bodyMd, branches, tools, evidence, relations } = parsed;

  const hasAnyBranch = branches.some(
    (b) => b.stageKey === "any" && b.relationshipKey === "any" && b.livingSituationKey === "any",
  );
  if (!hasAnyBranch) {
    errors.push("heavy module requires an (any, any, any) fallback branch");
  }

  const anchors = new Set<string>();
  for (const a of collectClaimAnchors(bodyMd)) anchors.add(a);
  for (const b of branches) {
    for (const a of collectClaimAnchors(b.bodyMd)) anchors.add(a);
  }

  const evidenceAnchors = new Map<string, (typeof evidence)[number]>();
  for (const row of evidence) {
    evidenceAnchors.set(row.claim_anchor, row);
  }
  for (const a of anchors) {
    const row = evidenceAnchors.get(a);
    if (!row) {
      errors.push(`missing evidence row for claim anchor ${a}`);
      continue;
    }
    if (!row.quoted_excerpt?.trim()) {
      errors.push(`evidence ${a}: quoted_excerpt required`);
    }
    if (!row.url?.trim()) {
      errors.push(`evidence ${a}: url required`);
    }
  }

  for (const t of tools) {
    const schema = (() => {
      try {
        return getToolSchemaForType(t.toolType);
      } catch {
        return null;
      }
    })();
    if (!schema) {
      errors.push(`unknown tool_type ${t.toolType} for tool ${t.slug}`);
      continue;
    }
    const r = schema.safeParse(t.payload);
    if (!r.success) {
      errors.push(`tool ${t.slug} (${t.toolType}): ${r.error.message}`);
    }
  }

  const primary = front.primary_topics ?? front.topics;
  const secondary = front.secondary_topics ?? [];
  if (primary.length > 12) {
    errors.push("primary_topics/topics: at most 12 slugs");
  } else if (primary.length > 8) {
    warnings.push(
      `primary_topics: ${String(primary.length)} slugs (spec target ≤4; counts above 8 risk prompt dilution — tighten when possible)`,
    );
  } else if (primary.length > 4) {
    warnings.push(
      `primary_topics: ${String(primary.length)} slugs (spec target ≤4; soft warning for counts 5–8 so prompts can tighten without blocking ingestion)`,
    );
  }
  if (secondary.length > 8) errors.push("secondary_topics: at most 8 slugs");
  const allTopics = [...new Set([...primary, ...secondary])];
  for (const s of allTopics) {
    if (!topicSet.has(s)) errors.push(`unknown topic slug: ${s}`);
  }

  if (relations.module_slug !== front.slug) {
    errors.push(`relations.module_slug (${relations.module_slug}) must match module slug (${front.slug})`);
  }
  for (const edge of relations.edges) {
    if (!existingModuleSlugs.has(edge.to_module_slug)) {
      errors.push(`relation target module not found: ${edge.to_module_slug}`);
    }
  }

  for (const block of extractCompositeBlocks(bodyMd)) {
    errors.push(...compositeFirstPersonQuoteViolations(block, "module.md"));
  }
  for (let i = 0; i < branches.length; i++) {
    const b = branches[i]!;
    for (const block of extractCompositeBlocks(b.bodyMd)) {
      errors.push(
        ...compositeFirstPersonQuoteViolations(
          block,
          `branch ${String(i)} (${b.stageKey}/${b.relationshipKey}/${b.livingSituationKey})`,
        ),
      );
    }
  }

  return { errors, warnings };
}
