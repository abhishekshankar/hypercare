# TASK-028 — Content authoring & review tool v0 (PRD §8 pipeline, internal)

- **Owner:** Cursor
- **Depends on:** TASK-008 (content loader + `module_chunks` embedding pipeline; this tool's publish step reuses it), TASK-021 (admin-gated surfaces exist — reuse the role/auth pattern), TASK-023 (library reads modules; the tool writes modules)
- **Unblocks:** the content team's 30–50-module ramp (PRD §7.1 library) without blocking every module on a dev PR
- **Status:** pending
- **ADR:** `docs/adr/0018-content-authoring-tool.md` (new — workflow states, data model, why-not-Contentful decision)

---

## Why this exists

PRD §8.3 defines a 7-stage drafting process: Brief → Source research → Draft → Content Lead edit → Expert review → Lived-experience review → Final approval & publish. Today engineering ingests modules via a one-shot script (`packages/content/src/seed.ts` from TASK-008). That was fine for the 3 pilot modules. It does not scale to 50, and crucially it forces every content change through a Cursor PR — which defeats the point of a content team.

This ticket ships an **internal web tool** that implements the 7-stage workflow, stores drafts + reviews + metadata in the product database, and re-uses the existing embedding / chunking pipeline on `publish`. It is deliberately small: draft form, review surface, workflow states, publish button. Not a full CMS. The PRD §8.4 maintenance cadence fits inside the same tool.

**Why not Contentful / Sanity.** (ADR 0018 records this properly.) An external CMS adds a second data plane, a third auth system, an integration layer, and a five-figure annual spend. The content pipeline in PRD §8 is **review-heavy and template-light** — we don't need block-based editing, i18n pipelines, or multi-environment publishing. A minimal internal tool is a better fit for v0. If the review / draft model grows, revisit after 20 modules have flowed through it.

---

## Context to read first

1. `prd.md` §7 (module shape — what each module carries), §8 (the full content pipeline this tool implements), §10.4 (soft-flag log — the tool surfaces this for the Content Lead weekly audit).
2. `packages/content/src/seed.ts` — today's ingestion path. The tool calls into the same chunk + embed logic on publish.
3. `packages/db/src/schema/modules.ts`, `module-chunks.ts`, `module-topics.ts` (from TASK-019) — the existing tables. This ticket **adds** fields (draft state, review metadata) to `modules` and **adds** new tables for briefs, evidence, and reviews.
4. `apps/web/src/app/(authed)/` — how authed surfaces compose today. The internal surfaces live under `/internal/`.
5. `docs/adr/0006-content-pipeline-v0.md` — TASK-008's ingestion decisions.

---

## What "done" looks like

### 1. Roles + access

Reuse the role column added on `users` in TASK-021 (admin role for the burnout-flag audit surface, if that shipped there — otherwise add it here). Roles in v0:

- `caregiver` (default; normal users).
- `content_writer`.
- `content_lead` (can edit any draft, assign reviewers, publish).
- `medical_director`, `care_specialist`, `caregiver_support_clinician`, `lived_experience_reviewer` (can read assigned drafts, submit review verdicts).
- `admin` (everything).

Access check is a single server-side helper `requireRole([...roles])` used by every `/internal/content` route. No client-side role hiding only — the server is the source of truth.

### 2. Workflow states per module

Add to `modules` table:

```
draft_status text not null default 'draft' check (draft_status in (
  'draft', 'content_lead_review', 'expert_review', 'lived_experience_review',
  'approved', 'published', 'retired'
))
assigned_expert_reviewer_id uuid references users(id)
assigned_lived_reviewer_id uuid references users(id)
brief_id uuid references module_briefs(id)
```

And a state machine (`packages/content/src/workflow.ts`):

```
draft → content_lead_review → expert_review → lived_experience_review → approved → published
(any state) → draft              (Content Lead can always return to draft with a reason)
published → retired              (archive without deleting history)
```

The transitions are enforced server-side. Transitions write to `module_state_transitions(id, module_id, from, to, by_user_id, reason text, created_at)`.

### 3. New tables

```
module_briefs
  id uuid pk
  topic text not null                       -- informal; maps to a library topic slug on approve
  audience text not null                    -- stage(s), caregiver situation
  stage_relevance text[]                    -- 'early' | 'middle' | 'late' | 'any'
  desired_outcome text not null
  proposed_title text
  queue_reason text                         -- 'content_plan' | 'refusal_path' | 'user_request'
  created_by uuid references users(id)
  created_at timestamptz
  status text not null default 'open'       -- 'open' | 'claimed' | 'drafted' | 'rejected'
  claimed_by uuid references users(id)

module_evidence
  id uuid pk
  module_id uuid references modules(id) on delete cascade
  source_tier int not null check (source_tier in (1,2,3))   -- PRD §7.3 tier
  source_type text not null                 -- 'url' | 'book' | 'paper' | 'intervention' | 'pac'
  citation text not null                    -- freeform human-readable citation
  url text
  quoted_support text                       -- the exact sentence / paragraph that supports a claim
  added_by uuid
  added_at timestamptz

module_reviews
  id uuid pk
  module_id uuid references modules(id) on delete cascade
  reviewer_user_id uuid not null references users(id)
  review_role text not null check (review_role in (
    'content_lead', 'medical_director', 'care_specialist',
    'caregiver_support_clinician', 'lived_experience'
  ))
  verdict text not null check (verdict in ('approve','reject','request_changes'))
  comments_md text
  reviewed_at timestamptz not null default now()

module_versions
  id uuid pk
  module_id uuid references modules(id) on delete cascade
  version int not null                      -- monotonic per module
  body_md text not null                     -- snapshot at publish
  try_this_today text
  summary text
  published_at timestamptz not null default now()
  published_by uuid
  unique (module_id, version)
```

Migrations under `packages/db/migrations/`, documented in `docs/schema-v1.md`.

### 4. Routes (all under `/internal/content`, admin-role-gated at the layout level)

Read-first:

- `/internal/content` — list drafts, filtered by state + assigned reviewer. Shows a kanban-ish view: Brief → Draft → CL review → Expert → Lived → Approved → Published.
- `/internal/content/briefs` — list of module briefs (queue). Pulled from two sources: content-plan entries PM enters here, and "Would you like us to add this topic?" requests from the refusal path (PRD §9.3 — TASK-009 already writes these somewhere; surface here).
- `/internal/content/modules/[id]` — module detail. Shows the current draft, evidence entries, review history, state transitions, and — when state = `published` — the live chunks + embeddings view.
- `/internal/content/modules/[id]/edit` — the drafting surface. Two-pane: markdown editor on the left (simple `<textarea>` with monospace; no fancy editor), preview on the right. Side panel: evidence list with `+ add` button.
- `/internal/content/modules/[id]/review` — reviewer view. Shows the draft, the evidence table, a verdict form (approve / request_changes / reject) + comments.

Write routes:

```
POST /api/internal/content/briefs                      # create a brief (content_lead, admin)
POST /api/internal/content/briefs/[id]/claim           # writer claims a brief, creates a draft module row
POST /api/internal/content/modules/[id]                # save edits (draft state; writer or content_lead)
POST /api/internal/content/modules/[id]/evidence       # add evidence entry
POST /api/internal/content/modules/[id]/transition     # state transition (server checks role + legality)
POST /api/internal/content/modules/[id]/review         # submit a review verdict
POST /api/internal/content/modules/[id]/publish        # only from state=approved; content_lead + medical_director for medical category
```

Every route `zod`-validated, 401 on missing session, 403 on wrong role.

### 5. Publish = re-embed

On `publish`:

1. Snapshot body into `module_versions` (version = prior max + 1).
2. Write the current copy to the live `modules` row (so the library reads the latest).
3. **Delete existing `module_chunks` for this module, re-chunk + re-embed with the same code path as `packages/content/src/seed.ts`.** (Do not branch the ingestion logic — factor it into `packages/content/src/ingest.ts` and call it from both seed and publish.)
4. Write `modules.last_published_at = now()`.
5. Trigger a log event so the metrics surface (TASK-029) can show "last published" per module.

If any step fails, roll back: modules row stays at the previous version, chunks stay intact. ADR 0018 describes the transactional guarantee (a Postgres transaction across the four DB steps + a compensating delete if embedding fails mid-flight).

A **retire** transition does **not** delete chunks — retirement removes the module from library surfacing but keeps it retrievable in case the refusal path or an existing conversation references it. Retired modules get a `retired` badge in the internal tool.

### 6. Medical-category extra gate

PRD §8 says the Medical Director signs off on medical content. Implement:

- A module's category (from PRD §7.1) determines the required `review_role` set:
  - Category `medical` → require a `medical_director` approve **and** a `care_specialist` approve.
  - Category `behaviors` | `daily_care` | `communication` → require `care_specialist` approve.
  - Category `caring_for_yourself` → require `caregiver_support_clinician` approve.
  - Category `legal_financial` → require a placeholder `domain_sme` role (legal/financial SME); v0 may approve with `admin` + a comment if the SME role isn't seeded yet.
- Plus always a `content_lead` approve + at least one `lived_experience` approve.

Enforce in the state machine's `approved → published` transition. The publish button is only enabled when the required review set is complete.

### 7. Weekly audit surface

A `/internal/content/audit` page for the Content Lead + Caregiver-Support Clinician's weekly review (PRD §10.2, §8.4):

- Last 50 RAG refusals ("thin sources") grouped by query text.
- Last 50 safety-flag categories (links into TASK-029's surface for the actual review — don't duplicate).
- Modules approaching their `next_review_due` (from TASK-025's frontmatter discipline — same pattern, for modules).
- Modules with retrieval-zero (never pulled in the last 30 days) → candidate for retirement or topic expansion.

The audit page is read-only in v0. Actions (retire, expand topic) are taken from the module detail page.

### 8. Seeding the writer + reviewer roles

A CLI script `packages/content/src/scripts/seed-roles.ts` that PM runs once to mark specific user IDs as `content_lead`, `medical_director`, etc. No self-service role assignment in v0 — an admin (PM) sets roles from the CLI.

---

## Tests

- Unit (`packages/content/test/workflow.test.ts`): state machine — legal transitions pass, illegal ones throw, role restrictions respected.
- Unit (`packages/content/test/publish.test.ts`): publish path triggers re-embed, writes a `module_versions` row, rolls back on embed failure.
- Unit (`packages/content/test/medical-gate.test.ts`): medical category cannot publish without both `medical_director` and `care_specialist` approves.
- Integration (`apps/web/test/api/internal-content.test.ts`): full happy path — create brief → claim → draft → CL review → expert review → lived review → publish → library shows the module, retrieval pulls it as a chunk.
- E2E (`apps/web/test/e2e/content-authoring.spec.ts`): log in as content_lead, walk through the kanban, open a module, edit body, save, transition, see it appear in `/app/library`.
- Role-gate tests: a `caregiver`-role user hitting `/internal/content/*` gets 403; the read surfaces render only allowed actions per role.

---

## Acceptance criteria

- The 7-state workflow runs end-to-end on the test user. A new module can be written, reviewed, published, and appears in `/app/library` and in retrieval within a minute.
- Medical category cannot publish without the two required reviews; UI reflects the gating.
- Retire transition works and preserves chunks.
- Audit surface shows refusals, flags, upcoming reviews, and retrieval-zero modules.
- The CLI role-seeding script runs cleanly.
- New tables migrated, documented in `docs/schema-v1.md`.
- ADR 0018 written, including the "why not Contentful" rationale and the workflow state machine diagram.
- `pnpm lint typecheck test` green; eval doesn't regress; `pnpm --filter @hypercare/content check:ingest` (an offline smoke of the shared ingest path) still passes.

---

## Out of scope

- WYSIWYG / rich-text editing. Markdown only.
- Multi-environment publish (staging vs prod). One DB, one copy.
- i18n. Modules are English only in v1 (PRD §1.3).
- Block-based content model (Notion-style blocks). A module is one markdown document + front-matter.
- Inline comments on drafts. Reviews are verdicts + a comment block, not line-threading.
- Brief generation from AI. Briefs are written by PM / Content Lead.
- Image upload / asset management. Modules are text-only in v1 (PRD §6.5 — no video, no audio).
- Scheduled publishing. Publish happens on button-press.
- Version rollback UI. `module_versions` is stored; rolling back is a DBA operation in v0 (documented in the runbook).
- External CMS. Not in v0. Not in v1. Revisit after 20 modules.

---

## Decisions to make in the PR

- **Where the tool lives — `/internal/content` under `apps/web` or a separate micro-app.** My vote: inside `apps/web`. Shared auth, shared DB, no extra deploy. ADR notes this.
- **Markdown editor.** Plain `<textarea>` + client-side preview, or a small library (e.g. `react-markdown-editor-lite`)? My vote: plain textarea + preview. Keep the bundle small; no new dep.
- **Evidence-table required before `expert_review`?** My vote: yes — blocks the transition if `module_evidence` count < 1. Rationale: forces the discipline.
- **Brief queue source — auto-create briefs from the refusal path's "add this topic" button** (TASK-009 already writes these) **or manual.** My vote: auto-create as `open` status with `queue_reason = 'refusal_path'`. Content Lead can dismiss.
- **Medical category + `domain_sme` for legal/financial.** If the role isn't seeded, allow an `admin` override with a comment; log it explicitly.

---

## Questions for PM before starting

1. **Role seeding.** Before the first content_lead log-in, you'll give me a list of user IDs per role. I'll run the seed script.
2. **The markdown shape we want writers to produce.** TASK-019 added `try_this_today` as a column; TASK-023 indexed modules by `##` headings for lesson splitting. Writers need a **template** — create `packages/content/templates/module-template.md` and prefill it on brief claim.
3. **Do you want a "content KPIs" widget** on the audit surface (e.g. avg days in each state, reviewer SLA adherence)? My vote: not in v0; revisit after the first 10 modules flow.
4. **What happens to the 3 seeded pilot modules** — do they get backfilled with brief + evidence + review metadata, or do they remain as schema-minimal records? My vote: backfill with a one-line brief, an evidence entry pointing to the seed file, and a synthetic "reviewed by Hypercare team, 2026-04-01" review — so the audit surface is consistent. Log the backfill.

---

## How PM verifies

1. Run the role-seed CLI; log in as a `content_lead` test user.
2. `/internal/content` — the kanban renders, the 3 pilot modules show as `published`.
3. Create a brief for "wandering prevention — middle stage." Claim it. Draft a module (markdown). Save.
4. Transition draft → content_lead_review (self). Then back to draft, then forward again.
5. Assign an expert reviewer. Log in as that reviewer. Submit `approve`. Log back in as content_lead; note the expert-review checkbox lit.
6. Assign a lived-experience reviewer; submit `approve`. State auto-advances to `approved`.
7. Publish. Wait 30s. `/app/library` shows the module. Send a question matching the topic; retrieval pulls the new module as Tier-1.
8. `psql -c "select id, version, published_at from module_versions where module_id = '…';"` — one row.
9. Retire the module. `/app/library` no longer shows it, but retrieval still has its chunks; the question still pulls it as Tier-1.
10. Read ADR 0018.
