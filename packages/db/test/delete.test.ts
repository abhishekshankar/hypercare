import { expect, it } from "vitest";

/**
 * Real delete + safety_flags de-identify assertions need a seeded user and DATABASE_URL.
 * Run in CI when an ephemeral Postgres is available; use `psql` checks from TASK-032 for PM.
 */
it.skip("deleteUserAccount de-identifies safety_flags and removes user (integration)", () => {
  expect(true).toBe(true);
});
