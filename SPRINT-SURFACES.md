# SPRINT-SURFACES — Expose the heavy-module substrate to caregivers

**Scope:** Five Cursor tickets that surface the ~75% of heavy-module bundle data currently sitting unused in the database. Today, a heavy module renders as a single article body plus a "try this today" line. Branches are silently selected with no UI signal, tools are not rendered, evidence rows are invisible on module pages, related-modules edges are unused, and the picker/RAG pipeline still operate on legacy `modules.body_md` rather than branch-aware content.

**Status:** **Shipped** (core implementation, April 2026). Follow-ups: per-tool component tests, Playwright visual regression, eval harness ≥90% gate for branch-aware queries (not automated in CI yet).

**Owner:** abhishek (PM). Cursor implements.

**Depends on:** TASK-044 (heavy-module pipeline, merged to `main` at `2ac6d2e`), TASK-045 (deploy to dev/prod, in flight).

**Architecture record:** [ADR 0033](docs/adr/0033-surfaces-and-branch-aware-retrieval.md).

**Why this matters:** The heavy-module bundles cost real tokens to produce ($60+ across four pilots, projected $400–800 across the full library). The substrate justifies that cost only if the front-end surfaces it. Without these tickets, the parallel batch on the remaining 56 modules ships 56 more "single articles" to the database that nothing in the UI reads.

The audit finding the user surfaced — *"only one article appears for each module"* — is correct as a UI critique and the right thing to fix before producing more content.

---

## What surfaces today (the baseline)

Per the audit:

| Surface | Status | Notes |
|---------|:-:|---|
| Module body text | ✅ Renders | Branch from care profile or `?branch=` |
| `try_this_today` aside | ✅ Renders | Module page aside block |
| Conversation answer citations | ✅ Renders | `CitationChip` + `CitationExpansion` |
| Branch differentiation visible | ✅ | Pill + `ModuleHeavyBranchBar` + shareable `?branch=` |
| `module_tools` widgets | ✅ | Five renderers + `ModuleToolsSection`; client imports `@alongside/content/tools` |
| `module_evidence` on module pages | ✅ | Inline citation buttons + `ModuleEvidencePanel` |
| `module_relations` "see also" navigation | ✅ | `RelatedModulesSection`; contradicts gated on profile |
| `weeks_focus_eligible` filter | ✅ | Picker treats `true` or `NULL` as eligible |
| `soft_flag_companion_for` routing | ✅ | `WarmCompanionCard` on `/app` when burnout flags threshold met |
| RAG retrieval branch-awareness | ✅ | `module_branch_chunks` + merged search + compose line |

Out of ~10 distinct content surfaces produced per module, **the listed surfaces now reach the screen** when data is present and migrations are applied.

---

## The five tickets

### SURFACES-01 — Tool renderers (highest visible value)

- **Owner:** Cursor
- **Depends on:** TASK-044 (merged); TASK-045 deploy (running)
- **Unblocks:** every module page becomes interactive instead of a wall of text
- **Status:** shipped (see ADR 0033)
- **Estimated size:** medium (5–8 days). The biggest UX win in the sprint.

**Goal.** Render the JSONB payloads in `module_tools` as interactive React widgets on the module page, one component per `tool_type`. The five payload schemas already exist as Zod types in `packages/content/src/tools/`; the components consume them.

**Components to build, one per tool type:**

- `<ChecklistTool />` — Renders a `checklist` payload as a tickable list. Each item has `label`, `rationale` (expandable on tap), and `what_to_look_for` (secondary text). Caregiver state is per-user, persisted via a small new `module_tool_state` table or via existing saved-answers infrastructure (PM to decide).
- `<DecisionTreeTool />` — Renders a `decision_tree` payload as a step-through flow. Start at the `root` node, render the question, render two buttons mapped to `yes` / `no` keys, advance through nodes, terminate on outcomes. Mobile-first; one node fills a phone screen.
- `<ScriptTool />` — Renders a `script` payload as expandable accordions. Top-level: openings array. Each opening expands to show `if_they` patterns and `what_to_say`. `things_not_to_say` rendered as a separate section.
- `<TemplateTool />` — Renders a `template` payload as a printable form. Each field has `id`, `label`, `kind` (text, textarea, checkbox-grid). User can fill in inline, then "Save as PDF" or "Print" button surfaces the form.
- `<FlowchartTool />` — Renders a `flowchart` payload as a numbered vertical list of steps with `next[]` indicating sequence. Mobile-first; no graphviz needed.

