import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

import type { ModelRoutingPolicy, PolicyRouteRow, RoutingTopic } from "./types.js";

const ROUTING_TOPICS: RoutingTopic[] = [
  "medical",
  "medication",
  "behavioral",
  "self_care",
  "logistics",
  "other",
];

const matchSchema = z
  .object({
    topic: z.enum(ROUTING_TOPICS as [RoutingTopic, ...RoutingTopic[]]).optional(),
    is_refusal_template: z.boolean().optional(),
  })
  .strict();

const routeRowSchema = z.object({
  match: matchSchema,
  model_id: z.string().min(1),
  reason: z.string().min(1),
});

const policySchema = z.object({
  policy_version: z.number().int().nonnegative(),
  default_model_id: z.string().min(1),
  routes: z.array(routeRowSchema),
  ab_overrides: z.array(z.object({ cohort: z.string().min(1), note: z.string().optional() })).optional(),
});

function assertNoUnknownMatchKeys(match: Record<string, unknown>): void {
  const allowed = new Set(["topic", "is_refusal_template"]);
  for (const k of Object.keys(match)) {
    if (!allowed.has(k)) {
      throw new Error(`model-router: unknown match key "${k}"`);
    }
  }
}

/** Parse and validate policy YAML text (throws on invalid). */
export function parsePolicyYaml(yamlText: string): ModelRoutingPolicy {
  const raw = parseYaml(yamlText) as unknown;
  const parsed = policySchema.parse(raw);
  for (const row of parsed.routes) {
    assertNoUnknownMatchKeys(row.match as Record<string, unknown>);
    const m = row.match;
    if (m.topic === undefined && m.is_refusal_template === undefined) {
      throw new Error("model-router: each route must set at least one match key");
    }
  }
  return parsed as ModelRoutingPolicy;
}

/** Default bundled policy path: `packages/model-router/config/model-routing.yaml`. */
export function defaultPolicyPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "../config/model-routing.yaml");
}

export function loadPolicyFromFile(path: string): ModelRoutingPolicy {
  const text = readFileSync(path, "utf8");
  return parsePolicyYaml(text);
}

/** True when `row.match` is satisfied by `verdict` (all set keys must match). */
export function matchSatisfies(
  row: PolicyRouteRow,
  verdict: { topic: RoutingTopic; is_refusal_template: boolean },
): boolean {
  const m = row.match;
  if (m.topic !== undefined && m.topic !== verdict.topic) {
    return false;
  }
  if (m.is_refusal_template !== undefined && m.is_refusal_template !== verdict.is_refusal_template) {
    return false;
  }
  return true;
}
