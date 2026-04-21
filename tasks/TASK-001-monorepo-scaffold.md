# TASK-001 — Monorepo scaffold, lint, typecheck, CI

**Owner:** Cursor
**Depends on:** —
**Status:** in_review

## Why this exists

Every later ticket assumes `pnpm install && pnpm dev` works, lint and typecheck pass, and CI runs on PRs. Without this, every later ticket has to half-do this work. We do it once, here, properly.

## Context

Read `PROJECT_BRIEF.md §2 (Stack)` and `§3 (Repo layout)` and `§5 (Conventions)` first. This ticket implements the skeleton described there. Nothing user-facing ships here.

## Acceptance criteria

- [ ] `package.json` at the repo root configures **pnpm workspaces** with `apps/*`, `packages/*`, and `infra` as workspaces.
- [ ] `pnpm-workspace.yaml` mirrors the above.
- [ ] `apps/web` exists as a Next.js 15 app (App Router, TypeScript, `strict: true`, React 19) created with `pnpm create next-app` and pruned of any unused boilerplate. Tailwind enabled. ESLint enabled.
- [ ] `packages/db`, `packages/rag`, `packages/safety`, `packages/eval` exist as empty TypeScript packages with a minimal `package.json` and `tsconfig.json` extending a shared `tsconfig.base.json` at the root. Each exports `index.ts` with `export {};` so they build clean.
- [ ] `infra/` exists as an empty CDK app (`cdk init app --language=typescript`) with `cdk.json` configured, but **no stacks yet** beyond `bin/infra.ts` instantiating an empty `App`. (Real resources land in TASK-003.)
- [ ] Root `tsconfig.base.json` enables `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- [ ] Root `.eslintrc` (or flat config) is shared across workspaces; `eslint-config-next` extended in `apps/web`.
- [ ] Prettier configured at the root with a `.prettierrc` and a `pnpm format` script.
- [ ] Root `package.json` has these scripts that fan out to all workspaces: `dev`, `build`, `lint`, `typecheck`, `test`, `format`. Use `pnpm -r` (recursive) — do **not** add Turborepo or Nx.
- [ ] `.gitignore` covers `node_modules`, `.next`, `cdk.out`, `.env*` (except `.env.example`), `coverage`.
- [ ] `.env.example` exists at the root, empty for now with a comment explaining real vars are added per ticket.
- [ ] `README.md` at the root: one paragraph + the four commands a developer runs to bring it up locally (`pnpm install`, `pnpm dev`, `pnpm lint`, `pnpm typecheck`). Do **not** duplicate `PROJECT_BRIEF.md`.
- [ ] GitHub Actions workflow at `.github/workflows/ci.yml` runs on PRs to `main`: install pnpm, install deps, `pnpm lint`, `pnpm typecheck`, `pnpm -r build`, `pnpm test`. Node 20. Uses pnpm caching.
- [ ] `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm -r build` all pass locally with **zero** warnings.
- [ ] First commit on a branch `task/TASK-001-monorepo-scaffold`. Conventional commit message.

## Files you will likely create / touch

```
package.json
pnpm-workspace.yaml
tsconfig.base.json
.eslintrc.cjs           (or eslint.config.js)
.prettierrc
.gitignore
.env.example
README.md
apps/web/...            (full Next.js scaffold)
packages/db/package.json + src/index.ts + tsconfig.json
packages/rag/...        (same shape)
packages/safety/...     (same shape)
packages/eval/...       (same shape)
infra/...               (cdk init output, pruned to empty App)
.github/workflows/ci.yml
```

## Out of scope — do not do these here

- Any database schema. (TASK-004.)
- Any AWS resources in CDK beyond the empty App. (TASK-003.)
- Any auth wiring. (TASK-006.)
- Any UI beyond what `create-next-app` ships, minus the marketing boilerplate.
- Any tests beyond a single placeholder `vitest` test in `apps/web` so `pnpm test` exits 0 with at least one passing test.
- Tailwind theming or fonts. (TASK-005.)

## How the PM will verify

1. `pnpm install` — clean install, no peer-dep warnings.
2. `pnpm lint` — exit 0.
3. `pnpm typecheck` — exit 0.
4. `pnpm -r build` — exit 0, all workspaces build.
5. `pnpm test` — exit 0.
6. `pnpm dev` in `apps/web` — Next.js boots, http://localhost:3000 returns 200.
7. Push the branch, open PR — CI workflow runs and goes green.

## Decisions you should make and report

- Flat ESLint config vs `.eslintrc.cjs` — pick one, mention it in the report.
- Vitest vs Jest — **prefer Vitest**, but if Next.js 15 + RSC + Vitest is rough today, fall back to Node's built-in test runner and flag it.

## Report-back template

Use the format in `PROJECT_BRIEF.md §7`. Especially important here: the exact Node and pnpm versions you used, so the PM can match them.
