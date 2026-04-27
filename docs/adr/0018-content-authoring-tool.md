# ADR 0018 — Internal content authoring & review tool (v0)

**Status:** accepted  
**Context:** PRD §8.3 seven-stage process; TASK-008 disk ingest does not scale to 30–50 modules or content-team velocity.

## Decision

Ship an **internal** surface at `/internal/content` in `apps/web` (shared Cognito session and Postgres — no second deploy, no second auth plane) that stores briefs, evidence, review verdicts, workflow state, and version snapshots in Postgres. **Publish** reuses the same chunking + Titan embedding path as the operator `load` tool (`@alongside/content` ingest), factored as `replaceModuleChunkRowsInTx` + `publishModuleFromDatabase`.

## Why not Contentful / Sanity (etc.)

- Second data plane, integration work, and ongoing vendor cost.  
- PRD content is **review-heavy and template-light**; we are not block-editing a marketing site.  
- Revisit an external CMS after ~20 production modules if block editing, i18n, or multi-env publishing become blockers.

## Workflow states

Linear progression (state machine enforced in `@alongside/content` `validateTransitionRequest` and API routes):

```text
draft → content_lead_review → expert_review → lived_experience_review → approved
```

**Published** and **retired** are not advanced via the general transition table:

- `approved` → **published** only via `POST /api/internal/content/modules/[id]/publish` (re-embed + `module_versions` snapshot).  
- **(any)** → `draft` (Content Lead, with `reason` text) — return for rework.  
- `published` → `retired` (archive: `draft_status = retired`, `published = false`, **chunks kept** for historical retrieval / thread references).

`module_state_transitions` stores `from_status` / `to_status` (SQL reserved `from` / `to` were renamed to `from_status` / `to_status` in schema).

## Category → required review roles (before publish)

| Category | Approvals (all `approve` verdicts) |
| --- | --- |
| `medical` | `content_lead`, `medical_director`, `care_specialist`, `lived_experience` |
| `behaviors`, `daily_care`, `communication`, `transitions` | `content_lead`, `care_specialist`, `lived_experience` |
| `caring_for_yourself` | `content_lead`, `caregiver_support_clinician`, `lived_experience` |
| `legal_financial` | `content_lead`, `domain_sme` (v0: often an `admin` reviewer with `domain_sme` row + comment), `lived_experience` |

## Transactional guarantee on publish

1. Build embeddings for all chunks **outside** a DB transaction (Bedrock can fail; no DB writes yet).  
2. Open one transaction: insert `module_versions` row, update live `modules` text + `draft_status`/`published`/`last_published_at`, replace `module_topics` + `module_chunks`.  
3. If (2) fails, Postgres rolls back; embeddings from (1) are discarded (idempotent to retry).

## Alternatives considered

- **Separate micro-frontend** — rejected to avoid two deploys and auth duplication in v0.  
- **Rich MD editor** — rejected: plain `<textarea>` + `react-markdown` preview to keep bundle small.  
- **WYSIWYG / blocks** — out of scope (PRD module = one doc + front-matter discipline).

## Consequences

- `users.role` and new tables (see `docs/schema-v1.md` and migration `0008_content_authoring_workflow.sql`).  
- Library lists exclude `draft_status = retired` even if chunks still exist.  
- Metrics “last published” can read `module_versions` / `last_published_at` (TASK-029 can subscribe without a separate event bus in v0).
