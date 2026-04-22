import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { assertDatabaseUrl } from "./env.js";
import * as schema from "./schema/index.js";

/** Hostname pattern for AWS RDS / Aurora (TLS expected from local dev). */
function isAwsRdsHost(url: string): boolean {
  return /\.rds\.amazonaws\.com(\.cn)?(?::|\/|\?|#|$)/i.test(url);
}

/**
 * Use TLS for hosts that require it. `sslmode=disable` wins for local tunnels to plain Postgres.
 * Parsed hostname avoids forcing SSL on `127.0.0.1` even when the URL string mentions a cloud provider.
 */
function shouldRequireSsl(databaseUrl: string): boolean {
  if (/\bsslmode=disable\b/i.test(databaseUrl)) {
    return false;
  }
  if (/\bsslmode=(require|verify-full|verify-ca)\b/i.test(databaseUrl)) {
    return true;
  }
  if (/[?&]ssl=true(?:&|$)/i.test(databaseUrl)) {
    return true;
  }
  if (isAwsRdsHost(databaseUrl)) {
    return true;
  }
  try {
    const u = new URL(databaseUrl.replace(/^postgres(ql)?:/i, "http:"));
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
      return false;
    }
    if (
      host.endsWith(".rds.amazonaws.com") ||
      host.endsWith(".rds.amazonaws.com.cn") ||
      host.includes(".neon.tech") ||
      host.includes(".supabase.co") ||
      host.endsWith(".render.com")
    ) {
      return true;
    }
  } catch {
    /* invalid URL — postgres driver will surface its own error */
  }
  return false;
}

/** Creates a Drizzle client for the given Postgres URL (validated). Not a singleton. */
export function createDbClient(databaseUrl: string) {
  assertDatabaseUrl(databaseUrl);
  const client = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    /** Avoid hanging SSR (e.g. `/app/library`) when the tunnel drops after a recent reachability probe. */
    connect_timeout: 15,
    ...(shouldRequireSsl(databaseUrl) ? { ssl: "require" as const } : {}),
  });
  return drizzle(client, { schema });
}
