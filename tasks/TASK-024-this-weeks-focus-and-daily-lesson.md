# TASK-024 — "This week's focus" picker + Daily Lesson surface (Screen 5) + weekly check-in

- **Owner:** Cursor
- **Depends on:** TASK-011 (home screen), TASK-019 (`lesson_progress`, `weekly_checkins`, `module_topics`), TASK-020 (editable care profile + change-log), TASK-022 (`getRecentTopicSignal`), TASK-023 (library + module page + tagged modules)
- **Unblocks:** Sprint 2 demo, sprint 3 picker improvements
- **Status:** done
- **ADR:** `docs/adr/0014-weeks-focus-picker-and-lesson-surface.md` (new — picker policy, anti-repeat policy, check-in cadence)

---

## Why this exists

This is the headline ticket of sprint 2 — the one where the retention loop becomes real. Five surfaces tie together:

1. The home screen's "This week's focus" card (PRD §6.3) becomes a real personalized pick instead of a placeholder.
2. The Daily Lesson screen (PRD §6.5) ships for the first time — five-minute structured lesson with the four-card flow.
3. Lesson progress writes to `lesson_progress` (TASK-019).
4. The weekly check-in card on the home screen (PRD §6.3, §3.3) ships and writes to `weekly_checkins` (TASK-019).
5. The picker reads from the data plane that TASKs 020 and 022 set up — care profile, change-log, recent-topics signal — plus the soft-flag count from TASK-021 to decide when to surface the check-in.

This is also where the sprint 2 north-star demo (the 8-step verification list in `TASKS.md` § Sprint 2 success criteria) is exercised.

---

## Context to read first

1. `prd.md` §3.3 (north-star metric — the check-in is literally this), §6.3 (home), §6.5 (lesson structure — the four-card flow is non-negotiable), §10.4 (soft-flag elevation — informs the check-in cadence).
2. `apps/web/src/app/(authed)/app/page.tsx` — TASK-011's home screen. You're replacing the placeholder card with the real "This week's focus" surface.
3. After TASK-019: `packages/db/src/schema/lesson-progress.ts`, `weekly-checkins.ts`, `module-topics.ts`.
4. After TASK-020: `apps/web/src/lib/profile/persist.ts` — for the change-log read.
5. After TASK-022: `packages/rag/src/topics/signal.ts` — the picker calls `getRecentTopicSignal`.
6. After TASK-023: the module page exists and the seeded modules are tagged.
7. `docs/adr/0010-conversation-ui-v0.md` — for the home screen layout patterns you'll mirror.

---

## What "done" looks like

### The picker (`packages/picker` — new package, or `packages/rag/src/picker/` if you'd rather keep packages flat)

- Pure function `pickThisWeeksFocus(input): Promise<PickerResult>`.
- Input: `{ userId }`. Picker pulls everything else internally via DB reads.
- Output:
  ```ts
  type PickerResult = {
    moduleId: string;
    slug: string;
    title: string;
    rationale: PickerRationale;       // why this module — for the home-screen card subtitle
  } | { kind: "no_pick"; reason: "no_eligible_modules" };

  type PickerRationale =
    | { kind: "stage_baseline"; stage: Stage }
    | { kind: "recent_topic"; topicSlug: string }
    | { kind: "profile_change"; field: string }
    | { kind: "manual_featured"; }    // out of scope but reserve the slot in the type
  ```
- Picker policy (run in this order; first match wins):
  1. **Profile change** (last 7 days). If the change-log has a recent edit to "hardest thing right now" or to a stage answer that flipped the inferred stage, prefer a module whose topics map to the new value. (Example: user set hardest-thing-now to `guilt` → prefer a module tagged `guilt-and-grief`.)
  2. **Recent topic signal** (last 14 days). Take `getRecentTopicSignal(userId).topTopics`; pick the highest-weighted topic the user **has not** already completed a lesson for in the last 14 days; pick a module tagged with that topic (joined via `module_topics`).
  3. **Stage baseline.** Pick a module whose `stage_relevance` includes the user's inferred stage and that the user has not completed in the last 14 days; round-robin within the candidate set ordered by `created_at`.
  4. **No eligible modules** — return `no_pick`. (For sprint 2 with 3 modules this can happen; the home screen handles it gracefully.)