**Page integration.** `apps/web/src/app/(authed)/app/modules/[slug]/page.tsx` queries `module_tools` for the slug, loops over the rows, and renders the appropriate component per `tool_type` via a discriminated-union switch (`getToolComponentForType()` mirroring `getToolSchemaForType`).

**Acceptance:**

1. Module page renders all tools attached to the module, in source order.
2. Each tool type's component matches the screenshot-ready expectation in `hermes/prompts/05-tools.md`.
3. Component-level tests in `apps/web/src/components/tools/<type>.test.tsx` for each renderer with valid + invalid fixture payloads.
4. Visual regression test (Playwright) on the four pilot modules' tool sections.
5. Performance: page render under 200ms for a module with up to 4 tools.

**Out of scope:** persisting per-user tool state across sessions (defer to SURFACES-06 if scoped later); printing/PDF export (defer); cross-tool search.

### SURFACES-02 — Branch toggle and visible signal

- **Owner:** Cursor
- **Depends on:** TASK-044 (merged); SURFACES-01 (no, but visually reinforces it)
- **Unblocks:** the demo where caregivers see the branch change with their care profile
- **Status:** shipped (see ADR 0033)
- **Estimated size:** small (2–3 days). Highest "wow" per dollar.

**Goal.** Make branch selection visible and (where appropriate) interactive. Today the page silently picks `selectHeavyBranchMarkdown(...)`'s output and renders it. Caregivers have no way to know there's other content. Two changes:

**Change 1: visible "tailored to your situation" pill at the top of every heavy-module page.** Reads from the picked branch's `branch_key` and renders something like *"This page is tailored for: an early-stage parent who lives with you."* With a small "Why this version?" link that opens a modal explaining branches, with a single sentence: *"This module changes based on the relationship and stage you set in your care profile. Other versions exist for different situations."*

**Change 2: optional branch picker (collapsed by default).** A small "Read other versions" link below the article footer. When tapped, opens a dropdown listing the other 4–5 branch keys with human-friendly labels (*"For a spouse caring at home"*, *"For an adult child caring remotely"*). Picking one re-renders the page with the selected branch. Adds `?branch=<key>` to URL for shareable links.

**Privacy/safety check:** if the user selects a branch that doesn't match their care profile, do *not* update the care profile. This is read-only "preview a different situation" navigation.

**Acceptance:**

1. Module page renders a "tailored to your situation" pill on every heavy module.
2. Pill includes the human-friendly description of the picked branch.
3. "Why this version?" modal renders with the explanation and link to the care-profile editor.
4. "Read other versions" expandable shows other branch keys with human-friendly labels. Selecting one re-renders the page.
5. Care profile is not modified when a different branch is picked from the dropdown.
6. URL gets `?branch=<key>` for direct linking.
7. Component tests for the pill, the modal, and the picker.
8. Visual regression: `transitions-first-two-weeks` page tested with each of its 6 branches.

**Out of scope:** A/B testing branch effectiveness (defer); per-branch analytics (defer to a separate metrics ticket).

### SURFACES-03 — Inline citations and evidence panel on module pages

- **Owner:** Cursor
- **Depends on:** TASK-044 (merged)
- **Unblocks:** module pages stop looking unsourced; trust signal becomes visible
- **Status:** shipped (see ADR 0033)
- **Estimated size:** medium (4–5 days). Reuses `CitationChip` and `CitationExpansion` from conversation surface; needs a new evidence-panel component.

**Goal.** Render inline `[N]` citation markers in module body text as clickable chips, with a per-page evidence panel showing the source for each numbered claim.

**Inline rendering.** When the module body Markdown is parsed, replace `[N]` markers with `<CitationChip n={N} moduleSlug={slug} />` (component already exists for conversation; reuse it). Hovering or tapping the chip opens a popover showing the `quoted_excerpt` from `module_evidence` plus a link to the source URL.

