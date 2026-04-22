import { changeSummaryLine, formatChangedAtLabel } from "@/lib/profile/change-copy";
import type { ProfileChangePart } from "@/lib/profile/change-diff";
import type { ProfileChangeListRow } from "@/lib/profile/load-recent-changes";

type Props = { items: ProfileChangeListRow[] };

export function RecentChanges({ items }: Props) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No changes recorded yet.</p>;
  }
  return (
    <ol className="list-decimal space-y-2 pl-5 text-sm text-foreground" data-testid="profile-recent-changes">
      {items.map((row) => (
        <li key={row.id}>
          {changeSummaryLine(
            {
              field: row.field,
              oldValue: row.oldValue,
              newValue: row.newValue,
              section: row.section as ProfileChangePart["section"],
            },
            {
              relativeTime: formatChangedAtLabel(
                row.changedAt instanceof Date ? row.changedAt.toISOString() : String(row.changedAt),
              ),
            },
          )}
        </li>
      ))}
    </ol>
  );
}
