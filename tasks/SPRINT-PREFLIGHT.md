# Sprint 1 preflight (production-realistic gaps)

**What shipped (this pass):** Triage latest-assistant strip logic + required `drivesCrisisStrip` on `TriageCard`; canonical-origin production belt (TS elision callout in `canonical-origin.ts`); `/api/app` `getSession` file audit test (convention/alias blind spot documented); `check:client-bundle` in CI after monorepo build; `CITATIONS_DENORM_INTEGRATION=1` documented in `CONTRIBUTING.md`; optional `packages/db` behavioral citations test.

Checklist to narrow the space between “all unit tests pass” and “the system works under realistic conditions.” None of these are strict ship blockers; prioritize by risk.

1. **Cross-package live E2E** — One run with a real Cognito session, no `conversation-mock`, full path: web → RAG → Bedrock → pgvector → safety Layer B → `messages.citations` → UI chips. Options: operator script with a feature flag, or a Playwright project gated on env.
2. **Crisis strip pulse (end-to-end)** — Covered in `apps/web/test/e2e/conversation.spec.ts` (navigate away + follow-up with non-triaged answer; `TriageCard` only drives the strip when it is the latest assistant turn).
3. **Client bundle / import boundary** — ESLint (value imports) plus **`pnpm --filter web run build` then `pnpm --filter web run check:client-bundle`** to grep compiled `.next/static` for `@alongside/rag` / Bedrock (should find zero; complements lint).
4. **Bundle size** — After `pnpm --filter web build`, compare the First Load JS / route size for `app/conversation` vs other `app` routes. Spikes often mean a server dep leaked into a client graph. Baseline (Next 15, shared chunk): `/app` ≈ 107 kB First Load; `/app/conversation/[id]` ≈ 110 kB; API route handlers show ~102 kB (mostly shared shell).
5. **Citations denorm** — Structural: `load.citations-denorm.test.ts` (no `module_chunks` join). Behavioral: `packages/db/test/citations-denorm.integration.test.ts` with `CITATIONS_DENORM_INTEGRATION=1` and `DATABASE_URL` — updates `module_chunks` and asserts `messages.citations` jsonb unchanged. **Live gate (operator):** with Postgres reachable (e.g. tunnel to `DATABASE_URL` in `apps/web/.env.local`), `CITATIONS_DENORM_INTEGRATION=1 npx dotenv-cli -e apps/web/.env.local -- pnpm --filter @alongside/db test test/citations-denorm.integration.test.ts` — 2026-04-22 attempt: `ECONNREFUSED` to local proxy port (tunnel down); re-run when DB is up and record PASS here.
6. **Migration 0002 on prod-shaped data** — `messages.citations` is `NOT NULL DEFAULT '[]'`. On a large `messages` table, validate lock duration on a copy; low urgency when the table is small.
7. **API auth** — `test/e2e/api-auth.spec.ts` asserts `401` for unauthenticated `conversation` route handlers; `apps/web/test/api-app-session-audit.test.ts` requires every `src/app/api/app/**/route.ts` to reference `getSession(`.
8. **Eval live cost** — See TASK-012 §“Cost budget”; measure one `EVAL_LIVE=1` run before wiring it into always-on automation.
9. **Bedrock / pipeline resilience** — `packages/safety/test/classify.test.ts` covers invoke failure → `triaged: false` + `safety.llm.invoke_failed`. `packages/rag/test/pipeline.test.ts` covers throws → `internal_error`. Re-run with a bogus model id in a dev account if you need live confirmation of logs + user-visible outcome.

## Related ADRs

- `docs/adr/0009` — safety failure modes  
- `docs/adr/0010` — conversation UI, CrisisStrip, citations jsonb
