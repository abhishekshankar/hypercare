# ADR 0003 — Design tokens and persistent crisis strip (TASK-005)

## Status

Accepted (Sprint 1).

## Context

PRD §6.1 requires a persistent crisis strip on every screen. TASK-005 establishes the first real UI surface: route stubs, shared layout, and Tailwind v4 tokens. TASK-006 will add auth; the strip must already be global so signed-in routes never ship without it.

## Decisions

### 1. Crisis strip placement: `sticky` (not `fixed`)

We use `position: sticky; top: 0` for the strip. It stays visible at the top while scrolling without consuming a permanent overlay slot. That reduces overlap with mobile on-screen keyboards and keeps focusable controls in the main document flow. A fixed bar would always reserve viewport height and can feel intrusive on small screens.

### 2. Font stacks: system only for v1

Headings use Georgia (serif stack); body uses the system sans stack. No `next/font` or custom font files in TASK-005 — revisit when design locks a brand face.

### 3. Color palette (warm neutrals)

| Token              | Hex       | Role                                        |
| ------------------ | --------- | ------------------------------------------- |
| `background`       | `#faf8f5` | Page ground                                 |
| `foreground`       | `#1c1917` | Primary text                                |
| `muted`            | `#f5f0e8` | Subtle panels                               |
| `muted-foreground` | `#57534e` | Secondary text                              |
| `accent`           | `#b45309` | Links, focus ring, primary CTA              |
| `border`           | `#e7e5e4` | Dividers, dashed cards                      |
| `crisis-bg`        | `#f3eee6` | Crisis strip bar                            |
| `crisis-fg`        | `#44403c` | Crisis strip text (serious, not alarm red) |

### 4. No dark mode in v1

We do not ship `prefers-color-scheme` theming. One light theme reduces visual QA surface and matches the PRD’s “warm but serious” register for caregivers reading at odd hours.

### 5. Strip copy vs PRD wording

The implementation uses the TASK-005 acceptance line (“In crisis right now? …”) with a `tel:` link on **800-272-3900**. PRD §6.1 uses slightly different wording; both are equivalent for safety. PM may converge copy in a later polish pass.

### 6. ADR numbering

TASK-004 consumed **0002** for Drizzle schema. This ADR is **0003** to avoid collision with `0002-drizzle-schema-v0.md`. **TASK-006** should use **0004** for the auth session model ADR.

## Consequences

- Every route under the root layout renders `<CrisisStrip />` without per-page imports.
- TASK-006 should add session and middleware without introducing a layout branch that omits the root layout (e.g. do not mount a parallel root for `/app` only).
