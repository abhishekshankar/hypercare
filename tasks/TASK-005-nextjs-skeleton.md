# TASK-005 — Next.js app skeleton, Tailwind, 8-screen route stubs, persistent crisis strip

**Owner:** Cursor
**Depends on:** TASK-001
**Status:** done

## Why this exists

TASK-001 scaffolded `apps/web` with bare `create-next-app` output. Every later UI ticket — onboarding (TASK-007), conversation (TASK-011), and the auth redirect target (TASK-006) — assumes the app's eight routes exist as empty screens, a root layout with the crisis strip is wired globally, and a small set of shared primitives (typography, spacing, a button, a link list) is in place. Doing this once now prevents three later tickets from each re-inventing their own layout, redeclaring Tailwind fonts, or half-implementing the crisis strip.

**This is a skeleton ticket, not a product ticket.** Every screen is a placeholder. Real content, forms, and logic ship in their respective tickets. The one thing that must be real and correct today is the persistent crisis strip, because PRD §6.1 makes it a safety-critical element present on every screen.

## Context to read before starting

- `prd.md §6.1`–`§6.8` — the eight screens, what each one is, and the explicit absence list for Screen 3 (no feed, no streak, no gamification). Understand the emotional register; it should show up in the empty-state copy even at stub stage.
- `prd.md §4.2` — "Crisis-first, not curriculum-first." The crisis strip is the textual expression of that principle.
- `prd.md §6.8` — Help & safety contents (Alzheimer's Association 24/7 helpline, 988, APS). The persistent strip uses the Alzheimer's Association line; the full list lives on Screen 8.
- `PROJECT_BRIEF.md §2` (stack — Next.js 15 App Router, Tailwind, no UI kit beyond a few shadcn/ui primitives), `§5` (Conventions — `strict: true`, no `any`, Conventional Commits).
- `apps/web/` — what TASK-001 left behind. Tailwind v4 is already on; there's only `layout.tsx`, `page.tsx`, `globals.css`.

## What "done" looks like

A running `pnpm --filter web dev` shows the landing page at `/` with the crisis strip visible. Every URL listed in the "Routes" section below renders a placeholder screen whose title matches PRD §6, also with the crisis strip visible. The shared layout composes typography, max-width container, nav, and crisis strip. Tailwind's design tokens (font family, spacing scale, color palette) are declared in one place. A handful of shared primitives (`<CrisisStrip />`, `<Container />`, `<ScreenHeader />`, `<PlaceholderCard />`) live under `apps/web/src/components/`.

No business logic. No auth (that's TASK-006). No DB reads (that's TASK-007 onward).

## Acceptance criteria

### Routes

App Router layout under `apps/web/src/app/`. Each route below renders a stub page with the PRD screen name as the `<h1>` and a one-sentence description in muted text. Each page calls the shared `<ScreenHeader title=... />` and shows a `<PlaceholderCard ticket="TASK-NNN" />` naming the ticket that will build it out.

- [x] `/` — Screen 1, Landing / first-run. The one page that is NOT a stub: renders the PRD §6.1 headline, sub-headline, and the "Get started" CTA (link only, target `/onboarding` — no auth yet). Crisis strip at the top or pinned to viewport per the design note below.
- [x] `/onboarding` — Screen 2. Stub. Ticket ref: TASK-007.
- [x] `/app` — Screen 3, Home. Stub. Ticket ref: TASK-011. (Also the post-login landing target for TASK-006; this route must exist before TASK-006 lands.)
- [x] `/app/conversation/[id]` — Screen 4, Conversation. Stub. Ticket ref: TASK-011. The dynamic segment resolves with a placeholder message like "Conversation {id} (stub)".
- [x] `/app/lesson/[slug]` — Screen 5, Daily lesson. Stub. Ticket ref: sprint 2 (listed as deferred in `TASKS.md`) — include the stub anyway so the URL shape is stable.
- [x] `/app/library` — Screen 6, The library. Stub. Sprint 2.
- [x] `/app/profile` — Screen 7, Care profile. Stub. Sprint 2 for editing; sprint 1 ticket TASK-007 may read-only-render here when it lands.
- [x] `/help` — Screen 8, Help & safety. Stub, but **render the full PRD §6.8 resource list as static content** (Alzheimer's Association 24/7 helpline, 988, APS, "When to call the doctor / 911" checklists as simple unordered lists, caregiver burnout self-assessment link placeholder, support contact mailto). This page is safety-critical even as a stub; a caregiver who lands here in a bad moment needs the numbers to work.

Each stub page is ≤30 lines of TSX. No fetchers, no state.

### Persistent crisis strip

- [x] `apps/web/src/components/crisis-strip.tsx` — a server component that renders a single line: "In crisis right now? Call the Alzheimer's Association 24/7 helpline: **800-272-3900**." The phone number is a `<a href="tel:8002723900">` so mobile users can tap to call.
- [x] The strip is mounted **once** in the root `layout.tsx`, positioned at the top of the viewport (sticky or fixed — pick one and justify in the PR). It must render on **every** route, including `/auth/error` and the `/help` page. The one exception: an `<Outlet />` style slot is not needed; just always-on.
- [x] The strip is keyboard-focusable (`<a>` element, not a button) and has a visible focus ring per Tailwind's default.
- [x] Color is distinguishable from ambient content but not alarming. A muted warm-background bar, not red. PRD §6.1 calls for "warm but serious" — match that. Include the chosen Tailwind utility classes in the PR description and a screenshot.
- [x] Mobile: the strip must not overlap input focus or keyboard; test at 375×667 and document in the PR.
- [x] Accessibility: `role="region"` and `aria-label="Crisis resources"`. The phone link has `aria-label="Call the Alzheimer's Association 24/7 helpline"`.

### Shared primitives

Under `apps/web/src/components/`:

- [x] `container.tsx` — a max-width wrapper (`max-w-2xl mx-auto px-4`) used by every screen's main content.
- [x] `screen-header.tsx` — renders an `<h1>` and an optional sub-headline in the PRD's typographic register ("closer to NYT than to Duolingo" — serif display face for H1, system sans for body). Font family is declared centrally (see "Design tokens" below).
- [x] `placeholder-card.tsx` — a dashed-border card that reads "This screen ships in {props.ticket}." Used on every stub page so the PM can click through and see the URL shape without mistaking a stub for a bug.
- [x] `nav.tsx` — minimal top navigation: logo text "Hypercare" (links `/`), plus a "Help" link to `/help`. No Home / Library / Profile links yet — those need auth and appear in TASK-011.

No other components. This ticket deliberately does not build: form fields, a button component with variants, modals, toasts, skeletons, or anything else TASK-007 / TASK-011 will need. Those tickets add what they need when they need it.

### Design tokens

- [x] `apps/web/src/app/globals.css` extended to declare two font families via `@theme` (Tailwind v4 syntax):
  - A serif display face for headings — Tailwind's bundled `Georgia, serif` stack is fine for v1; do not ship a custom font file in this ticket.
  - The default sans for body — system stack.
- [x] Declare a minimal semantic color palette in `@theme` for: `background`, `foreground`, `muted`, `muted-foreground`, `accent`, `border`, `crisis-bg`, `crisis-fg`. Values are warm neutrals — off-white background, near-black foreground, warm sand accent. Exact hex in the PR description.
- [x] No dark mode in v1. Document this in the ADR.
- [x] Spacing, radius, and shadow use Tailwind defaults. Do not re-declare.

### Layout

- [x] `apps/web/src/app/layout.tsx` — root layout renders, in order: `<CrisisStrip />`, `<Nav />`, `<main>{children}</main>`. `<main>` uses `<Container />`.
- [x] Metadata: `title` template `"%s · Hypercare"`, default `"Hypercare"`, `description` from PRD §1.1.
- [x] Viewport meta present (Next 15's default is fine).
- [x] No client-side `<body>` effects, no `"use client"` at the layout level. All layout components are server components.

### Route groups

- [x] Use a Next.js route group for the signed-in area so TASK-006 can add a per-group layout later without moving files: `apps/web/src/app/(authed)/app/page.tsx`, `(authed)/app/conversation/[id]/page.tsx`, etc. The `(authed)` segment is invisible in the URL. Do **not** add any auth check in this ticket; the grouping is scaffolding.

### Tests

- [x] A Vitest + React Testing Library render test for each of: `<CrisisStrip />`, `<ScreenHeader />`, `<Nav />`. Assertions: strip renders the 800-272-3900 link; header renders the title; nav contains "Help".
- [x] A single smoke test that walks the app's eight URLs with Next's built-in loader (or Playwright, if you already pulled it in) and asserts each returns 200 and contains "800-272-3900". Proves the strip is on every page.
- [x] `pnpm lint && pnpm typecheck && pnpm -r build && pnpm test` green with zero warnings.

### Documentation

- [x] `docs/adr/0003-design-tokens-and-crisis-strip.md` — records: font stack choice, color palette, crisis-strip placement decision (sticky vs fixed), no-dark-mode-in-v1. Cross-link from `prd.md §6.1`.
- [x] A single screenshot of `/` and one of `/app/conversation/placeholder-id` in the PR description showing the crisis strip on both.

## Files you will likely create / touch

```
apps/web/
  src/
    app/
      layout.tsx                         (rewrite; mount nav + crisis strip)
      page.tsx                           (Screen 1 content)
      globals.css                        (font + palette tokens)
      help/page.tsx                      (Screen 8, with full resource list)
      onboarding/page.tsx                (stub, Screen 2)
      (authed)/
        app/
          page.tsx                       (stub, Screen 3)
          conversation/[id]/page.tsx     (stub, Screen 4)
          lesson/[slug]/page.tsx         (stub, Screen 5)
          library/page.tsx               (stub, Screen 6)
          profile/page.tsx               (stub, Screen 7)
    components/
      crisis-strip.tsx
      container.tsx
      screen-header.tsx
      placeholder-card.tsx
      nav.tsx
    test/
      crisis-strip.test.tsx
      screen-header.test.tsx
      nav.test.tsx
      screens.smoke.test.ts
docs/
  adr/0003-design-tokens-and-crisis-strip.md
```

Note: TASK-004's ADR is `0002-drizzle-schema-v0.md`. Design tokens + crisis strip landed as **0003** to avoid collision.

## Out of scope — do not do these here

- Any auth check, middleware, or redirect on the `(authed)` group. TASK-006.
- Any form fields, form validation, or multi-step wizard UI for `/onboarding`. TASK-007.
- Any conversation rendering, input component, or markdown renderer for `/app/conversation/[id]`. TASK-011.
- shadcn/ui install. Pull its CLI in later tickets only when a specific component is needed (button, input). Do not pre-install a kitchen sink.
- Custom fonts via `next/font`. Georgia system-stack is fine for v1; revisit when design has picked a brand face.
- Analytics, cookie banner, consent modal.
- Any change to `packages/` or to `infra/`.
- Dark mode, theme switcher.
- A real logo. The word "Hypercare" in the serif display face is the logo.

## How the PM will verify

1. `pnpm install && pnpm --filter web dev`. Visit each of the eight URLs in a browser:
   - `/`, `/onboarding`, `/app`, `/app/conversation/abc`, `/app/lesson/test`, `/app/library`, `/app/profile`, `/help`.
   - Each renders. Each shows the crisis strip with `800-272-3900` as a tappable phone link. Each stub shows the placeholder card naming the ticket that finishes it.
2. On `/help`, click every resource link or phone number — each is reachable (tel:, mailto:, or external link as appropriate). Read the "When to call 911" list — it's present.
3. Resize to mobile (375×667). The crisis strip doesn't overlap the main content area, is readable, and the tel: link is tappable.
4. Tab through `/` with the keyboard. The crisis strip phone link is focusable and has a visible focus ring.
5. `pnpm lint && pnpm typecheck && pnpm -r build && pnpm test` — all green.
6. Read ADR 0003 — each decision in the ticket has a paragraph.

## Decisions Cursor will make and report

- **Sticky vs fixed crisis strip.** Sticky (scrolls at the top of the doc flow) is gentler on mobile keyboards; fixed is more present. Pick one, justify in the ADR.
- **Font stack** — stay with system serif/sans or pull one Google font via `next/font`. Prefer system stack; if you pull a font, justify.
- **Color palette hex values** — you have latitude here. Warm neutrals, not red/orange alarm colors. Submit in the PR description and be ready for a revision round.

## Report-back template

Use `PROJECT_BRIEF.md §7`. In the report, include:

- The eight URLs with their response codes.
- The screenshot at desktop and mobile.
- The palette hex values and the font stack chosen.
- The crisis strip Tailwind class list used.
- Any PRD §6 detail you found ambiguous and resolved (name it so PM can confirm).
