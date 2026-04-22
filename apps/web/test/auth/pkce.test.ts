import { describe, expect, it } from "vitest";

import { createCodeChallenge, createCodeVerifier } from "@/lib/auth/pkce";

describe("PKCE", () => {
  it("creates verifier in RFC length bounds", () => {
    const v = createCodeVerifier();
    expect(v.length).toBeGreaterThanOrEqual(43);
    expect(v.length).toBeLessThanOrEqual(128);
  });

  it("S256 challenge is stable and URL-safe", async () => {
    const v = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const a = await createCodeChallenge(v);
    const b = await createCodeChallenge(v);
    expect(a).toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9-_]+$/);
  });
});
