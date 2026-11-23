# ADR 0031: Hermes heavy disk bundle layout, `module_tools.payload`, and validation bridge

## Status

Accepted (TASK-044 follow-up)

## Context

Heavy library modules ship from **Hermes** as directory bundles under `content/modules/<slug>/` (or a path pointed at by `CONTENT_MODULES_DIR`). The web app must not invent bundle shape; operators need a single contract for disk ingest, CLI load, and optional JSON publish.

## Decision

1. **Canonical on-disk layout** — Each bundle is a folder:

   - `module.md` — gray-matter front matter (`heavyDiskFrontmatterSchema` + Hermes passthrough keys) + canonical module body (`body_md` source).
   - `branches/*.md` — per-axis branch: YAML (`stage`, `relationship`, `living_situation`, optional `try_this_today`, …) + markdown body; persisted as `module_branches` (`stage_key`, `relationship_key`, `living_situation_key`, `body_md`).
   - `tools/*.json` — one file per tool; must include `tool_type`, `slug`, `title`, and type-specific fields.
   - `evidence.json` — rows keyed by `claim_anchor` (citations in markdown).
   - `relations.json` — `{ module_slug, edges[] }` with `to_module_slug` + `relation_type`.

   Disk bundle is **canonical** for authoring; HTTP `POST /api/internal/content/publish-bundle` accepts the same shape as JSON for automation (CI / Hermes service), not a divergent schema.

2. **`module_tools.payload` (jsonb)** — Full parsed JSON from each tool file is stored in **`payload`**, keyed by `(module_id, slug)` and classified by **`tool_type`**. No per-type SQL columns in v1; evolution adds Zod schemas in `@alongside/content`, not migrations, until a field needs indexing.

3. **`getToolSchemaForType`** — `@alongside/content` exports a single registry (`packages/content/src/tools/`) mapping `tool_type` string → Zod schema. `validateHeavyModule` and publish paths use it to fail closed on malformed tools before insert.

4. **Composite first-person guard** — Inside `<!-- provenance: composite -->` segments, the validator flags **first-person only when it appears after an opening quote marker** (e.g. `"I`, `'I`, backtick-`I`), not bare `, I` / `; I` (avoids false positives on scripted dialogue like *Tuesday, I realized…* inside a quoted string).

## Consequences

- New `tool_type` values require a Zod schema + registry entry; otherwise validation rejects publish.
- Relation edges require existing `modules.slug` rows unless the operator uses CLI `--seed-relation-targets` (stub inserts); the internal HTTP publish route defaults `seedRelationTargets: false`.
- Prompt/topic hygiene (e.g. primary topic count warnings) lives in **validator warnings**, not only in LLM prompts.

## References

- Schema: `docs/schema-v2.md` § Hermes heavy modules.
- Operator steps: `docs/heavy-modules-runbook.md`.
