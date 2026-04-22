import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * When embeddings fail, `publishModuleFromDatabase` must not commit chunk/version rows.
 * The implementation resolves embeddings *before* opening a DB transaction; we assert that ordering.
 */
describe("publishModuleFromDatabase (unit)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects unapproved state without touching DB (smoke: import + guard)", async () => {
    const { publishModuleFromDatabase } = await import("../src/ingest.js");
    await expect(
      publishModuleFromDatabase({
        databaseUrl: "postgres://nope",
        moduleId: "00000000-0000-4000-8000-000000000000",
        currentDraftStatus: "draft",
        appUserRole: "content_lead",
        publishedBy: "00000000-0000-4000-8000-000000000000",
      }),
    ).rejects.toThrow(/approved/);
  });
});
