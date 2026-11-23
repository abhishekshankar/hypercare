/**
 * Open redirect hardening: only in-app relative paths (no `//` protocol escape).
 */
export function safeNextPath(next: string | null, fallback: string): string {
  if (next == null || next.length === 0) {
    return fallback;
  }
  if (next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }
  return fallback;
}
