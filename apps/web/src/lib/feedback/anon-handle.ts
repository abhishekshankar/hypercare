/**
 * Shown on internal surfaces — not raw email.
 */
export function anonymizedHandle(displayName: string | null | undefined, userId: string): string {
  const d = displayName?.trim();
  if (d && d.length > 0) {
    if (d.length === 1) return `${d}•`;
    return `${d[0] ?? "?"}•••${d[d.length - 1] ?? ""}`;
  }
  return `Member ${userId.replace(/-/g, "").slice(0, 8)}`;
}
