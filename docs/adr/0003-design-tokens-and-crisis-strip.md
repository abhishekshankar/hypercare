# ADR 0003 — Design tokens and persistent crisis strip (TASK-005)

## Status

Accepted (Sprint 1). **Palette and type stack superseded by Alongside Design System v1.0** (see below); layout rules (global strip, sticky, no dark mode in v1) unchanged.

## Canonical design system (Alongside v1.0)

Product UI follows **Alongside — Design System v1.0**:

- **Spec / reference:** [`docs/Alongside/Alongside Design System.html`](../Alongside/Alongside%20Design%20System.html) (full tokens, components, dark theme reference — we ship **light only** in v1 per below).
- **Extracted CSS tokens (homepage / handoff):** [`docs/Alongside/homepage-tokens.css`](../Alongside/homepage-tokens.css).

### Implementation in `apps/web`

- **Tailwind v4 `@theme`:** [`apps/web/src/app/globals.css`](../../apps/web/src/app/globals.css) maps Alongside primitives to semantic colors (`background` = paper, `foreground` = ink, `accent` = moss, `border` = rule, crisis bar = amber, etc.).
- **Fonts:** [`apps/web/src/app/layout.tsx`](../../apps/web/src/app/layout.tsx) loads **Inter** and **Source Serif 4** via `next/font/google` (`--font-ui-sans`, `--font-ui-serif`), matching the design system.

Earlier TASK-005 copy referred to Georgia + system sans and a smaller warm-neutral table; that was the first ship. **Alongside v1.0 is now the source of truth** for hex, primary (moss), and crisis (amber bar).

## Context

PRD §6.1 requires a persistent crisis strip on every screen. TASK-005 establishes the first real UI surface: route stubs, shared layout, and Tailwind tokens. The strip must be global so signed-in routes never ship without it.

## Decisions

### 1. Crisis strip placement: `sticky` (not `fixed`)

We use `position: sticky; top: 0` for the strip. It stays visible at the top while scrolling without consuming a permanent overlay slot. That reduces overlap with mobile on-screen keyboards and keeps focusable controls in the main document flow.

### 2. Font stacks (Alongside v1.0)

**Sans:** Inter (UI, body). **Serif:** Source Serif 4 (headings / wordmark where used). Loaded via `next/font` in the root layout; no extra layout branch that omits fonts.

### 3. Color palette (Alongside warm paper + moss primary)

Semantic mapping in `globals.css` (see `@theme inline` for exact hex). At a glance:

| Semantic (Tailwind) | Alongside role (approx.) |
| --------------------- | ------------------------- |
| `background`          | `--paper`                 |
| `foreground`          | `--ink`                   |
| `muted`               | `--paper-2`               |
| `muted-foreground`    | `--ink-3`                 |
| `accent`              | `--moss` (links, primary CTA) |
| `border`              | `--rule`                  |
| `crisis-bg` / `crisis-fg` | `--amber` bar, light-on-amber text (matches design system crisis strip) |

### 4. No dark mode in v1

We do not ship `prefers-color-scheme` theming in the Next app. Alongside’s HTML spec includes a `[data-theme="dark"]` block for future use; **v1 remains light only** to reduce QA surface.

### 5. Strip copy vs PRD wording

The implementation uses the TASK-005 acceptance line (“In crisis right now? …”) with a `tel:` link on **800-272-3900**. PRD §6.1 uses slightly different wording; both are equivalent for safety. PM may converge copy in a later polish pass.

### 6. ADR numbering

TASK-004 consumed **0002** for Drizzle schema. This ADR is **0003** to avoid collision with `0002-drizzle-schema-v0.md`. **TASK-006** uses **0004** for the auth session model ADR.

## Consequences

- Every route under the root layout renders `<CrisisStrip />` without per-page imports.
- Auth and middleware must not introduce a layout branch that omits the root layout (e.g. do not mount a parallel root for `/app` only).
- When tokens change, update **Alongside HTML / `homepage-tokens.css` first**, then sync `apps/web/src/app/globals.css` so product and docs stay aligned.