**Evidence panel.** Below the article body, a collapsible "Sources and evidence" section that lists every `module_evidence` row for the current module body and the picked branch. Each row shows: claim number, source title and tier, quoted excerpt, link to source URL, and the reviewer name + date if populated. Designed to be the proof-of-rigor surface a caregiver shares with a skeptical relative or a clinician.

**Reuse the snapshot path** for the source link — when the URL is bot-blocked (NIA returns 405, Lancet 403), the link is the captured snapshot, not the live URL. ADR 0031 documented this; the panel must respect it.

**Acceptance:**

1. Body text `[N]` markers render as clickable `<CitationChip />`.
2. Tapping a chip opens a popover with the matching `module_evidence.quoted_excerpt` + source link.
3. Evidence panel below the article lists all rows for the rendered branch.
4. Snapshot-fallback URLs handled gracefully — display "captured snapshot, source page may not load directly" caveat.
5. Tests for the panel rendering, chip-popover interaction, and the snapshot-fallback edge case.
6. Visual regression on all four pilot modules.

**Out of scope:** an OAuth-protected "expert review log" surface showing the reviewer's review-date trail (defer); per-citation feedback ("was this source useful").

### SURFACES-04 — Related-modules navigation

- **Owner:** Cursor
- **Depends on:** TASK-044 (merged)
- **Unblocks:** caregivers can navigate the library as a curriculum, not a flat index
- **Status:** shipped (see ADR 0033)
- **Estimated size:** small (2–3 days). Pure data binding, no new component logic beyond a card.

**Goal.** Render `module_relations` edges on the module page as a typed navigation block. Five edge types, each surfaced with a different framing:

- `prerequisite` → "Read this first" block, top of page (above the body if the prerequisite is unread, below it if read)
- `follow_up` → "When you're ready: read next" block, below the body
- `deeper` → "Go deeper" link, below the body
- `contradicts` → "If you're caring for someone with [LBD/FTD/etc.], read instead:" warning block, prominent if the user's care profile flags the contradiction (e.g., LBD-specific antipsychotic guidance)
- `soft_flag_companion` → not rendered as static navigation; consumed by SURFACES-05 (picker integration). Hidden on the module page.

**The contradicts edge is the load-bearing one.** When a caregiver of someone with Lewy body dementia opens a generic "agitation and aggression" module, the page should show a prominent warning that LBD-specific guidance differs (avoid haloperidol, etc.) with a link to the `disease-specific-lbd` module. This is a clinical-safety surface, not a navigation nicety.

**Acceptance:**

1. Module page queries `module_relations` for the slug.
2. Each edge type renders in its designated UI slot with the right framing.
3. `contradicts` edges with care-profile-relevant flags render as a high-priority warning above the body.
4. `soft_flag_companion` edges are not rendered statically; reserved for SURFACES-05.
5. Tests for each edge-type rendering; visual regression on the four pilot modules' navigation blocks.

**Out of scope:** breadcrumb navigation (the library has its own navigation); inferred edges from topic-graph analysis (the explicit edges in `module_relations` are the contract).

### SURFACES-05 — Picker and soft-flag routing read new metadata

- **Owner:** Cursor
- **Depends on:** TASK-044 (merged), SURFACES-04 (preferred but not blocking)
- **Unblocks:** the home-screen "this week's focus" picks heavy-module-aware content; soft-flag burnout signal surfaces self-care guilt module as warm appendix
- **Status:** shipped (see ADR 0033)
- **Estimated size:** medium (3–4 days). Picker logic plus soft-flag handler updates.

**Goal.** Two changes to the picker (`packages/picker/`) and one to the soft-flag handler.

**Picker change 1: filter by `weeks_focus_eligible`.** The current picker selects all published modules and applies SRS pre-filtering. After this ticket, the picker first filters on `weeks_focus_eligible = true`, then applies the existing SRS / topic-signal / stage-baseline policy. Modules where `weeks_focus_eligible = false` (e.g., one-off transition modules where re-surfacing makes no sense) are skipped.

**Picker change 2: respect `srs_difficulty_bucket` for the SRS schedule.** The lesson-review schedule uses a default difficulty if `srs_difficulty_bucket` is null; with the column populated, scheduling is calibrated to the module's actual re-surface intent.

