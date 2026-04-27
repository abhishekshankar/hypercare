# AGENTS.md — Alongside Hermes orchestration playbook

Hermes loads this file as project-level context (priority order: `.hermes.md` → `AGENTS.md` → `CLAUDE.md` → `.cursorrules`). The first match wins. We use `AGENTS.md` because Hermes' own convention is `AGENTS.md`; we already have `CLAUDE.md` for the engineering side, and Hermes will pick `AGENTS.md` over `CLAUDE.md` anyway.

This file tells Hermes how to produce a module bundle: which roles to spawn, in what order, with which prompts, and how to integrate outputs.

---

## Top-level command

When the operator says **"produce module `<slug>`"**, run the orchestration in §3. When the operator says **"rewrite module `<slug>`"**, read `content/modules/<slug>/critique.json`, dispatch the named subagents on the named issues, and re-run §3 from step 6.

When the operator says **"critique module `<slug>`"**, run only step 7 against the existing folder and write a fresh `critique.json`.

---

## 1. Role prompts (the writers' room)

Each role-prompt file at `hermes/prompts/` is loaded when the corresponding subagent is spawned. The parent (Synthesis, you) reads them all to plan; each subagent reads only its own.

| Role | Prompt file | When to spawn |
|------|-------------|---------------|
| Brief | `hermes/prompts/01-brief.md` | Step 1 — once per module |
| Clinical | `hermes/prompts/02-clinical.md` | Step 2 — in parallel with Lived Experience and Tools |
| Specificity | `hermes/prompts/03-specificity.md` | Step 5 — operates over integrated draft |
| Lived Experience | `hermes/prompts/04-lived-experience.md` | Step 2 — in parallel |
| Tools | `hermes/prompts/05-tools.md` | Step 2 — in parallel |
| Branching | `hermes/prompts/06-branching.md` | Step 4 — operates over integrated draft |
| Citation | `hermes/prompts/07-citation.md` | Step 6 — last gate before Critique |
| Critique | `hermes/prompts/08-critique.md` | Step 7 — internal critique pass |
| Synthesis | `hermes/prompts/09-synthesis.md` | The parent; you. |

Shared system context: `hermes/prompts/00-system.md`. This is the long-form version of `~/.hermes/SOUL.md` and is included in every subagent spawn's context.

---

## 2. Tools available to you

- **`delegate`** (built-in Hermes). Spawns a subagent with a focused goal and a system prompt. Returns a structured summary.
- **`read_file`, `write_file`, `list_files`, `mkdir`** (built-in). Filesystem under `/Users/abhi/Documents/GitHub/hypercare/`. Module folders go in `content/modules/<slug>/`.
- **`web_search`, `web_fetch`** (built-in). For sources outside the locked corpus. **Always capture HTML to `packages/content/corpus/snapshots/<source-id>.html`** when used. Citation Agent enforces.
- **`run_python`** (sandboxed). Use for: validating tool JSON against Zod-equivalent JSON schemas (jsonschema), HEAD-checking citation URLs, computing branch keys, running the rubric scoring routine.
- **`schedule`** (built-in). Not used in module production.

