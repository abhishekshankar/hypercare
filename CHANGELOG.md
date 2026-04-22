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

### Ops / runbooks

- [CLAUDE.md](CLAUDE.md) "Amplify Hosting (build succeeds, site is 404)": runbook for the `server: AmazonS3` 404 symptom — Amplify app registered as platform `WEB` serves `.next` statically from S3; fix is platform `WEB_COMPUTE` + framework `Next.js - SSR`, with `AMPLIFY_MONOREPO_APP_ROOT=apps/web` matching root `amplify.yml`. Console path + `aws amplify update-app` CLI equivalent both documented.
- Amplify monorepo hosting: root `amplify.yml` now uses `buildPath: /` and artifact `apps/web/.next`; root `.npmrc` adds `node-linker=hoisted` for pnpm on Amplify; `apps/web` Next config adds `output: 'standalone'` and `outputFileTracingRoot` for workspace file tracing when platform is already `WEB_COMPUTE` but the live URL still behaved like static S3.

### Product themes (reference)

Shipping work on `main` spans streaming surfaces (answers, lessons, library), privacy export/delete/sessions, transparency memory APIs, feedback + internal triage + SLA cron, Layer-5 model routing + cohort, fine-tuned safety shadow tooling, and internal metrics tiles. Canonical detail lives in `tasks/`, `docs/adr/`, and `docs/schema-v1.md` / `docs/schema-v2.md`.
