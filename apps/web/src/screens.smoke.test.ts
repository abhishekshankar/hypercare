import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, expect, test } from "vitest";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const buildIdPath = path.join(webRoot, ".next", "BUILD_ID");

const paths = [
  "/",
  "/onboarding",
  "/app",
  "/app/conversation/placeholder-id",
  "/app/lesson/test",
  "/app/library",
  "/app/profile",
  "/help",
  "/auth/error",
];

let baseUrl: string;
let child: ReturnType<typeof spawn> | undefined;

async function waitForServer(url: string) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.status < 500) {
        return;
      }
    } catch {
      /* not ready */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server at ${url} did not become ready in time`);
}

beforeAll(async () => {
  if (!existsSync(buildIdPath)) {
    throw new Error(
      "Missing .next build output. Run `pnpm --filter web build` (or `pnpm build` from repo root) before `pnpm --filter web test`.",
    );
  }

  const port = 3100 + (process.pid % 1000);
  baseUrl = `http://127.0.0.1:${port}`;

  child = spawn("pnpm", ["exec", "next", "start", "-p", String(port)], {
    cwd: webRoot,
    env: { ...process.env, PORT: String(port) },
    stdio: "pipe",
  });

  await waitForServer(baseUrl);
});

afterAll(async () => {
  if (child?.pid) {
    child.kill("SIGTERM");
    await new Promise((r) => setTimeout(r, 1500));
  }
});

test.each(paths)("GET %s includes crisis strip phone", async (pathname) => {
  const res = await fetch(`${baseUrl}${pathname}`, { redirect: "manual" });
  expect(res.status).toBe(200);
  const html = await res.text();
  expect(html).toContain("800-272-3900");
});
