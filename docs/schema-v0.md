# Schema v0 — tables and ownership

One-page map of the TASK-004 baseline. **Writes** = which ticket primarily inserts/updates; **reads** = consumers in Sprint 1.

## ERD (ASCII)

```
┌─────────────┐       ┌──────────────┐       ┌────────────────┐
│   users     │──1:1──│ care_profile │       │   modules      │
│ cognito_sub │       │  (per user)  │       │ slug, tier…    │
└──────┬──────┘       └──────────────┘       └───────┬────────┘
       │                                             │
       │ 1:N                                         │ 1:N
       ▼                                             ▼
┌─────────────┐                              ┌────────────────┐
│conversations│                              │ module_chunks  │
└──────┬──────┘                              │ embedding v1024│
       │                                      └────────────────┘
       │ 1:N
       ▼
┌─────────────┐       ┌────────────────┐
│  messages   │──1:N──│ safety_flags   │
└─────────────┘       └────────────────┘
```

## Tables

| Table | Purpose | Writes (tickets) | Reads |
| --- | --- | --- | --- |
| `users` | Cognito `sub` + display email/name | TASK-007 onboarding | API auth layer, conversation UI |
| `care_profile` | Structured caregiver / CR profile (PRD §5) | TASK-007 | RAG Layer 3 filters, prompts |
| `conversations` | Thread per home-screen query | TASK-011 | Home list, thread UI |
| `messages` | User/assistant/system turns + scaffold JSON | TASK-009, TASK-010, TASK-011 | UI, eval harness, safety review |
| `modules` | Reviewed content module (Markdown + metadata) | TASK-008 ingest | RAG attribution, ops |
| `module_chunks` | Chunk text + **pgvector** embedding + denormalized metadata | TASK-008 | TASK-009 retrieval |
| `safety_flags` | Classifier outcomes per risk category | TASK-010 | Weekly review (PRD §10) |

## Extensions

- `pgcrypto` — `gen_random_uuid()` defaults.
- `vector` — `module_chunks.embedding vector(1024)` and HNSW index.

## App connection

Runtime apps should use the **`hypercare_app`** role (see `packages/db/scripts/bootstrap-app-role.sql` and `docs/infra-runbook.md`), not `hypercare_admin`.
