# TASK-023 — Library screen (Screen 6) + module-topic tagging for the seeded modules

- **Owner:** Cursor
- **Depends on:** TASK-008 (modules + chunks exist), TASK-019 (`module_topics` table exists)
- **Unblocks:** TASK-024 (lesson surface links into the library; the picker reads `module_topics`)
- **Status:** in_review
- **ADR:** None (extend `docs/adr/0006-content-pipeline-v0.md` with one paragraph on tagging).

---

## Why this exists

PRD §6.6 describes the library as the "quiet moments" surface — caregivers browsing or searching when nothing's on fire. It's the only surface in v1 that lets the user *initiate* learning rather than reacting to a crisis or a system pick.

Two reasons we ship this in sprint 2 and not sprint 3:

1. The lesson surface (TASK-024) needs a "browse the rest" link from inside a lesson and from the refusal cards. Without a real library page that link is a stub.
2. The picker (TASK-024) reads `module_topics` to rank candidates. This ticket is the natural home for **tagging the 3 seeded modules** with their topic slugs — without it, the picker has nothing to read and we punt the work into TASK-024.

The actual screen is small. The PRD calls it "searchable, browsable, organized by situation [§7.1 category], with stage as a filter." For v0 with 3 modules, "searchable" is plain text contains; "browsable" is a category accordion; "filter" is a chip row. Nothing fancy.

---

## Context to read first

1. `prd.md` §6.6 (the screen), §7.1 (the seven categories — these are the section headings), §7.2 (module shape — what each card shows).
2. `apps/web/src/app/(authed)/app/modules/[slug]/page.tsx` — currently a "coming soon" stub from TASK-011. This task replaces it with a real module page.
3. `packages/db/src/schema/modules.ts` and `packages/content/` — module shape.
4. After TASK-019: `packages/db/src/schema/module-topics.ts` and `topics.ts`.
5. `content/modules/*.md` — the three seeded files. **You'll add `topics:` front-matter to them.**

---

## What "done" looks like

### Library list (`/app/library`)

- Header: "Library."
- A search input (top of page). Submitting filters the visible modules to those whose `title`, `summary`, or any tagged topic `display_name` matches the query (case-insensitive substring; no trigram, no fancy ranking).
- A stage filter chip row: `Any` (default) / `Early` / `Middle` / `Late`. Multi-select OK; a module shows when the user's selection ∩ `module.stage_relevance` is non-empty (or "Any" is selected).
- Below the controls: seven category sections in §7.1 order. Each section header shows the category display name and the count of matching modules. Empty sections are collapsed by default with a "no modules in this category yet" line — important for v0 where 4–5 categories will be empty.
- Each card: title, 1-line summary, stage chips (small), tap → `/app/modules/[slug]`.
- "Coming soon" empty states for categories with zero modules — friendlier than hiding sections, and honest about the v0 corpus.

### Module page (`/app/modules/[slug]`)

This was a stub. Replace with a real page:

