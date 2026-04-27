import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { z } from "zod";
import { heavyDiskFrontmatterSchema } from "../schema.js";

const branchFmSchema = z
  .object({
    branch_key: z.string().optional(),
    stage: z.enum(["early", "middle", "late", "any"]),
    relationship: z.enum(["parent", "spouse", "sibling", "in_law", "other", "any"]),
    living_situation: z.enum([
      "with_caregiver",
      "alone",
      "with_other_family",
      "assisted_living",
      "memory_care",
      "nursing_home",
      "any",
    ]),
    try_this_today: z.string().optional(),
  })
  .passthrough();

const evidenceRowSchema = z.object({
  claim_anchor: z.string().min(1),
  claim_text: z.string().min(1),
  source_id: z.string().min(1),
  source_title: z.string().min(1),
  tier: z.union([z.number(), z.string()]).transform((t) => (typeof t === "string" ? Number.parseInt(t, 10) : t)),
  url: z.string().min(1),
  url_status: z.union([z.number(), z.string()]).optional(),
  url_snapshot_path: z.string().optional(),
  page_or_section: z.string().optional(),
  quoted_excerpt: z.string().min(1),
  reviewer: z.string().nullable().optional(),
  reviewer_credential: z.string().nullable().optional(),
  reviewed_on: z.string().nullable().optional(),
  next_review_due: z.string().optional(),
});

const relationsSchema = z.object({
  module_slug: z.string().min(1),
  edges: z.array(
    z.object({
      to_module_slug: z.string().min(1),
      relation_type: z.enum([
        "prerequisite",
        "follow_up",
        "deeper",
        "contradicts",
        "soft_flag_companion",
      ]),
      rationale: z.string().optional(),
    }),
  ),
});

export type HeavyEvidenceRow = z.infer<typeof evidenceRowSchema>;
export type HeavyRelationEdge = z.infer<typeof relationsSchema>["edges"][number];

export type ParsedHeavyBranch = {
  stageKey: string;
  relationshipKey: string;
  livingSituationKey: string;
  bodyMd: string;
};

export type ParsedHeavyTool = { toolType: string; slug: string; title: string; payload: unknown };

export type ParsedHeavyModule = {
  dir: string;
  front: z.infer<typeof heavyDiskFrontmatterSchema>;
  bodyMd: string;
  branches: ParsedHeavyBranch[];
  tools: ParsedHeavyTool[];
  evidence: HeavyEvidenceRow[];
  relations: z.infer<typeof relationsSchema>;
};

const branchPayloadSchema = z.object({
  stageKey: z.string().min(1),
  relationshipKey: z.string().min(1),
  livingSituationKey: z.string().min(1),
  bodyMd: z.string().min(1),
});

export const heavyPublishBundleSchema = z.object({
  front: heavyDiskFrontmatterSchema,
  bodyMd: z.string().min(1),
  branches: z.array(branchPayloadSchema),
  tools: z.array(z.record(z.string(), z.unknown())),
  evidence: z.array(evidenceRowSchema),
  relations: relationsSchema,
});

export type HeavyPublishBundle = z.infer<typeof heavyPublishBundleSchema>;

export function parseHeavyPublishBundle(data: unknown): ParsedHeavyModule {
  const b = heavyPublishBundleSchema.parse(data);
  return {
    dir: "",
    front: b.front,
    bodyMd: b.bodyMd,
    branches: b.branches,
    tools: b.tools.map((rec) => {
      const toolType = String(rec.tool_type ?? rec.toolType ?? "");
      if (!toolType) {
        throw new Error("each tool must include tool_type (or toolType)");
      }
      return {
        toolType,
        slug: String(rec.slug ?? ""),
        title: String(rec.title ?? ""),
        payload: rec,
      };
    }),
    evidence: b.evidence,
    relations: b.relations,
  };
}

function composeBranchBody(fm: z.infer<typeof branchFmSchema>, body: string): string {
  const tryLine = fm.try_this_today ? `## Try this today\n\n${fm.try_this_today}\n\n` : "";
  return `${tryLine}${body}`.trim();
}

export async function parseHeavyModuleFromDisk(args: { repoRoot: string; slug: string }): Promise<ParsedHeavyModule> {
  const base = process.env.CONTENT_MODULES_DIR
    ? path.resolve(args.repoRoot, process.env.CONTENT_MODULES_DIR)
    : path.join(args.repoRoot, "content", "modules");
  const dir = path.join(base, args.slug);
  const modulePath = path.join(dir, "module.md");
  const raw = await readFile(modulePath, "utf8");
  const { data, content } = matter(raw);
  const front = heavyDiskFrontmatterSchema.parse(data);

  const branchesDir = path.join(dir, "branches");
  const branchNames = await readdir(branchesDir);
  const branches: ParsedHeavyBranch[] = [];
  for (const name of branchNames.sort()) {
    if (!name.endsWith(".md")) continue;
    const br = await readFile(path.join(branchesDir, name), "utf8");
    const { data: bd, content: bc } = matter(br);
    const fm = branchFmSchema.parse(bd);
    branches.push({
      stageKey: fm.stage,
      relationshipKey: fm.relationship,
      livingSituationKey: fm.living_situation,
      bodyMd: composeBranchBody(fm, bc.trim()),
    });
  }

  const toolsDir = path.join(dir, "tools");
  const toolFiles = await readdir(toolsDir);
  const tools: ParsedHeavyTool[] = [];
  for (const name of toolFiles.sort()) {
    if (!name.endsWith(".json")) continue;
    const tj = JSON.parse(await readFile(path.join(toolsDir, name), "utf8")) as Record<string, unknown>;
    const toolType = String(tj.tool_type ?? "");
    const slug = String(tj.slug ?? "");
    const title = String(tj.title ?? "");
    tools.push({ toolType, slug, title, payload: tj });
  }

  const evidenceRaw = await readFile(path.join(dir, "evidence.json"), "utf8");
  const evidence = z.array(evidenceRowSchema).parse(JSON.parse(evidenceRaw));

  const relationsRaw = await readFile(path.join(dir, "relations.json"), "utf8");
  const relations = relationsSchema.parse(JSON.parse(relationsRaw));

  return { dir, front, bodyMd: content.trim(), branches, tools, evidence, relations };
}
