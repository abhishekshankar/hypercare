/**
 * Escape `%` and `_` for use inside a SQL ILIKE pattern with a fixed `%${pat}%` wrap.
 */
export function escapeIlikeForContains(q: string): string {
  return q.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}