- Title.
- Stage chips + category chip.
- The full Markdown body, rendered with the same simple typography stack as the conversation answers.
- Attribution line (per PRD §7.2 — verbatim from the module's `attribution_line` field).
- "Reviewed by [name, credential] on [date]" if `expert_reviewer` and `review_date` are present; omit cleanly if null (sprint-1 modules have nulls).
- A small "Try this today" call-out at the bottom — pull from a new `try_this_today` front-matter field if present; if absent, omit. (See "Tagging the 3 seeded modules" below.)
- Two CTAs at the bottom:
  - **"Take this as a 5-minute lesson"** → `/app/lesson/[slug]` (TASK-024 builds the lesson surface; in this PR the link is wired but the destination is a stub if TASK-024 hasn't merged yet — that's fine, ID-order rules say TASK-024 starts after TASK-023 is done so the link works the moment TASK-024 lands).
  - **"Back to library"** → `/app/library`.
- Source attribution from PRD §7.2.

### Tagging the 3 seeded modules

- Extend the front-matter parser in `packages/content/` to accept `topics: ["slug-a", "slug-b"]` (validated against the seeded `topics.slug` set; reject the file with a clear error if a slug is unknown).
- Add `topics:` front-matter to each of the three seeded modules in `content/modules/` with 2–4 topic slugs each from the TASK-019 seeded set. Pick the obvious ones (e.g., `behavior-sundowning` → `["sundowning", "agitation-aggression"]`).
- Optionally add `try_this_today: "..."` front-matter to each (one short concrete sentence per module). Used by the module page and by the lesson surface in TASK-024.
- Re-run `pnpm --filter @hypercare/content load` — the loader now upserts `module_topics` rows alongside the module / chunk upserts. **Idempotent**: re-running it does not duplicate rows.

### API surface

Library list reads from `modules` (and optionally `module_topics`) — it can be a server component reading directly via Drizzle. No new public API surface needed unless you find you want a JSON endpoint for client-side search; for v0 with 3 modules, server-rendered with a small client-side filter is enough.

### Tests

- Unit (`packages/content/test/topics-frontmatter.test.ts`):
  - Parser accepts a known-good `topics:` array.
  - Parser rejects an unknown slug with a clear error message.
  - Loader upserts `module_topics` rows; second run is a no-op (no duplicates, no deletions).
- Unit (`apps/web/test/library/filter.test.ts`):
  - Search "bathing" matches the bathing-resistance module by title, summary, or topic display name.
  - Stage filter "middle" only includes modules whose `stage_relevance` includes "middle."
- Playwright E2E (`apps/web/test/e2e/library.spec.ts`):
  1. Log in, open `/app/library`, see all three seeded modules in their category sections.
  2. Type "bath" — only the bathing module visible.
  3. Click stage chip "early" — modules without `early` in stage_relevance disappear.
  4. Click a module card — land on `/app/modules/[slug]` with title, body, attribution, and the "Take as a lesson" CTA wired to `/app/lesson/[slug]`.

---

## Acceptance criteria

- `pnpm typecheck lint test` green; `pnpm --filter web build` green.
- `/app/library` renders with the seven §7.1 sections, with the seeded modules in their right sections.
- Search and stage filter work with the three seeded modules.
- `/app/modules/[slug]` renders the real module instead of "coming soon."
- The 3 seeded modules now carry `topics:` front-matter; `module_topics` table is populated; re-running the loader is a no-op.
- The "Take this as a 5-minute lesson" link is present on the module page (target route is created by TASK-024; in this PR it's a wired link that 404s gracefully if TASK-024 isn't merged yet — note this in the PR).
- ADR 0006 addendum on tagging.

---

## Files to create / modify

### Create

```
apps/web/src/app/(authed)/app/library/page.tsx
apps/web/src/components/library/CategorySection.tsx
apps/web/src/components/library/ModuleCard.tsx
apps/web/src/components/library/StageFilter.tsx
apps/web/src/components/library/SearchInput.tsx
apps/web/src/lib/library/filter.ts                # pure search + filter helper
apps/web/src/app/(authed)/app/modules/[slug]/page.tsx     # replace stub
apps/web/src/components/modules/ModuleArticle.tsx
packages/content/test/topics-frontmatter.test.ts
apps/web/test/library/filter.test.ts
apps/web/test/e2e/library.spec.ts
```

### Modify

```
packages/content/src/parser.ts                    # accept topics + try_this_today front-matter
packages/content/src/loader.ts                    # upsert module_topics
content/modules/*.md                              # add topics: + try_this_today: front-matter
docs/adr/0006-content-pipeline-v0.md              # short addendum on topic tagging
TASKS.md
```

### Do **not** touch

- The chunker or the embedder — topic tagging is metadata, not embeddings.
- The conversation surfaces.
- Help & safety surfaces.

---

## Out of scope

- A real search index (Postgres FTS, Meilisearch, etc.) — the v0 corpus is 3 modules; substring is fine.
- Module bookmarking / "saved for later" UI.
- Print / share-link buttons.
- An admin page for tagging modules — tags live in front-matter; the loader is the authoring tool.
- The lesson surface itself (TASK-024).
- "What's new" / "recently published" sorts (not enough corpus to matter).

---

## Decisions to make in the PR

- **Search input behavior.** Submit-on-enter vs. live-as-you-type. My vote: live-as-you-type with a 200ms debounce; cheaper than a server round-trip when everything's client-side anyway.
- **Whether empty category sections appear or hide.** My vote: appear with a friendly "no modules yet" line. Honesty about the v0 corpus beats hiding it.
- **Mobile layout.** One card per row on phone, two on tablet, three on desktop. Standard.

---

## Questions for PM before starting

1. The 3 seeded modules' topic tags — will you write them, or do you want me to draft and you sign off in review? My vote: I draft, you sign off.
2. Should the module page support any kind of "this helped" thumbs (mirroring the conversation answer surface)? My vote: **no for v0** — feedback lives on the conversation surface, modules are read-only here.
3. The empty-category copy — fine as drafted ("no modules in this category yet"), or want a soft CTA ("expert content coming. Tell us what you'd like to see → /help")? My vote: keep it minimal in v0; add the CTA in sprint 3 when we have a feedback inbox.

---

## How PM verifies

1. Local dev, log in, click "Library" in nav. Land on `/app/library`.
2. See the three seeded modules in their right sections; four sections show empty-state copy.
3. Type "bath" in search — only the bathing module visible.
4. Click "Early" stage chip — modules without "early" disappear.
5. Click a module — full body renders with attribution and the lesson CTA.
6. Re-run `pnpm --filter @hypercare/content load`; check `module_topics` table — no duplicates, no churn.
7. Read ADR 0006 addendum.

---

## Report-back

- Branch + PR + acceptance checklist mirror.
- Screenshots: `/app/library` empty-search, `/app/library` "bath" search, `/app/modules/<slug>`.
- The drafted topic tags for each of the 3 seeded modules — explicitly, in the PR description, so I can sign off without checking out.
- Decisions you landed on.
- The state of the "Take this as a lesson" link (working route by TASK-024 — confirm it's wired even if the route doesn't exist yet).