**Soft-flag change: read `soft_flag_companion_for` edges.** When a soft-flag classifier signal fires (burnout, ambiguous-grief, family-conflict yellow flags from PRD §10.4), the soft-flag handler queries `module_relations` for `soft_flag_companion` edges pointing at modules tagged with the firing topic. The matching module is rendered as a warm appendix on the home screen, not as a crisis copy.

**Concrete example.** A caregiver hits 2+ burnout flags in 7 days. The check-in card on `/app` elevates per existing PRD §10.4 logic. With this ticket, the home screen also surfaces `self-care-guilt-ambiguous-grief` as a warm appendix block: *"Other caregivers in your situation often find this helpful around now,"* with the module's title and `try_this_today` line. Tapping opens the module.

**Acceptance:**

1. Picker filters on `weeks_focus_eligible` before applying existing policy.
2. SRS schedule consults `srs_difficulty_bucket` when populated.
3. Soft-flag handler queries `module_relations` for `soft_flag_companion` edges and surfaces matching modules as warm appendix on `/app`.
4. Tests for picker filter, SRS scheduling against difficulty bucket, and soft-flag-warm-appendix rendering.
5. End-to-end test: simulate 2+ burnout flags in 7d, confirm self-care guilt module surfaces as warm appendix.

**Out of scope:** automatic invocation from conversation surface (defer to a separate ticket); A/B testing picker policy (defer).

### SURFACES-06 — RAG retrieval reads branches (highest leverage, most invisible)

- **Owner:** Cursor
- **Depends on:** TASK-044 (merged), SURFACES-02 (branches must be visible-correct first)
- **Unblocks:** the conversation pipeline serves care-profile-tailored answers, not generic
- **Status:** shipped (see ADR 0033)
- **Estimated size:** large (8–12 days). Touches the most load-bearing surface in the product.

**Goal.** Update the RAG pipeline (`packages/rag/`) so retrieval respects `module_branches` for heavy modules. Currently, retrieval reads `module_chunks` (chunks of the canonical body) and ignores branches entirely. After this ticket:

**Retrieval flow change.** When the topic classifier scores a query, retrieval queries `module_chunks` as today, *plus* `module_branches` filtered by the user's care-profile axes (`stage`, `relationship`, `living_situation`). The branch's body is chunked and embedded at ingest time (Cursor adds branch chunking to the existing chunking pipeline) so it can be retrieved by semantic similarity like canonical chunks.

**Branch-chunk metadata.** Each branch chunk carries: `module_id`, `branch_key`, `stage_key`, `relationship_key`, `living_situation_key` plus the existing `attribution_line`, `section_heading`. This lets retrieval rerank by care-profile fit, not just semantic similarity.

**Layer 5 prompt composition** changes: when the picked context includes branch chunks, the prompt template includes the branch context as `[branch: <key>]` so the answer can attribute *"based on the version of this guidance for early-stage parent caring at home..."* if needed.

**Layer 6 verification** unchanged: every claim still must be supported by retrieved context, no banned patterns.

**Acceptance:**

1. Branch bodies are chunked and embedded at ingest time (publish-bundle endpoint extension).
2. RAG retrieval queries both `module_chunks` and `module_branches` chunks.
3. Branch chunks scored by both semantic similarity and care-profile fit.
4. Layer 5 prompt composition includes branch context with attribution.
5. Eval harness extended with care-profile-aware queries; ≥ 90% pass rate before merge.
6. Performance: retrieval latency increases by less than 50ms vs. the current pipeline.
7. End-to-end test: a query about sundowning from a `(early, parent, with_caregiver)` profile retrieves the corresponding branch chunk, not just the canonical body.

**Out of scope:** automatic branch selection re-ranking based on helpfulness signal (defer to a precedent-layer sprint); cross-module branch reasoning (defer).

---

## Sequencing recommendation

**Wave A (week 1, parallel-safe):**

- SURFACES-01 (tool renderers) — biggest visible UX win
- SURFACES-02 (branch toggle) — biggest demo value
- SURFACES-04 (related-modules) — small, fast

**Wave B (week 2, depends on Wave A wired):**

- SURFACES-03 (citations on module pages) — reuses conversation chip components
- SURFACES-05 (picker + soft-flag) — depends on related-modules edges being live

