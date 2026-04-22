# TASK-038 — Family sharing v1 (invite a second caregiver to a profile)

- **Owner:** Cursor (data model, invite flow, surfaces); PM + Privacy reviewer (sign off the default-share posture before merge)
- **Depends on:** TASK-019 (`care_profile` schema), TASK-020 (editable care profile + audit), TASK-033 ("What Hypercare remembers" transparency surface — extends to list co-caregivers), TASK-006 (Cognito auth — invite acceptance is a normal sign-in)
- **Unblocks:** PRD §4.1 / §2.1 — multi-caregiver households; the most common Sprint 4 cohort free-text request; future cross-thread sharing affordances (out of scope here)
- **Status:** in progress (schema + read paths + audit; invite UI / email / E2E still open)
- **ADR:** `docs/adr/0027-family-sharing-data-model-and-privacy.md` (new — `care_profile_members` shape, default privacy posture, audit semantics, invite lifecycle)

---

## Why this exists

The PRD (§4.1, §2.1) acknowledged from day one that "in many families, caregiving is split across siblings with unequal involvement," and v1 deliberately did not solve it: one Cognito user, one care profile, one care recipient. Sprint 4's beta cohort surfaced this hard:

- ~40% of cohort caregivers mentioned a second caregiver (sibling, spouse, adult child) in onboarding free-text or thumbs-down feedback (TASK-036 queue).
- Several specific complaints: "my sister also takes Mom to appointments and doesn't know what we discussed" / "my husband should be able to see the plan we built" / "I made my brother an account and now we have two profiles for the same parent."

The third one is the operational signal: caregivers are creating duplicate profiles to work around the missing feature, which fragments the data we need for retention metrics and SRS scheduling. The longer we wait, the more profiles diverge.

This ticket ships **family sharing v1**: one care recipient, multiple caregivers on one profile, with an explicit privacy default that protects conversation history and saved answers but shares the profile + library state. PRD §4.1 framed the v2 feature as "multi-patient profiles"; we're shipping the multi-caregiver case first because that's what the cohort actually asked for. Multi-recipient (one caregiver, two parents) stays deferred.

---

## Context to read first

1. `prd.md` §4.1 (the v2 framing), §2.1 (the family-split rationale), §10 (privacy posture; the default share rules sit on top of this).
2. `docs/adr/0021-privacy-retention-export-delete.md` — Sprint 4's privacy posture; family sharing must not loosen any guarantee made there.
3. TASK-020 ticket and `apps/web/src/app/(authed)/app/profile/` — the editable care profile surface; co-edit semantics need to compose with the audit log.
4. TASK-033 ticket and `apps/web/src/app/(authed)/app/help/remembers/` — the "What Hypercare remembers" page; co-caregivers must appear here with what is and isn't shared.
5. `packages/db/src/schema/` — the existing `care_profile` and `users` schemas; the new join table is added beside them.
6. Cognito invite path documented in `docs/auth-runbook.md` — invite emails reuse the same transactional sender; we are not building new mail infrastructure.

---

## What "done" looks like

### 1. Data model: `care_profile_members`

```
care_profile_members (
  id                uuid pk,
  care_profile_id   uuid fk care_profile (not null),
  user_id           uuid fk users (not null),
  role              text not null,           -- 'owner' | 'co_caregiver'
  invited_by        uuid fk users (not null),
  invited_at        timestamptz not null default now(),
  accepted_at       timestamptz,             -- null until accepted
  removed_at        timestamptz,             -- null while active; soft-delete on remove
  -- privacy preferences (per-member, future-proofs cross-thread sharing)
  share_conversations_with_other_members  boolean not null default false,
  share_saved_answers_with_other_members  boolean not null default false,
  unique (care_profile_id, user_id) where removed_at is null
)
```

Constraints:

- Exactly one `owner` per `care_profile_id` at any time. Migration backfills the existing profile's `user_id` as owner.
- Owner cannot be removed (must transfer ownership first; out of scope for v1, but the constraint is there).
- A user can be a member of multiple profiles (siblings caring for two parents); each invite is independent.

The existing `care_profile.user_id` column stays for back-compat but is deprecated in favor of `care_profile_members`. All read paths in Sprint 5 read from the join table; the `user_id` column gets dropped in Sprint 6 after a verification window.

### 2. Default privacy posture (the meat)

ADR 0027 records and PM/Privacy sign off:

| Surface | Default | Rationale |
| --- | --- | --- |
| Care profile (stage, recipient name, situation notes) | **Shared** between members; either can edit; every change writes an audit row that names the editor | The profile is "the plan we built"; shared editing is the whole point of the feature |
| Library (saved bookmarks, recent topics shared into library) | **Shared** read; either can save | Looking something up should be a household action |
| Conversation history (`/app/conversation/*`) | **Not shared.** Each caregiver sees only their own threads | Asking the AI is a private act; many cohort users explicitly said this in onboarding free-text |
| Saved answers ("Things to revisit" on `/app`) | **Not shared.** Each caregiver's saves are their own | Saves are a private bookmark, not a household resource |
| Lesson progress + SRS schedule (TASK-037) | **Per-member.** Each caregiver has their own progress | A sibling who already learned about bathing-resistance shouldn't have it filtered out for the other |
| Thumbs-up / thumbs-down (TASK-036) | **Per-member.** | Feedback is personal |
| Transparency page (TASK-033) | Lists all co-caregivers by name + email; each member can see only their own privacy preferences | This is what makes the share posture honest |

