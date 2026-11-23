// @vitest-environment node
import { describe, expect, it } from "vitest";

import { signPayload, verifyPayload } from "@/lib/auth/cookie";

const secret = "unit-test-cookie-secret-min-32b-long!!";

describe("signed cookie", () => {
  it("round-trips a payload and rejects bad sig", async () => {
    const t = await signPayload(secret, { a: 1, b: "x" });
    const p = await verifyPayload<Record<string, unknown>>(secret, t);
    expect(p).toEqual({ a: 1, b: "x" });
  });

  it("rejects wrong secret and tampered payload", async () => {
    const t = await signPayload(secret, { n: 1 });
    expect(await verifyPayload(secret + "x", t)).toBeNull();
    const bork = t.slice(0, -1) + (t.at(-1) === "A" ? "B" : "A");
    expect(await verifyPayload(secret, bork)).toBeNull();
  });
});