**Wave C (week 3+, depends on Waves A+B):**

- SURFACES-06 (RAG branch-aware retrieval) — biggest leverage, but requires the rest in place to validate the answer-quality wins

Total estimated effort: ~25–35 days of focused Cursor work over 3 calendar weeks if run in parallel. Versus ~$400–800 of Hermes tokens to produce the substrate that feeds these surfaces — front-end work is the more leveraged investment right now.

---

## Definition of done for the sprint

**Implemented**

- A caregiver opens a heavy module on the dev URL and can see: a tailored branch signal, article body, try-this-today aside, interactive tools, typed related-module blocks, evidence panel, and branch preview via `?branch=`.
- Toggling care profile (or using `?branch=`) changes the visible body and citation rows tied to that body.
- Home “this week’s focus” respects `weeks_focus_eligible`; lesson SRS start respects `srs_difficulty_bucket` when set; repeated burnout soft flags can surface a `soft_flag_companion` module as a warm appendix.
- RAG merges canonical and branch chunks with care-axis fit; composition includes branch attribution when branch chunks are selected.
- `pnpm --filter web build` succeeds; `pnpm --filter web test` passes after build (includes production `next start` smoke).

**Deferred / follow-up**

- Per-tool `*.test.tsx` fixtures under `apps/web/src/components/tools/` (acceptance item 3 for SURFACES-01).
- Playwright visual regression on pilot modules (acceptance items 4–6 across tickets).
- Eval harness ≥90% on care-profile-aware queries and latency budget proof (SURFACES-06 acceptance 5–6).
- Per-user tool state persistence (explicitly out of scope for v1; unchanged).

---

## Out of scope for this sprint (named explicitly)

- Per-user tool state persistence across sessions
- A/B testing of picker policy
- Precedent layer (Option C from the context-graphs discussion — multi-quarter, not this sprint)
- Real caregiver interview ingestion to replace composite passages
- Spanish or non-English content surfaces
- Mobile native app
- Push notifications
- Per-citation feedback / source-quality voting

---

## Files this sprint produces, by location

| Location | What |
|----------|------|
| `SPRINT-SURFACES.md` | This document |
| `apps/web/src/components/tools/checklist.tsx` | Checklist tool renderer |
| `apps/web/src/components/tools/decision-tree.tsx` | Decision tree renderer |
| `apps/web/src/components/tools/script.tsx` | Script renderer |
| `apps/web/src/components/tools/template.tsx` | Template renderer |
| `apps/web/src/components/tools/flowchart.tsx` | Flowchart renderer |
| `apps/web/src/components/tools/ModuleToolsSection.tsx` | Tool type dispatch + Zod parse |
| `apps/web/src/lib/library/load-related-modules.ts` | Query `module_relations` |
| `apps/web/src/lib/library/load-evidence.ts` | Query `module_evidence` for the rendered branch |
| `apps/web/src/lib/library/branch-labels.ts` | Branch key labels + `?branch=` parsing |
| `apps/web/src/components/library/ModuleHeavyBranchBar.tsx` | Branch pill + "read other versions" + `?branch=` |
| `apps/web/src/components/library/ModuleEvidencePanel.tsx` | Per-page evidence panel |
| `apps/web/src/components/library/RelatedModulesSection.tsx` | Typed-edges navigation block |
| `apps/web/src/components/modules/ModuleMarkdownWithCitations.tsx` | Inline `[N]` → expandable excerpt |
| `apps/web/src/lib/home/load-warm-companion.ts` + `WarmCompanionCard.tsx` | Soft-flag warm appendix |
| `packages/content/package.json` | Export `./tools` for client-safe schemas |
| `packages/db/migrations/0024_module_branch_chunks.sql` | Branch chunk storage |
| `packages/content/src/heavy/publish-heavy-module.ts` | Writes `module_branch_chunks` at publish |
| `packages/rag/src/db/search.ts` | Merged canonical + branch chunk search |
| `apps/web/src/app/(authed)/app/modules/[slug]/page.tsx` | Page integrates all new surfaces |
| `docs/adr/0033-surfaces-and-branch-aware-retrieval.md` | ADR for surfaces + branch RAG |
