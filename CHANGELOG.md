# Changelog

All notable changes to this repo are documented here. The format is loose; align new entries with [Keep a Changelog](https://keepachangelog.com/) when practical.

## Unreleased

### Documentation

- Expanded [ARCHITECTURE.md](ARCHITECTURE.md) with app API routes for privacy, transparency, feedback, saved answers, library SSE, suppression, cron jobs, and internal operator surfaces.
- Documented conversation answer streaming env pair in [README.md](README.md) (TASK-031 / ADR 0020).
- [CLAUDE.md](CLAUDE.md): note on `routing_cohort` read in the conversation message route and Vitest mocking pattern.
- [CONTRIBUTING.md](CONTRIBUTING.md): guidance for Route Handler tests that must not hit Postgres.

### Tooling / tests

- `@hypercare/eval` redteam JSON report typing fixed for TypeScript `exactOptionalPropertyTypes` (`layer_b_classifier` omitted when unset).
- `apps/web` Vitest: `upsertUserFromClaims` mock includes `update` chain; conversation escalation tests mock `@hypercare/db` and partially mock `@/lib/env.server`.

### Product themes (reference)

Shipping work on `main` spans streaming surfaces (answers, lessons, library), privacy export/delete/sessions, transparency memory APIs, feedback + internal triage + SLA cron, Layer-5 model routing + cohort, fine-tuned safety shadow tooling, and internal metrics tiles. Canonical detail lives in `tasks/`, `docs/adr/`, and `docs/schema-v1.md` / `docs/schema-v2.md`.