- All four steps respect the **anti-repeat rule**: a module completed in the last 14 days is not re-picked unless step 3 has nothing else to offer.
- Soft-flag awareness: this is for the **check-in cadence**, not the picker output. See "Weekly check-in" below.
- Pure deps: pass DB client + `now()` + `getRecentTopicSignal` for unit tests.

### The home screen surfaces

Update `/app/` to render, above the existing ask-anything input:

- **"This week's focus" card.** Title from the picker, plus a one-line subtitle generated from the rationale ("Because you've been asking about sundowning" / "Because middle stage often brings this" / "Because you said guilt is the hardest thing right now"). Tap → `/app/lesson/[slug]`. Render gracefully on `no_pick` ("Nothing new this week — try the library →").
- **Weekly check-in card.** Surface logic in `apps/web/src/lib/home/checkin-cadence.ts`:
  - Show the card when there is no `weekly_checkins` row for this user with `prompted_at` in the last 7 days.
  - **OR** show it sooner (after 3 days instead of 7) if there are 2+ soft `safety_flags` for the user in the last 7 days (PRD §10.4 elevation rule).
  - Card text: "How are you doing this week? Did you try something that helped?" + Yes / No / Skip. Yes/No → optional 1-line free-text "What helped?" → Save. On save, write to `weekly_checkins`.
  - Skip writes a row with `tried_something = null`, `answered_at = now()` (so the card doesn't keep appearing).
- The starter chips, recent conversations, and ask-anything input from TASK-011 stay where they are. Order on the page: greeting → "This week's focus" → weekly check-in (when surfaced) → ask-anything → starter chips → recent conversations.

### The Daily Lesson surface (`/app/lesson/[slug]`)

Per PRD §6.5, this is **always 5 minutes** and has a fixed structure:

- **Card 1 — Setup (60s).** Title, "Why this matters for [name]" line (use the CR's first name from `care_profile`; gracefully omit if not set). Stage callout if relevant.
- **Cards 2–4 — Core content (2–3 min).** 3 swipeable cards. Content sourced from the module body — split on `##` headings. Use the first 3; if the module has fewer than 3 sections, pad with a "key takeaway" card from the module's summary.
- **Card 5 — Try this today (30s).** Pulls from the module's `try_this_today` front-matter (TASK-023 added this). If absent, fall back to a "Try one thing from this lesson today" generic card.
- **Card 6 — Close.** Two buttons: **"Got it"** and **"I want to revisit this."** Both write `lesson_progress.completed_at = now()`. "Revisit" sets `revisit = true`. Both then redirect to `/app` with a small inline banner ("Saved. We won't show this lesson again for two weeks unless you revisit it.").
- A "back to module" link in the header → `/app/modules/[slug]` (the full module page from TASK-023).
- A `lesson_progress` row is created with `started_at = now()` and `source = 'weekly_focus' | 'library_browse' | 'search' | 'conversation_link'` based on the entry route. Detect via a query param `?source=...` set by the linking surface; default `library_browse` if absent.
- **No video, no audio.** Plain text + simple typography. Each card fills a phone screen comfortably.
- Keyboard: arrow keys / swipe between cards; Enter on the close card to "Got it."

### API surface

```
POST  /api/app/lesson/[slug]/start          body: { source }                  → { progressId }
POST  /api/app/lesson/[slug]/complete       body: { progressId, revisit }     → { ok: true }
POST  /api/app/checkin                       body: { tried_something | null, what_helped? }  → { ok: true }
POST  /api/app/checkin/skip                  → writes a row with tried=null
GET   /api/app/this-weeks-focus              → PickerResult
GET   /api/app/checkin/should-show           → { show: boolean, reason: 'cadence' | 'soft_flag_elevation' | null }
```

All require session, all `zod`-validated, all 401 on missing session.

### Tests

- Unit (`packages/picker/test/pick.test.ts` — or wherever the picker lands):
  - Empty signal + no profile change → step 3 stage baseline.
  - Recent topic = `bathing-resistance` and a module tagged for it that the user hasn't completed → step 2 picks it.
  - That same module completed 3 days ago → step 2 skips it; step 3 may pick it only if no other candidate exists.
  - Profile change "hardest thing now" = `guilt` 2 days ago + a module tagged `guilt-and-grief` → step 1 picks it.
  - No tagged modules at all → `no_pick`.
- Unit (`apps/web/test/home/checkin-cadence.test.ts`):
  - No prior check-in → show.
  - Last check-in 4 days ago, no soft flags → don't show.
  - Last check-in 4 days ago, 2 soft flags in last 7 days → show (elevated).
  - Last check-in today → don't show.
- Unit (`apps/web/test/lesson/progress.test.ts`):
  - Start writes a row with `started_at`, `completed_at = null`, `source` from the body.
  - Complete sets `completed_at` and `revisit` correctly.
- Playwright E2E (`apps/web/test/e2e/lesson-loop.spec.ts`):
  1. Log in. `/app` — "This week's focus" card present. Click it.
  2. Land on `/app/lesson/<slug>`. Walk through cards 1–5. On card 6 click "Got it." Land back on `/app`.
  3. Reload `/app`. The "This week's focus" card now picks a different module (anti-repeat).
  4. Wait 8 days (use a `vi.setSystemTime` shim — fine to mock for the cadence test only). The check-in card appears. Submit "Yes" + "I tried redirecting." A `weekly_checkins` row is written with `tried_something = true`.
  5. With 2 soft flags inserted in the last 7 days, the check-in card appears 4 days after the prior check-in.

---

## Acceptance criteria

- `pnpm typecheck lint test` green; `pnpm --filter web build` green.
- All five sprint-2 demo flows pass end-to-end (the 8-step list in `TASKS.md` Sprint 2 success criteria).
- The picker rationale is rendered as the card subtitle in plain English.
- Anti-repeat enforced — a completed lesson does not re-pick within 14 days unless step 3 has nothing else.
- `lesson_progress` rows correctly distinguish completed vs revisit-completed.
- Weekly check-in surfaces at 7 days normally and at 3 days under soft-flag elevation. Skip writes a row.
- The Daily Lesson surface renders all six cards with the §6.5 cadence; no overflow at 375px viewport.
- ADR 0014 written.

---

## Files to create / modify

### Create

```
packages/picker/src/index.ts                                    # or packages/rag/src/picker/index.ts
packages/picker/src/pick.ts
packages/picker/src/types.ts
packages/picker/test/pick.test.ts
packages/picker/package.json                                    # if new package
apps/web/src/app/(authed)/app/lesson/[slug]/page.tsx
apps/web/src/components/lesson/LessonCarousel.tsx
apps/web/src/components/lesson/LessonCloseCard.tsx
apps/web/src/components/home/WeeksFocusCard.tsx
apps/web/src/components/home/CheckinCard.tsx
apps/web/src/lib/home/checkin-cadence.ts
apps/web/src/lib/lesson/load.ts                                  # split module body into cards
apps/web/src/lib/lesson/persist.ts                               # start / complete writes
apps/web/src/app/api/app/lesson/[slug]/start/route.ts
apps/web/src/app/api/app/lesson/[slug]/complete/route.ts
apps/web/src/app/api/app/checkin/route.ts
apps/web/src/app/api/app/checkin/skip/route.ts
apps/web/src/app/api/app/this-weeks-focus/route.ts
apps/web/src/app/api/app/checkin/should-show/route.ts
docs/adr/0014-weeks-focus-picker-and-lesson-surface.md
apps/web/test/home/checkin-cadence.test.ts
apps/web/test/lesson/progress.test.ts
apps/web/test/e2e/lesson-loop.spec.ts
```

### Modify

```
apps/web/src/app/(authed)/app/page.tsx                          # mount the new cards above ask-anything
apps/web/src/components/home/StarterChips.tsx                   # tiny: pass-through, no logic change
TASKS.md
```

### Do **not** touch

- The conversation surfaces from TASK-011 (the lesson surface lives at a different route).
- The retrieval / generation pipelines (the picker is metadata-only; no LLM calls).
- The library screen from TASK-023 (the lesson links **into** it but doesn't change it).
- The safety classifier internals.

---

## Out of scope

- **Spaced repetition / SRS** — explicitly deferred at the PRD level (§1.3).
- **Multi-turn lesson series** — every lesson is standalone in v0.
- **Notification / email reminders** for the check-in. In-app surface only.
- **A "this week's focus" admin override** for the content team. Reserved in the type but not implemented.
- **Lesson analytics dashboard.** Counts live in CloudWatch / direct DB queries for now.
- **Adaptive lesson length** based on engagement. v0 is fixed-six-cards.
- **Modifying retrieval based on `getRecentTopicSignal`** — the picker uses it, the answerer does not. (TASK-022 out-of-scope already names this; restating for clarity.)

---

## Decisions to make in the PR

- **Where the picker lives.** New `packages/picker` package, or `packages/rag/src/picker/`? My vote: **new package**. The picker has zero dependency on the RAG pipeline (no LLM calls, no embeddings) and pulling it out keeps the package boundaries clean. Modest cost: one more `package.json`.
- **Lesson card splitting.** Split on `##` is mechanical; it works for our seeded modules. If a module has zero `##` sections, fall back to splitting the body into thirds. Document the fallback.
- **Check-in copy.** Drafts above are mine. If the Caregiver-Support Clinician wants different wording in sprint 3, this is one file change.
- **What `source` defaults to** when the lesson is opened via a deep link without a query param. My vote: `library_browse`.

---

## Questions for PM before starting

1. **Picker policy step ordering.** I have profile-change > recent-topic > stage-baseline. Are you happy with that, or should recent-topic outrank profile-change? My vote: profile-change first — when the user explicitly tells us their situation shifted, we honor that signal over their question history.
2. **The 14-day anti-repeat window.** Sign off, or want shorter (7) / longer (28)? My vote: 14, matches the recent-topic window.
3. **What happens when the picker returns `no_pick`** — currently the home card says "Nothing new this week — try the library →." Is that fine, or do you want a friendlier "Here's something to revisit" that pulls a recent completed lesson? My vote: ship the simpler "library →" copy in v0; revisit-suggestion is a sprint-3 polish.
4. **Whether the check-in card's free-text "What helped?" field is required, optional, or absent.** My vote: optional — the binary yes/no is the metric; the free text is gravy.

---

## How PM verifies (sprint 2 demo script)

This is the demo for the whole sprint. Run it end-to-end.

1. Log in as a returning user with the seeded modules and at least 5 prior conversation messages on bathing-related topics.
2. `/app` — see "This week's focus" with the bathing module, subtitle "Because you've been asking about bathing-resistance."
3. Tap the card → `/app/lesson/<slug>`. Walk all 6 cards. Tap "Got it." Land back on `/app` with the saved banner.
4. Refresh `/app` — picker now shows a different module (sundowning, say) because bathing was just completed.
5. Open `/app/profile`, change "hardest thing right now" to "guilt." Save.
6. Refresh `/app` — picker now shows the guilt-and-grief module with subtitle "Because you said guilt is the hardest thing right now." (Assumes a module is tagged `guilt-and-grief` from TASK-023's tagging.)
7. `psql -c "select user_id, module_id, completed_at, source from lesson_progress order by completed_at desc limit 5;"` — see the rows.
8. `psql -c "update weekly_checkins set prompted_at = now() - interval '8 days' where user_id = '...';"` (or just delete and let the cadence kick) → reload `/app` → check-in card visible. Submit Yes + "I tried calmer mornings." `psql -c "select * from weekly_checkins order by answered_at desc limit 1;"` shows the row.
9. Take the burnout self-check at `/help/burnout-check` twice with red-severe scores (writes 2 soft flags). `psql -c "update weekly_checkins set prompted_at = now() - interval '4 days', answered_at = now() - interval '4 days' where ..."` → reload `/app` → check-in card surfaces at 4 days because of the soft-flag elevation.
10. Read ADR 0014.

If all 10 steps work, sprint 2 ships.

---

## Report-back

- Branch + PR + acceptance checklist mirror.
- Screenshots: `/app` with focus card + check-in, `/app/lesson/<slug>` cards 1, 3, 5, 6, picker subtitle for each rationale kind.
- Picker code path inline in the PR (it's the design-critical bit).
- Decisions you landed on (the four above).
- Anything in the demo script that didn't behave as expected — flag it before I run the demo, not after.
