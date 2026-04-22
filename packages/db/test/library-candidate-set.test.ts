import { describe, it } from "vitest";

/**
 * TASK-041: full membership-matrix tests for `loadLibrarySearchCandidates` belong here once we
 * wire profile-scoped bookmarks + `recent_topic` rows against a live Postgres fixture.
 * `getCareProfileForUser` (TASK-038) is already used to resolve `care_profile_id` for telemetry.
 */
describe.skip("library candidate set + TASK-038 membership (integration)", () => {
  it("owner vs co-caregiver vs no-membership candidate visibility", () => {
    // Enable with DATABASE_URL + migrated schema when we add bookmark-scoped modules.
  });
});
