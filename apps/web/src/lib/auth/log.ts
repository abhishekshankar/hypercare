import "server-only";

export type AuthLogContext = {
  stage: string;
  reason: string;
} & { requestId?: string; message?: string; detail?: string };

/**
 * Collapse Error + `.cause` chains and common Postgres fields so logs show the real failure
 * (e.g. `ECONNREFUSED`, `ENOTFOUND`, `42P01`), not only Drizzle's "Failed query" wrapper.
 */
export function formatErrorForLog(e: unknown): string {
  if (e == null) {
    return "unknown";
  }
  if (typeof e !== "object") {
    return String(e);
  }
  if (e instanceof Error) {
    const parts: string[] = [];
    let cur: unknown = e;
    for (let depth = 0; depth < 8 && cur instanceof Error; depth++) {
      if (cur.message.length > 0) {
        parts.push(cur.message);
      }
      cur = cur.cause;
    }
    if (cur != null && !(cur instanceof Error)) {
      parts.push(String(cur));
    }
    const any = e as unknown as Record<string, unknown>;
    for (const k of ["code", "severity", "detail", "hint"] as const) {
      if (any[k] != null && String(any[k]).length > 0) {
        parts.push(`${k}=${String(any[k])}`);
      }
    }
    const merged = parts.filter(Boolean);
    return merged.length > 0 ? [...new Set(merged)].join(" | ") : e.name || "Error";
  }
  return String(e);
}

/**
 * Server-side only — never log secrets, tokens, or the Cognito client secret.
 */
export function logAuthError(ctx: AuthLogContext) {
  console.error(JSON.stringify(ctx));
}
