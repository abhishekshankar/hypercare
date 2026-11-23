import { describe, expect, it } from "vitest";

import { formatErrorForLog } from "@/lib/auth/log";

describe("formatErrorForLog", () => {
  it("includes nested Error.cause messages", () => {
    const inner = new Error("connection failed");
    const outer = new Error("Failed query: select 1");
    outer.cause = inner;
    const s = formatErrorForLog(outer);
    expect(s).toContain("Failed query");
    expect(s).toContain("connection failed");
  });

  it("includes postgres-style fields when present on the error object", () => {
    const e = new Error("insert failed");
    Object.assign(e, { code: "42P01", detail: 'relation "users" does not exist' });
    expect(formatErrorForLog(e)).toContain("42P01");
    expect(formatErrorForLog(e)).toContain("users");
  });
});
