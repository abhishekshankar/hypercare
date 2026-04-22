import { afterEach, describe, expect, it, vi } from "vitest";

import { isE2ETestRuntime } from "@/lib/env.test-runtime";

/**
 * `process.env.NODE_ENV` is typed read-only in TypeScript 5.x. Direct
 * assignment / `delete` works at runtime but fails `tsc --noEmit`. Vitest's
 * `stubEnv` / `unstubAllEnvs` is both type-safe and the documented pattern
 * for this case (TASK-015).
 */
describe("isE2ETestRuntime", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns true when NODE_ENV is test", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("PLAYWRIGHT_TEST_BASE_URL", "");
    expect(isE2ETestRuntime()).toBe(true);
  });

  it("returns true when PLAYWRIGHT_TEST_BASE_URL is set outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("PLAYWRIGHT_TEST_BASE_URL", "http://127.0.0.1:3456");
    expect(isE2ETestRuntime()).toBe(true);
  });

  it("returns false in production even when PLAYWRIGHT_TEST_BASE_URL is set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PLAYWRIGHT_TEST_BASE_URL", "http://127.0.0.1:3456");
    expect(isE2ETestRuntime()).toBe(false);
  });

  it("returns false when not test and no Playwright base URL", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("PLAYWRIGHT_TEST_BASE_URL", "");
    expect(isE2ETestRuntime()).toBe(false);
  });
});