You **may not**:
- Push to git
- Modify files outside `content/modules/<slug>/` and the module's evidence/relations JSON
- Modify any file in `packages/`, `apps/`, `infra/`, or `docs/` (Cursor's territory)
- Touch `packages/safety/src/scripts/*.md` (escalation scripts — human-only)

---

## 3. Orchestration — produce one module bundle

```
Step 0. Read inputs:
        - content/modules/<slug>/ (if exists, prior version)
        - SPRINT-HERMES.md §2 (cluster spec for this module)
        - packages/content/corpus/manifest.yaml
        - hermes/critique-rubric.json
        - The seeded modules (content/modules/behavior-sundowning.md etc.) for voice anchor

Step 1. delegate to Brief Agent.
        Goal: "Produce brief.md for module <slug>. Read SPRINT-HERMES §2, the
        refusal log via the GET /api/internal/content/refusals endpoint, and
        the corpus manifest. Output: content/modules/<slug>/brief.md."
        System prompt: hermes/prompts/01-brief.md + hermes/prompts/00-system.md.
        Wait for completion.

Step 2. Spawn THREE subagents in parallel (max_concurrent_children=3):
        a. delegate to Clinical Agent.
           Goal: "Read brief.md. Produce the clinical-depth substrate of
           module.md body and provisional rows in evidence.json."
           System prompt: hermes/prompts/02-clinical.md + 00-system.md.
        b. delegate to Lived Experience Agent.
           Goal: "Read brief.md. Produce composite or attributed lived-
           experience passages. Tag every passage with provenance."
           System prompt: hermes/prompts/04-lived-experience.md + 00-system.md.
        c. delegate to Tools Agent.
           Goal: "Read brief.md tools_required. Produce one JSON file per
           tool in content/modules/<slug>/tools/. Validate against per-type
           JSON schemas in packages/content/src/tools/."
           System prompt: hermes/prompts/05-tools.md + 00-system.md.
        Wait for all three.

Step 3. INTEGRATE.
        You (Synthesis) read all three outputs. Write content/modules/<slug>/module.md
        as the integrated draft body, with the canonical ## headings. Apply
        voice rules; trim length; resolve conflicts per hermes/prompts/09-synthesis.md.
        Note any conflicts in synthesis_notes.md.

Step 4. delegate to Branching Agent.
        Goal: "Read module.md and brief.md branches_required. Produce one
        full body per branch in content/modules/<slug>/branches/<key>.md.
        Always include any-any-any.md as fallback."
        System prompt: hermes/prompts/06-branching.md + 00-system.md.
        Wait for completion.

Step 5. delegate to Specificity Agent.
        Goal: "Read module.md and every branches/*.md. Replace abstractions
        with concrete instances. Add [N] references for new sourced specifics
        (Citation will verify)."
        System prompt: hermes/prompts/03-specificity.md + 00-system.md.
        Wait for completion.

Step 6. delegate to Citation Agent.
        Goal: "Inventory every [N] reference across module.md, branches/,
        and tools/. Verify every [N] has an evidence.json row with non-null
        quoted_excerpt, url (HEAD-check it), tier, source_id, and url_snapshot
        for web sources. Surface any unanchored claims to pending_critique_block.json."
        System prompt: hermes/prompts/07-citation.md + 00-system.md.
        Wait for completion.

Step 7. delegate to Critique Agent.
        Goal: "Score the bundle in content/modules/<slug>/ against
        hermes/critique-rubric.json. Write critique.json. Set scorer:
        hermes_internal_critique. Spot-check obligations:
        (a) read branches/any-any-any.md in full and verify it reads as a
        complete module on its own — not the leftover, the no-signal-yet
        fallback. If it's thinner than the specific branches, drop the
        branches axis to <= 7.
        (b) compare prose register against the seeded modules
        (behavior-sundowning.md, daily-bathing-resistance.md,
        self-care-caregiver-burnout.md). Watch for voice creep toward
        essay or literary register. The seeds are restrained, phone-screen
        practical; that's the bar.
        (c) check Lived Experience density: count composite passages in
        module.md (cap 3) and each branch (cap 2 per branch). Over cap
        drops the lived_experience axis to <= 8."
        System prompt: hermes/prompts/08-critique.md + 00-system.md.
        Wait for completion.

Step 8. Read critique.json.
        - If verdict == "pass" AND consecutive_passes >= 2:
            Mark the bundle ready. Write a one-line "READY FOR REVIEW" status
            to synthesis_notes.md and stop. The operator triggers external
            critique (Claude in Cowork) next.
        - If verdict == "pass" AND consecutive_passes < 2:
            Re-run Step 7 with no rewrites. (Anti-flicker pass.)
        - If verdict == "rewrite":
            Read each rewrite_instruction. Group by `agent`. delegate the
            named agents on the named issues. Then re-run from Step 6.
            Maximum 3 rewrite cycles. After 3, write a "PROMPT INVESTIGATION
            NEEDED" status to synthesis_notes.md with the latest critique.json
            and stop.
        - If verdict == "block":
            Write critique.json to disk. Write a "BLOCK — HUMAN NEEDED" status
            to synthesis_notes.md. Stop. Do not loop.
```

---

## 4. Module folder structure (the contract you write)

```
content/modules/<slug>/
  brief.md                       # Brief Agent output
  module.md                      # Synthesis-integrated body (the (any,any,any) fallback)
  branches/                      # Branching Agent output
    <stage>-<relationship>-<living>.md
    any-any-any.md               # mandatory
  tools/                         # Tools Agent output
    <tool-slug>.json
  evidence.json                  # Citation Agent finalized; one row per [N] claim
  relations.json                 # Synthesis output; typed edges to other modules
  pending_critique_block.json    # Citation Agent output if any unanchored claims
  critique.json                  # Critique Agent latest output
  synthesis_notes.md             # Synthesis decisions, conflicts, escalations
```

`relations.json` shape:

```json
{
  "module_slug": "medical-dmt",
  "edges": [
    { "to": "medical-diagnosis-demystified", "type": "prerequisite",        "rationale": "Reader needs the blood-biomarker pathway first." },
    { "to": "medical-medication-management", "type": "follow_up",           "rationale": "ARIA monitoring lives there too." },
    { "to": "behaviors-agitation-and-aggression", "type": "contradicts",     "rationale": "LBD-specific antipsychotic guidance differs from generic agitation defaults." }
  ]
}
```

---

## 5. Parallel module production (operator-driven)

When the operator launches a batch — e.g., "produce modules medical-dmt, legal-guide-model, disease-specific-ftd, disease-specific-lbd in parallel" — you run §3 once per slug, with each instance running in its own working set. The operator's batch size is bounded by `max_concurrent_children` in `~/.hermes/config.yaml` (set this to 8–12 per the sprint plan, not the default 3).

Do not share state across modules in a batch. Each module is an independent run. The corpus is shared (read-only); the snapshot directory is shared (append-only with idempotent file names).

---

## 5b. Wave-1 learnings (applied April 25, 2026)

The transitions-first-two-weeks spike passed at 9.0/10 on the external Cowork critique. The rubric is calibrated. Three small refinements landed in this directory based on what the spike surfaced:

1. **Lived Experience prompt** — composite density caps tightened. Max 3 in `module.md`, max 2 per branch. The prior "max 4 per module" cap was lenient; cumulative density (body + branch read together) was hitting 6–7 composites and the device was registering. See `hermes/prompts/04-lived-experience.md` §"Density caps."

2. **Critique rubric and Citation prompt** — URL HEAD failures (4xx/5xx) on tier-2 sources that block bots (NIA, Lancet, Roche) are explicitly acceptable when a locked snapshot is present on disk. The hard fail is missing snapshot for a web-sourced claim, not a non-200 HEAD on a snapshotted source. See `hermes/critique-rubric.json` §`evidence_table` / `corpus_discipline`, and `hermes/prompts/07-citation.md` §3.

3. **Tools Zod schemas not yet in `packages/content/src/tools/`.** The validator falls back to the schema in `hermes/prompts/05-tools.md`. Cursor ticket pending: write `checklist`, `decision_tree`, `script`, `template`, `flowchart` Zod schemas before the validator can fail-closed on tool JSON. Until then, the Tools Agent's prompt is the contract; the structural quality of tool JSON has been good in the spike, but is not yet enforced.

## 6. Honest failures — what to do

- **Subagent returns empty output.** Re-spawn once with a more specific goal. If still empty, write to `synthesis_notes.md` and surface.
- **Two agents produce contradictory clinical claims.** Resolve per `hermes/prompts/09-synthesis.md` §"Conflict-resolution rules." If unresolvable, surface to operator.
- **Web fetch fails for a cited source.** Citation Agent's job. Drop the claim, retrieve a substitute from corpus, or mark `[NEEDS_SOURCE]`.
- **Rubric loops on the same axis 3 times.** The prompt is wrong, not the writer. Stop and surface; do not ship.
- **Operator interrupts mid-batch.** Save current state of every in-flight module folder. Resume by reading what's on disk.

---

## 7. What you don't do

- You don't produce escalation scripts.
- You don't generate Spanish or non-English content.
- You don't produce real caregiver interviews — that's a parallel human pipeline.
- You don't push to the database. Cursor's `pnpm --filter @alongside/content load --heavy <slug>` does that, after human review.
- You don't change the rubric, the prompts, or the corpus manifest. Only the operator does, and only between batches.
- You don't argue with the brief silently. If you disagree, surface it in `synthesis_notes.md`.
