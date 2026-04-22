import "server-only";
import postgres from "postgres";

import { serverEnv } from "../env.server";

let cached: { at: number; ok: boolean } | null = null;
const CACHE_MS = 10_000;

/**
 * One-shot `SELECT 1` with a short connect timeout. Used in dev to avoid opaque "connection failed"
 * when the Aurora tunnel is down. Closes the client after the probe.
 */
export async function isDatabaseReachable(): Promise<boolean> {
  const now = Date.now();
  if (cached != null && now - cached.at < CACHE_MS) {
    return cached.ok;
  }
  try {
    const c = postgres(serverEnv.DATABASE_URL, {
      max: 1,
      prepare: false,
      connect_timeout: 4,
      idle_timeout: 1,
    });
    try {
      await c`select 1 as ok`;
      cached = { at: Date.now(), ok: true };
      return true;
    } finally {
      await c.end({ timeout: 5 });
    }
  } catch {
    cached = { at: Date.now(), ok: false };
    return false;
  }
}