The two boolean columns on `care_profile_members` (`share_conversations_*`, `share_saved_answers_*`) exist so a member can opt **in** to sharing in a future ticket (Sprint 6+). v1 ships them defaulted false; no UI toggles them yet. ADR 0027 records that loosening the default requires a separate ADR.

### 3. Invite flow

A new surface at `/app/profile/family`:

- Lists current members with role + joined date + a "remove" button (owner-only; can't remove self).
- An "Invite a co-caregiver" form: email + optional one-line note ("This is my brother Sam; he takes Dad to neurology appointments").
- On submit: insert a `care_profile_members` row with `accepted_at: null`, send an email via the existing Cognito transactional path. The email links to `/invite/[token]` and includes the inviter's name + the optional note.

`/invite/[token]` flow:

- If the recipient has no Cognito account: standard sign-up, then accept.
- If they have one: sign in, then accept.
- Acceptance sets `accepted_at` on the membership row. The user is redirected to `/app` and sees the shared profile populated; their onboarding (TASK-007 / TASK-034) is **short-circuited** — care recipient and stage are already set, and the post-onboarding redirect goes straight to `/app` with a one-time banner: *"You're now caring for [Recipient] alongside [Inviter]. You can update what we know about [Recipient] anytime in your profile."*

Tokens:

- `invite_tokens` table with `id, token (random 32 bytes), care_profile_member_id, expires_at (7d), consumed_at`.
- Token is single-use; consumed on acceptance.
- Resend = revoke old token, mint new one. Owner sees the resend button only after 24h have passed since the last send.

### 4. Audit semantics (extends TASK-020)

The existing `care_profile_changes` audit table gains a `changed_by` column (already there per TASK-020) and a `changed_by_role` derived join in the surface — so the profile history reads "Sam edited Mom's stage from middle to late on April 24." Both members see the full audit log.

### 5. Surface updates

- `/app/profile/family` — new (per §3).
- `/app/profile` — the existing editable profile (TASK-020) gains a small "Edited by" attribution beside each field showing who last touched it.
- `/app/help/remembers` (TASK-033) — gains a "Who else can see this" section listing co-caregivers and what is and isn't shared per the table in §2.
- `/app` greeting — uses the recipient name (already does), unchanged. Does **not** name the other caregiver in the greeting (avoids confusion if the recipient name is colloquial — "Mom" reads differently to a sibling).
- `/app/conversation/*` and saved answers — no UI change. The session gate on these routes already filters by `user_id`; that's the privacy enforcement.

### 6. Migration + backfill

Migration **`0017_family_sharing.sql`** (repo already uses `0016_lesson_review_schedule.sql`; family sharing lands as the next journal entry):

- Creates `care_profile_members`, `invite_tokens`.
- Adds `care_profile_changes.changed_by` (backfilled from `user_id`).
- Backfills: for every existing `care_profile`, inserts a member row with `role='owner', user_id=care_profile.user_id, invited_by=care_profile.user_id, invited_at=care_profile.created_at, accepted_at=care_profile.created_at`.
- Adds partial unique indexes (one owner per profile; one active user per profile; one pending invite per email per profile).
- **Online-safe** on `care_profile`: additive DDL + `INSERT…SELECT` backfill only.

**Spec note:** Pending invites before the invitee has a `users` row use `invitee_email` + null `user_id` on `care_profile_members` (documented in ADR 0027); the ticket ASCII block assumed `user_id` was always present.

### 7. Read-path changes

Every place that reads "the current user's care profile" becomes "the care profile this user is a member of" — a join through `care_profile_members where user_id = $session.user.id and removed_at is null`. Helpers:

- `packages/db/src/queries/care-profile.ts` gains `getCareProfileForUser(userId)` returning the single profile + the membership row.
- A user with zero memberships sees the onboarding flow (TASK-007 / TASK-034) — same as today's "no profile" state.
- A user with multiple memberships (caring for two parents in different households) — out of scope; throw an explicit `MultipleProfilesNotSupportedError` and log it. We expect zero such users in v1.

---

## Tests

- Unit (`packages/db/test/queries/care-profile.test.ts`): `getCareProfileForUser` returns the right profile for owner, for accepted co-caregiver, and `null` for a non-member; throws on multi-membership.
- Unit (`packages/safety/test/membership-gate.test.ts`): conversation routes refuse access to threads owned by a different `user_id` even if the requesting user is a co-caregiver on the same profile.
- Integration (`packages/db/test/care-profile-members.integration.test.ts` with `MEMBERS_INTEGRATION=1`): full invite → token mint → accept → membership-active flow against a real DB; revoke + resend works; backfill is idempotent.
- E2E (`apps/web/test/e2e/family-invite.spec.ts`): owner A invites B by email; intercept the mail call; visit `/invite/[token]` as a fresh Cognito session; complete sign-up; land on `/app` with the shared profile and the one-time banner; assert the audit page shows both members.
- E2E (`apps/web/test/e2e/family-privacy-default.spec.ts`): A and B both signed in; A sends a conversation message; B's `/app/conversation` does not list A's thread; B sends a message; A's list does not include B's; both can see and edit the shared profile.
- E2E (`apps/web/test/e2e/family-transparency.spec.ts`): on `/app/help/remembers`, B sees A's name and the share-table from §2 rendered.

---

## Acceptance criteria

- Migration `0017` applied; backfill creates one owner row per existing profile.
- Default privacy posture per §2 enforced at the route handler / DB query layer (not only the UI).
- Invite → email → accept → shared-profile flow works end-to-end on dev.
- Audit log attribution renders on `/app/profile` and `/app/help/remembers`.
- Onboarding short-circuit on accept: recipient + stage are not re-asked.
- ADR 0027 written. **Privacy reviewer sign-off recorded in the ADR.**
- `pnpm lint typecheck test` green. Safety eval and answers eval don't regress.
- `docs/schema-v2.md` (TASK-043) carries the new tables.

---

## Out of scope

- Multi-care-recipient households (one caregiver, two parents). PRD §4.1 also defers this.
- Cross-thread conversation sharing. The two `share_*` columns exist but no UI toggles them. Sprint 6+ work.
- Cross-caregiver saved-answer sharing. Same.
- Ownership transfer. Owner is the inviter; v1 has no "promote a co-caregiver to owner" flow.
- A shared notifications channel ("Sam viewed the plan today"). Out of scope.
- SSO / OIDC across the household (a single sign-in for both caregivers). Each has their own Cognito identity.
- A native invite-by-SMS path. Email only.
- A way for a third caregiver to invite. v1 lets only the owner invite; co-caregivers can't add more members.

---

## Decisions to make in the PR

- **Cap on members per profile.** Strawman: 4 (owner + 3 co-caregivers). Cohort feedback didn't show households with more; the cap protects us from runaway shared edits and audit noise. Configurable; freeze in `packages/db/src/schema/care-profile.ts` constants.
- **Token TTL.** 7 days strawman. Aligns with Cognito invite default.
- **Co-caregiver access to the privacy controls.** Strawman: each member sees only their own membership row. Owner can see who's a member but not their per-member share-prefs (though both default false in v1, so nothing to see).
- **What happens to a removed co-caregiver's data.** Their conversation threads + saves remain theirs (they keep access if they re-invite themselves to a different profile or use the app standalone). The profile-edit audit history retains their attribution. Soft-delete the membership; do not cascade to user-owned rows.

---

## Questions for PM before starting

1. **Privacy default sign-off.** The §2 table is the load-bearing decision. Confirm or push back per surface. Conversation-not-shared is the riskiest call (one cohort user did say "I want my husband to see what we talked about"); the v1 default protects everyone, the opt-in toggles ship in Sprint 6.
2. **Invite copy.** Strawman first line: *"Sam invited you to help care for [Recipient] in Hypercare."* Care Specialist may want different framing — "to help care for" reads heavier than "to share their Hypercare account for." Defer to PM on tone.
3. **Onboarding banner duration.** Strawman: dismissible, persists across reloads until dismissed. Alternative: one-time only. Confirm.
4. **Multi-membership error path.** A user invited to a second profile while already on one — strawman is `MultipleProfilesNotSupportedError` and surface a friendly "Hypercare doesn't support helping with two households yet — let us know if this matters to you" with a link to feedback. Confirm we want to surface anything at all rather than silently ignoring the second invite.

---

## How PM verifies

1. Apply migration `0014` to dev. Confirm one owner row per existing profile; spot-check 5.
2. Sign in as a beta cohort user. Visit `/app/profile/family`. Invite a second test account by email.
3. Open the invite link in an incognito window. Sign up. Land on `/app` — see the shared profile, the banner, the right recipient name.
4. As the co-caregiver, send a conversation message. Sign back in as the owner — confirm the co-caregiver's thread does **not** appear in your conversation list.
5. As the owner, edit the recipient's stage. As the co-caregiver, refresh `/app/profile`. Confirm the change appears with "Edited by [Owner]" attribution.
6. As the co-caregiver, visit `/app/help/remembers`. Confirm the "Who else can see this" section names the owner and shows the share table from §2.
7. As the owner, remove the co-caregiver. Confirm they lose access on next request (route handler returns 404 on the shared profile read — they're treated as a no-membership user).
8. Read ADR 0027 and confirm the privacy-reviewer sign-off line is filled in.
