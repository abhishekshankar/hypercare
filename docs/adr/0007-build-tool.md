# ADR 0007 — Production build uses Webpack; local dev uses Turbopack

## Status

Accepted (Sprint 1).

## Decision

**`next build` (production / CI) uses Webpack.** **`pnpm dev` uses Turbopack** (`next dev --turbopack`). As of **Next.js 15.5.15**, the Turbopack production manifest omits `dataRoutes` (and related route metadata) that **`next start`** and the **`screens.smoke` Vitest suite** rely on when exercising the production server. Building with Turbopack therefore broke `next start` and the smoke test until we pinned the production path to Webpack. Revisit when a Next release documents a fix or stable alternative; until then, treat “dev = Turbopack, build/start = Webpack” as intentional.

## Related

- `apps/web/package.json` — `dev` vs `build` scripts.
- `apps/web/src/screens.smoke.test.ts` — production server smoke.
