# SPRINT-HERMES — Heavy module production, full library

**Scope:** Build the full 2026 Alongside library — 55–60 heavy modules across seven clusters — by running Hermes (Nous Research's self-improving agent runtime) in parallel from day one against a hybrid source corpus, with a conversational review loop for the four pilots and a structured critique-JSON loop for the rest.

**Status:** Wave-1 spike complete (April 25, 2026). `transitions-first-two-weeks` produced as full heavy bundle, passed Hermes internal critique 9.1/10 and external Cowork critique 9.0/10. Rubric and prompts locked with three small refinements (see `AGENTS.md` §5b). Parallel batch on the remaining 59 modules pending — config switch to uniform Sonnet, `critique.json` loop, and Cursor tickets HERMES-01 / 02 / 02b shipped.

**Owner:** abhishek (operates Hermes). Critique loop runs through Claude in this Cowork session. Cursor implements schema, validator, ingestion, and publish pipeline changes in the monorepo.

---

## 1. The eleven surfaces a heavy module carries

A heavy module is a module bundle, not a single Markdown file. It carries:

**Caregiver-facing (what users read).**
1. **Clinical depth** — neurology, mechanism, named studies, staging, differentials, medications, ARIA monitoring for DMTs, blood-biomarker pathway. Modern (2025–2026) where the field has moved.
2. **Specificity** — concrete instances, not abstractions. Three named lamps with lumen ranges, five exact phrases that work, the cost ranges by region, the questions to ask on a memory-care tour.
3. **Lived experience** — real or clearly-marked-composite caregiver voices. Provenance-tagged (`real-interview` | `published-attributed` | `composite`). LLM-generated first-person quotes are not allowed.
4. **Tools** — structured, JSON-shaped artifacts the front-end renders as widgets. Decision trees, checklists, scripts, templates.
5. **Stage + relationship + living-situation branches** — variants of the same module for different combinations. Three axes only; the other five care-profile dimensions become prompt-time personalization in the conversation pipeline.
6. **Emotional / ethical handling** — ambiguous grief, guilt, breaking-point flow, end-of-life decisions, family conflict. Reviewed by the caregiver-support clinician personally.

**System-side (what the product needs the modules to carry).**
7. **Evidence table** as a structured schema (`module_evidence` rows) — every numbered claim → source + tier + URL + page + quoted excerpt + reviewer + date + next-review-due. Gates expert-review.
8. **Related-modules graph** with typed edges (`prerequisite` | `follow-up` | `deeper` | `contradicts` | `soft-flag-companion`).
9. **Refusal / gap-discovery feed integration** — modules tag the topics they cover so refusals against uncovered topics generate briefs for the next cohort.
10. **Operational metadata** — `srs_suitable`, `soft_flag_companion_for`, `weeks_focus_eligible`, `srs_difficulty_bucket`, split `primary_topics` / `secondary_topics`. Drives the picker, the SRS schedule, and the home-screen check-in.
11. **Source corpus discipline** — every retrieval traces to the locked corpus or a web-search result with a captured snapshot in `module_evidence.url_snapshot`. No ungrounded claims.

(Escalation scripts in `packages/safety/src/scripts/*.md` are a separate content surface, **out of scope for Hermes.** They stay human-authored and human-reviewed.)

---

## 2. The 2026 library — 56 modules across seven clusters

Counts by cluster, with the four new modules and six revisions called out. Numbering is for tracking only.

### Behaviors (12)
1. Repetitive questions — *pilot drafted as transitions-first-two-weeks; recategorize TBD*
2. Sundowning — *seeded; revise for 2025 light/music evidence and the HOPE study framing*
3. Accusations and paranoia
4. Agitation and aggression — *revise to centre DICE protocol and the AI-aided DICE evidence*
5. Wandering — *revise to address GPS/geofencing/AngelSense and 2026 wearable options*
6. Shadowing
7. Hallucinations and delusions — *flag LBD-specific antipsychotic sensitivity; cross-link to LBD module*
8. Refusal of care
9. Inappropriate behaviors
10. Restlessness and pacing
11. Apathy and withdrawal
12. Anxiety and fear

### Daily care (10)
13. Bathing resistance — *seeded; expand with provenance-tagged scripts and tools*
14. Dressing
15. Eating and swallowing
16. Toileting and incontinence
17. Sleep problems
18. Medication management — *revise for DMT context (lecanemab/donanemab schedules)*
19. Oral care
20. Mobility and falls — *revise to include Apple Watch fall detection and home-safety tools*
21. Driving — *revise; the conversation now includes capacity-loss patterns specific to FTD/LBD*
22. Activities and engagement

### Communication (6)
23. How to talk with someone with dementia — *pilot drafted; expand with tools*
24. Validation therapy basics
25. Redirection vs. arguing
26. When they don't recognize you
27. Meaningful activities by stage
28. Language changes — *new; covers PPA and FTD-specific language losses*

### Medical (8 — was 7; +1 for DMT)
29. Understanding the diagnosis (general)
30. **The diagnosis demystified** — *pilot drafted; major revision required for blood-biomarker pathway*
31. Working with the neurologist
32. Common comorbidities
33. **NEW — Disease-modifying therapies (lecanemab, donanemab, ARIA monitoring)**
34. Hospital visits and dementia
35. End-of-life signs and the dying process
36. Pain in dementia

### Legal & financial (7 — was 6; +1 for GUIDE)
37. Power of attorney
38. Advance directives and POLST/MOLST
39. Medicare basics for dementia
40. Medicaid and long-term care planning — *revise with state-by-state variance and 2026 cost numbers*
41. Paying for care
42. **NEW — The CMS GUIDE Model: are you eligible and what does it cover**
43. When to consider memory care (financial decision side)

### Transitions (5)
44. The first two weeks after a dementia diagnosis — *pilot drafted; light revision for blood-biomarker pathway*
45. When they can't live alone anymore
46. The driving conversation
47. Moving to memory care
48. Hospice and dementia

### Caring for yourself (8)
49. Caregiver burnout — *seeded; revise with 2025 mindfulness RCT evidence (PAACC, MBDCP, Mind & Care)*
50. **Caregiver guilt and ambiguous grief** — *pilot drafted; light expansion with tools*
51. Grief while they're still here
52. Asking for help
53. Family conflict
54. Respite care — *revise with GUIDE respite benefit ($2,500/year)*
55. The caregiver's own health
56. After they're gone — early bereavement

### Disease-specific (4 — new cluster)
*Recommendation: split this out rather than burying inside Medical, because the caregiving job is genuinely different.*

57. **NEW — Caring for someone with frontotemporal dementia (FTD)**
58. **NEW — Caring for someone with Lewy body dementia (LBD)**
59. Caring for someone with vascular dementia
60. Caring for someone with mixed dementia

**Total: 60 modules in eight clusters** (raised from 30–50 in seven, per the literature scan. The PRD's "30–50" baseline is preserved as a content-quality minimum; the count grows because the field grew.)

---

## 3. Sprint shape — full parallel from day one

You chose full parallel. The risk is rework if a surface turns out wrong; mitigation is the **24-hour observation window** and **fast-fail rubric**:

**Hour 0.** Schema migration ships (Cursor HERMES-01 / TICKET-01). Validator stub ships (HERMES-02). Source corpus loaded with primary tier-2 sources (HERMES-03). Hermes spec, prompts, and rubric live in `hermes/` directory in repo (HERMES-04).

**Hour 0–4.** You launch Hermes against ~5 modules in parallel — the four pilots plus one fresh module (recommend Module 33: DMT) to stress-test that the new clusters work. Output lands in `content/modules/<slug>/` as folders.

**Hour 4–24.** I review those 5 conversationally, in this thread. We tune the rubric, the prompts, and the schema based on what's actually wrong. Lock changes by hour 24.

**Hour 24+.** You launch Hermes against the remaining ~55 modules in batches of 8–12 in parallel. I run structured critique JSON on each completed folder. Hermes' rewrite loop runs against my critique until rubric-pass green. Modules that pass land in the `pending_review` state and route through the existing 7-stage human pipeline.

**Sprint length.** 14 days end-to-end. Days 1–2 schema/validator/corpus. Days 3–4 pilot review and lock. Days 5–12 parallel scale. Days 13–14 final critique pass and Cursor's batch publish.

This is aggressive. It works only if the gate at hour 24 is a hard gate — if the pilot review surfaces a structural problem, we stop and fix before the parallel batch runs, no exceptions.

---

## 4. Cursor tickets (in dependency order)

**Dependency rule.** HERMES-01 (schema migration, also referenced as TICKET-01) is the only hard blocker. HERMES-02 through HERMES-07 can be stubbed or developed against fixtures in parallel, but no downstream ticket is merge-ready until HERMES-01 lands and exports the canonical Drizzle types.

### HERMES-01 — Schema additions for heavy modules

- **Owner:** Cursor
- **Depends on:** current `modules`, `module_chunks`, and `module_evidence` schema
- **Unblocks:** HERMES-02, HERMES-03, HERMES-04, HERMES-05, HERMES-06, HERMES-07
- **Status:** pending
- **Blocker:** yes — this is the one blocker for everything downstream

**Goal.** Three new tables, heavy-module columns on `modules`, and a frontmatter extension. Light modules ignore the new fields; heavy modules require them.

**Migration:** `0022_heavy_modules.sql`. Includes:

```sql
-- modules gets a heavy flag and bundle-version
ALTER TABLE modules ADD COLUMN heavy boolean NOT NULL DEFAULT false;
ALTER TABLE modules ADD COLUMN bundle_version int NOT NULL DEFAULT 1;
ALTER TABLE modules ADD COLUMN srs_suitable boolean DEFAULT true;
ALTER TABLE modules ADD COLUMN srs_difficulty_bucket smallint DEFAULT 2;
ALTER TABLE modules ADD COLUMN weeks_focus_eligible boolean DEFAULT true;
ALTER TABLE modules ADD COLUMN soft_flag_companion_for jsonb DEFAULT '[]'::jsonb; -- topic slugs
ALTER TABLE modules ADD COLUMN secondary_topics jsonb DEFAULT '[]'::jsonb;

CREATE TABLE module_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  stage_key text NOT NULL CHECK (stage_key IN ('early','middle','late','any')),
  relationship_key text NOT NULL CHECK (relationship_key IN ('parent','spouse','sibling','in_law','other','any')),
  living_situation_key text NOT NULL CHECK (living_situation_key IN (
    'with_caregiver','alone','with_other_family','assisted_living','memory_care','nursing_home','any'
  )),
  body_md text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module_id, stage_key, relationship_key, living_situation_key)
);

CREATE TABLE module_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  tool_type text NOT NULL CHECK (tool_type IN ('decision_tree','checklist','script','template','flowchart')),
  slug text NOT NULL,
  title text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module_id, slug)
);

CREATE TABLE module_relations (
  from_module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  to_module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  relation_type text NOT NULL CHECK (relation_type IN (
    'prerequisite','follow_up','deeper','contradicts','soft_flag_companion'
  )),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (from_module_id, to_module_id, relation_type)
);

-- module_evidence already exists; add quoted_excerpt and url_snapshot
ALTER TABLE module_evidence ADD COLUMN quoted_excerpt text;
ALTER TABLE module_evidence ADD COLUMN url_snapshot text; -- captured HTML at retrieval time
ALTER TABLE module_evidence ADD COLUMN claim_anchor text; -- e.g. "[7]" pointing to numbered claim in body
```

**Scope.** Add the migration, mirror it in Drizzle, export the new table/column types, and add DB tests that prove branches, tools, relations, and evidence claim anchors can be inserted and queried. Keep the migration additive only; do not reset or backfill production data.

**Drizzle schema changes** in `packages/db/src/schema.ts` or the local schema split files to mirror the SQL.

**Acceptance:** migration applies cleanly on `hypercare_dev` and `hypercare_prod`. `pnpm --filter @alongside/db migrate` is idempotent. Tests in `packages/db/test/heavy-modules.test.ts` cover insert/upsert paths for branches, tools, and relations.

### HERMES-02 — Validator for heavy modules

- **Owner:** Cursor
- **Depends on:** HERMES-01 for canonical schema types; fixture work can start earlier
- **Unblocks:** HERMES-04 and HERMES-06
- **Status:** pending

**Goal.** When a module's frontmatter has `heavy: true`, the validator (called by `pnpm --filter @alongside/content load`) enforces:

- Every `[N]` numbered claim in `body_md` (and in every branch `body_md`) has a corresponding `module_evidence` row with non-null `quoted_excerpt`, `url`, and `claim_anchor = "[N]"`.
- At least one `module_branches` row matches the user's care profile pattern. (At minimum a `(any, any, any)` fallback branch.)
- All `module_tools[].payload` validate against per-tool-type Zod schemas in `packages/content/src/tools/`.
- All `module_relations[].to_module_id` resolve to existing modules.
- `primary_topics` size ≤ 4; `secondary_topics` size ≤ 8; both subsets of the closed taxonomy.
- Lived-experience: any first-person quote (regex match on quote markers) requires `provenance: real-interview | published-attributed`. `composite` provenance fails validation if the passage uses first-person voice.

**Scope.** Implement the validator as a reusable package function, not just CLI code, so the publish endpoint and folder ingest call the exact same checks. Return structured errors with field paths that can be printed by the CLI and rendered by the review UI.

**Acceptance:** validator unit tests cover happy path, every failure mode, and a fixture heavy module that passes end-to-end.

### HERMES-02b — Tool Zod schemas (added from wave-1 critique)

- **Owner:** Cursor
- **Depends on:** HERMES-02 (the validator imports these)
- **Unblocks:** parallel batch ingestion (the parallel run will produce ~120 tool JSON files)
- **Status:** pending

**Goal.** Five Zod schemas in `packages/content/src/tools/`, one per tool type, that the validator imports. Surfaced from the wave-1 spike: `synthesis_notes.md` flagged that the Tools Agent's prompt (`hermes/prompts/05-tools.md`) was the only contract for tool JSON because no Zod schemas existed. The spike's two checklists conformed to the prompt schema, but cosmetic drift will accumulate at scale without enforcement.

**Schemas to write:** `checklist.ts`, `decision_tree.ts`, `script.ts`, `template.ts`, `flowchart.ts`. Each exports a Zod schema and an inferred TypeScript type. The schemas mirror the shapes documented in `hermes/prompts/05-tools.md`:

- `checklist`: `tool_type`, `slug`, `title`, `context`, `items[]` where each item has `id`, `label`, `rationale`, `what_to_look_for`.
- `decision_tree`: `tool_type`, `slug`, `title`, `root` (node id), `nodes` keyed by id with question/yes/no edges or terminal `outcome` strings.
- `script`: `tool_type`, `slug`, `title`, `context`, `openings[]`, `if_they[]` (each with `response` and `what_to_say`), `things_not_to_say[]`.
- `template`: `tool_type`, `slug`, `title`, `fields[]` (each with `id`, `label`, `kind`), `instructions`.
- `flowchart`: `tool_type`, `slug`, `title`, `nodes[]` (each with `id`, `step`, `next[]`).

Each schema must export both `<Type>Schema` (the Zod schema for runtime parsing) and `<Type>` (the inferred TypeScript type for editor autocomplete).

**Acceptance:** `packages/content/src/tools/index.ts` exports the five schemas; the validator from HERMES-02 imports `getToolSchemaForType(tool_type)` and runs `safeParse` on every `module_tools[].payload`. Unit tests cover one valid and one invalid fixture per type. The wave-1 spike's two existing tools (`things-that-can-wait.json`, `first-two-weeks-action-items.json`) pass validation as fixtures.

### HERMES-03 — Source corpus manifest and ingestion

- **Owner:** Cursor
- **Depends on:** HERMES-01 if `corpus_chunks` is added to the same schema surface; otherwise manifest/snapshot work can start independently
- **Unblocks:** Hermes grounded retrieval and Citation Agent verification
- **Status:** pending

**Goal.** A versioned corpus that Hermes retrieves from. New file `packages/content/corpus/manifest.yaml` lists every source. The 2024 PRD sources are tier 2 baseline; the 2025–2026 additions are tier 2 augmentation; tier 3 is the intervention literature.

**Sources to add (15–20):**

- AAIC 2025 Clinical Practice Guideline on Blood-Based Biomarkers (Alzheimer's Association)
- Fujirebio Lumipulse pTau217/Aβ ratio FDA clearance docs (May 2025)
- Roche Elecsys pTau181 FDA clearance docs (October 2025)
- Eisai/Biogen lecanemab prescribing information and ARIA monitoring schedule
- Eli Lilly donanemab prescribing information and ARIA monitoring schedule
- CMS GUIDE Model overview, participating-practice list (ongoing)
- Mathematica GUIDE evaluation framework
- AARP Caregiving in the U.S. 2025
- AARP Valuing the Invaluable 2026
- Alzheimer's Association 2026 Facts and Figures
- AFTD caregiver bootcamp materials
- LBDA caregiver bootcamp materials and 2026 webinar series
- Family Caregiver Alliance dementia resources (caregiver.org)
- Alzheimer's Foundation of America dementia caregiver materials
- BrightFocus 2026 Treatment Landscape Forecast
- DICE Approach official materials and 2025 AI-aided DICE protocol
- PAACC mindfulness RCT (Sapra et al., Alzheimer's & Dementia 2025)
- Hybrid MBDCP RCT (Gerontologist 2025)
- Mind & Care App closed-loop mindfulness RCT protocol
- JMIR mHealth 2026 mobile app for individualized BPSD interventions

**Manifest schema:**

```yaml
sources:
  - id: aaic-2025-blood-biomarker-guideline
    title: "Clinical Practice Guideline on Blood-Based Biomarkers"
    organization: "Alzheimer's Association"
    tier: 2
    url: "https://aaic.alz.org/releases-2025/clinical-practice-guideline-blood-based-biomarkers.asp"
    locked: true   # corpus snapshot exists
    snapshot_path: "corpus/snapshots/aaic-2025-blood-biomarker-guideline.html"
    last_verified: "2026-04-25"
    relevant_modules: [medical-diagnosis-demystified, medical-dmt]
```

**Scope.** Add the manifest schema, the first locked source list, snapshot capture, corpus chunking/embedding, and idempotent writes keyed by source id plus content hash. The command must never print or commit secrets.

**Ingestion script:** `pnpm --filter @alongside/content ingest-corpus` fetches every `locked: true` source, captures HTML to `snapshot_path`, embeds with Titan, and writes to a separate `corpus_chunks` table. Hermes retrieves from `corpus_chunks` by source-id filter.

**Acceptance:** all locked sources captured and embedded. A `pnpm --filter @alongside/content corpus-stats` command shows source count, total chunks, and per-source coverage.

### HERMES-04 — Publish bundle endpoint

- **Owner:** Cursor
- **Depends on:** HERMES-01 hard; HERMES-02 for validation
- **Unblocks:** HERMES-06 and HERMES-07
- **Status:** pending

**Goal.** The current publish path takes a single Markdown file. Heavy modules require a bundle:

```ts
type ModuleBundle = {
  module: ModuleFrontmatter & { body_md: string };
  branches: ModuleBranch[];
  tools: ModuleTool[];
  evidence: ModuleEvidence[];
  relations: ModuleRelation[];
};
```

**Scope.** Add an authenticated internal endpoint that publishes the whole bundle in one transaction. It validates first, embeds the main body and branch bodies, then upserts all bundle surfaces idempotently. Any invalid tool, relation, or evidence row rolls back the full bundle.

**Endpoint.** `POST /api/internal/content/publish-bundle`. Authenticated to internal/content roles. Validates the bundle as a unit, runs the heavy-module validator from HERMES-02, embeds main body + each branch body, upserts `modules`, `module_branches`, `module_tools`, `module_relations`, `module_evidence`, `module_chunks`. Idempotent on `(slug, bundle_version)`.

**Acceptance:** end-to-end test with a fixture bundle. Module appears in library. Branches resolve correctly from a synthetic care profile. Tools render as widgets in library page.

### HERMES-05 — Retrieval branch filtering

- **Owner:** Cursor
- **Depends on:** HERMES-01 hard; HERMES-04 for integration against published fixture bundles
- **Unblocks:** heavy modules being useful in conversation answers
- **Status:** pending

**Goal.** RAG retrieval (`packages/rag`) respects branches. When a user query is classified, the retrieval layer picks the most-specific branch matching `(stage, relationship, living_situation)` from the user's care profile, falling back to less-specific branches. The branch's `body_md` is what gets embedded into the prompt.

**Scope.** Implement deterministic branch selection: exact match, then two matching dimensions, then one matching dimension, then `(any, any, any)`. Preserve light-module behavior and keep attribution tied to the parent module plus branch metadata.

**Acceptance:** unit tests cover branch selection: exact match, two-out-of-three match, fallback to `(any, any, any)`. Integration test with a fixture care profile shows the right branch surfaces in a generated answer.

### HERMES-06 — Hermes folder watch and ingest

- **Owner:** Cursor
- **Depends on:** HERMES-01 hard; HERMES-02 and HERMES-04 for production publish
- **Unblocks:** operator workflow from Hermes output folder to published bundle
- **Status:** pending

**Goal.** Hermes outputs to `content/modules/<slug>/` as a folder containing `module.md`, `branches/<key>.md`, `tools/<slug>.json`, `evidence.json`, `relations.json`. Cursor implements `pnpm --filter @alongside/content load --heavy <slug>` that reads the folder, builds the bundle, and POSTs to the publish-bundle endpoint.

**Scope.** Extend the content CLI to parse Hermes output folders, normalize them into the HERMES-04 bundle shape, run HERMES-02 validation locally, support `--dry-run`, and publish through the endpoint. Validator failures must print actionable paths and exit non-zero for CI.

**Acceptance:** dry-run flag prints the bundle without publishing. Re-running `load --heavy` is idempotent. A failing bundle prints validator errors and exits non-zero so CI can use it.

### HERMES-07 — Module bundle review UI

- **Owner:** Cursor
- **Depends on:** HERMES-01 hard; HERMES-04 for real bundle data
- **Unblocks:** human review of all 11 heavy-module surfaces
- **Status:** pending

**Goal.** `/internal/content/modules/<slug>` extends to show branches, tools, evidence rows, and relations. Reviewers can leave per-surface comments, not just a single document comment. Approval state machine adds `pending_critique → critique_passed` before `expert_review`.

**Scope.** Extend the internal review page to show main body, branches, tools, evidence grouped by claim anchor, relations, operational metadata, and critique status. Comments attach to the surface being reviewed, and approval/rejection happens at the bundle level.

**Acceptance:** reviewer can see all 11 surfaces on one page, leave per-surface comments, and approve/reject the bundle as a unit.

---

## 5. Hermes architecture — agent topology

Hermes runs **nine agents per module**, organized as a parent + eight subagents:

```
        ┌─────────────────────────┐
        │     Brief Agent         │  reads refusal log + cluster spec → brief.md
        └────────────┬────────────┘
                     │
         ┌───────────▼────────────┐
         │   Synthesis Agent      │  parent; orchestrates and integrates
         │   (Hermes parent)      │
         └─┬─┬─┬─┬─┬─┬─┬──────────┘
           │ │ │ │ │ │ │
   ┌───────┘ │ │ │ │ │ └─────────────────────┐
   │     ┌───┘ │ │ │ └───────────────┐       │
   │     │   ┌─┘ │ └─────────┐       │       │
   ▼     ▼   ▼   ▼           ▼       ▼       ▼
[Clinical][Specificity][Lived][Tools][Branching][Citation][Critique]
   │     │   │   │           │       │       │
   └─────┴───┴───┴───────────┴───────┴───────┘
                     │
                     ▼
           Module bundle on disk
```

**Brief Agent.** Reads the cluster spec, the refusal log (`/internal/content/audit` API), the related-modules graph for the cluster, and the source corpus manifest. Produces a one-page brief: target module, audience, learning outcomes, branches needed, tools needed, sources to prioritize.

**Clinical Agent.** Retrieves from corpus over tier-1/2/3 sources for the topic. Produces the clinical-depth substrate: mechanism, named studies, modern (2025–2026) framing, differentials, drug interactions where relevant. Output is a draft section + a list of `[N]` claims + provisional evidence rows.

**Specificity Agent.** Operates over a draft from Clinical and Synthesis. Replaces every abstraction with a concrete instance. Output is a diff: each abstraction → its concretized form. Uses tools where it can verify the concrete (lumen ranges, cost ranges, region-specific data) against the corpus.

**Lived Experience Agent.** Generates either composite-third-person scenarios or, if the brief includes a real-interview transcript ID, integrates real-interview quotes with proper attribution. Never produces first-person fabricated quotes. Output is the lived-experience section with provenance tags.

**Tools Agent.** Produces decision trees, checklists, scripts, templates as JSON payloads. Each tool has a Zod schema in `packages/content/src/tools/`. The Tools Agent validates its own output against the schema.

**Branching Agent.** Operates over the integrated draft. Produces variants for each `(stage, relationship, living_situation)` combination relevant to this module. Most modules need 4–8 branches. Modules where branching doesn't apply (e.g., "the diagnosis demystified" in early stage only) have a single `(any, any, any)` branch.

**Citation Agent.** Operates over the integrated draft + branches + tools. Verifies every `[N]` claim has a real evidence row. Adds `quoted_excerpt` from the source where missing. Captures `url_snapshot` for any web-search-derived claim.

**Critique Agent.** First pass before output. Scores against the rubric. Returns `pass | rewrite`. If rewrite, names which surface and what to fix. The Synthesis Agent runs the rewrite. Max three iterations before output as-is with a `pending_human_review` flag.

**Synthesis Agent (parent).** Sequences the work: Brief → Clinical (in parallel with Lived Experience and Tools, since they're mostly independent) → Branching → Specificity → Citation → Critique. Integrates outputs into the bundle. Writes the folder.

This is the **eight-subagent + one-parent** topology. It maps cleanly to Hermes' parallel-subagent runtime. Each subagent is one Hermes worker; the Synthesis parent is the orchestrator.

---

## 6. The critique rubric

Every module is scored on 11 axes (one per surface). Each axis 0–10. Gate is **all axes ≥ 8 AND overall ≥ 9** to pass. Below gate, Critique returns rewrite instructions.

Rubric file: `hermes/critique-rubric.json` (separate file; see HERMES-04 deliverables).

| Axis | What 10 looks like | What ≤ 7 means |
|------|--------------------|----------------|
| Clinical depth | Mechanism, modern (2025–2026) where field has moved, named studies, accurate. | Outdated, missing mechanism, or unsourced. |
| Specificity | At least 6 concrete instances per 1000 words. No empty abstractions. | "Lower the lights" without specifics. |
| Lived experience | Provenance-tagged voices. Composites third-person and clearly framed. | First-person fabricated quotes. Missing tags. |
| Tools | At least one tool that's actionable on its own. JSON validates. UI-ready. | Prose dressed as a checklist. No tool, or unvalidated. |
| Branches | Branches present where they matter. Each variant reads like it was written for that user, not a find-replace. | Single body. Or branches that diverge only on a name. |
| Emotional handling | Difficult emotions named, not bypassed. No false reassurance. Soft-flag companion edges declared. | Toxic positivity. Reflective listening that amplifies distress. |
| Evidence table | Every `[N]` claim → row with quoted excerpt, URL, snapshot. | Claims without rows. Rows without quotes. |
| Related modules | Edges typed correctly. Prerequisites surface earlier modules. Contradicts edges declared where the module differs from generic guidance (LBD antipsychotic). | One related link, or untyped. |
| Refusal/gap awareness | Module's `primary_topics` cover the refusal log entries it claims to cover. Honest about what it doesn't address. | Topic-tagging gaming. Claims coverage it doesn't have. |
| Operational metadata | All five metadata fields populated correctly. SRS bucket reflects re-surface intent. | Defaults left in place. |
| Source corpus discipline | All retrieval traces to corpus or captured snapshot. No floating claims. | "According to recent research" without a source. |

---

## 7. Review cadence — pilots conversational, scale structured

**Pilots (Modules 1, 2, 23, 47 — and the wave-1 spike Module 33).** You run Hermes, the folder lands. You paste me the module's `summary` + `body_md` + a sample branch + the evidence table + the rubric scores. I respond in prose with what's wrong on each surface and what to ask Hermes to fix. We tune the rubric together based on what's actually wrong. Latency: my turnaround. Goal: lock the rubric.

**Scale (Modules 5–60).** You run Hermes. Folder lands. You trigger me with `critique <slug>` or paste the folder contents. I respond with a structured `critique.json`:

```json
{
  "slug": "medical-dmt",
  "verdict": "rewrite",
  "overall_score": 7.8,
  "axis_scores": {
    "clinical_depth": 9,
    "specificity": 6,
    "lived_experience": 8,
    "tools": 5,
    "branches": 9,
    "emotional_handling": 9,
    "evidence_table": 10,
    "related_modules": 7,
    "refusal_awareness": 9,
    "operational_metadata": 8,
    "corpus_discipline": 10
  },
  "rewrite_instructions": [
    {
      "axis": "specificity",
      "issue": "ARIA monitoring section says 'regular MRIs' without naming the actual schedule.",
      "fix": "Reference the lecanemab prescribing-information schedule: MRI before doses 5, 7, and 14, then if symptoms. Cite source #aria-lecanemab-pi.",
      "agent": "specificity"
    },
    {
      "axis": "tools",
      "issue": "ARIA-symptom checklist is described in prose. Should be a structured tool.",
      "fix": "Produce module_tools row with tool_type='checklist', slug='aria-symptoms', payload conforming to checklist schema.",
      "agent": "tools"
    }
  ]
}
```

You feed `critique.json` to Hermes' rewrite loop. Hermes runs the named subagents against the named issues, regenerates the bundle, you re-trigger me. Loop until verdict is `pass`. Gate is two consecutive `pass` from the same critique pass (anti-flicker).

---

## 8. The workflow, end to end

```
1. Brief Agent reads refusal log + cluster spec → brief.md in folder.
2. Synthesis Agent dispatches Clinical / Lived Experience / Tools in parallel.
3. Outputs integrated; Branching Agent produces variants.
4. Specificity Agent passes over integrated draft.
5. Citation Agent verifies and captures evidence rows.
6. Internal Critique Agent runs the rubric. If rewrite, loop on the named subagent (max 3).
7. Folder written: module.md, branches/, tools/, evidence.json, relations.json, critique.json (Hermes' internal score).
8. You trigger external critique via Cowork session. I run critique against the folder.
9. critique.json (mine) lands in the folder. If pass: status -> pending_human_review. If rewrite: Hermes rewrite loop.
10. Cursor runs `pnpm --filter @alongside/content load --heavy <slug>` against passed folders.
11. Bundle posts to /api/internal/content/publish-bundle. Validates. Embeds. Inserts.
12. Module enters the existing 7-stage human review pipeline at expert_review state.
```

---

## 9. Risks and mitigations

| Risk | Mitigation |
|------|-----------|
| Schema lock turns out wrong at hour 24 | Hard gate at hour 24. If pilot review surfaces a structural problem, stop the parallel batch. |
| Hermes generates plausibly-grounded but actually-wrong DMT/medical content | Medical-category modules require Medical Director sign-off before publish. The pipeline's existing gate, not Hermes'. |
| LLM-generated first-person caregiver quotes leak through | Validator regex check on first-person quote markers + provenance tag enforcement. Failing validator blocks publish. |
| Branches diverge only superficially (find-replace branches) | Critique rubric explicitly scores branch quality. Below 8 = rewrite. |
| Source corpus is incomplete; Hermes web-searches and grounds against an unstable URL | Capture `url_snapshot` HTML at retrieval time. If snapshot is missing on a published claim, validator fails. |
| Rubric is too lenient; bad modules pass | Calibrate during pilot phase. Re-score the four pilots after every rubric change to confirm consistency. |
| Parallel batch hits API rate limits | Hermes runtime has rate-limit handling. Batch size set to 8–12 to stay under typical limits. |
| Critique agent (me, here) is the bottleneck | Structured critique JSON is the throughput mechanism. If still bottlenecked, you can run a second Critique Agent inside Hermes for an extra pre-pass. |
| Module count grows past 60 mid-sprint as refusal log generates new briefs | Capped at 60 in this sprint. New briefs from the refusal log queue for the next sprint. |

---

## 10. Out of scope for this sprint

- Real caregiver interviews (parallel pipeline; replaces composite quotes module-by-module as recordings land).
- Spanish-language content (v2).
- Cultural and demographic-specific modules (v2).
- Escalation scripts (`packages/safety/src/scripts/*.md`) — stay human-authored.
- Multi-patient profiles (v2).
- The conversation-pipeline's prompt-time personalization on the five non-branching axes (caregiver age, care network, proximity, hours, work status) — separate ticket, not this sprint.
- Any change to the existing safety classifier or refusal path.
- Any change to the expert-roster contracts or compensation.

---

## 11. Definition of done for the sprint

- All 60 modules in the database with `state = pending_human_review`.
- Every module has at least one branch, one tool, six numbered claims with evidence rows, and three related-module edges.
- The five new clusters (DMT, GUIDE, FTD, LBD, plus one of the major revisions) pass critique with axis_scores ≥ 8 across the board.
- The library page renders branches correctly for a synthetic care profile.
- A test query through the conversation pipeline retrieves the right branch and renders attribution correctly.
- Cursor's CI is green: lint, typecheck, validator, all unit + integration tests, the bundle ingest end-to-end test.
- A short retrospective: which surfaces were hard, which prompts needed three rewrites, what the human-review queue looks like.

---

## Files this sprint produces, by location

| Location | What |
|----------|------|
| `SPRINT-HERMES.md` | This document |
| `hermes/critique-rubric.json` | Critique rubric schema |
| `hermes/prompts/*.md` | One file per agent role |
| `hermes/agents.yaml` | Hermes runtime topology + subagent config |
| `packages/content/corpus/manifest.yaml` | Source corpus manifest |
| `packages/content/corpus/snapshots/*.html` | Locked source snapshots |
| `packages/content/src/tools/*.ts` | Per-tool-type Zod schemas |
| `packages/db/migrations/0022_heavy_modules.sql` | Schema migration |
| `apps/web/src/app/api/internal/content/publish-bundle/route.ts` | Publish bundle endpoint |
| `content/modules/<slug>/` | Hermes output, one folder per module |
