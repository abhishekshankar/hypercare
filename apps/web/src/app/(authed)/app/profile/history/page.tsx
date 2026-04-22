import Link from "next/link";

import { ScreenHeader } from "@/components/screen-header";
import { requireSession } from "@/lib/auth/session";
import { loadRecentProfileChanges } from "@/lib/profile/load-recent-changes";
import { RecentChanges } from "@/components/profile/RecentChanges";

export const metadata = { title: "Profile change history" };

export default async function ProfileHistoryPage() {
  const session = await requireSession();
  const recent = await loadRecentProfileChanges(session.userId, 50);

  return (
    <div className="space-y-6">
      <ScreenHeader
        subHeadline="A longer history view will ship in a later version."
        title="Change history"
      />
      <RecentChanges items={recent} />
      <p>
        <Link className="text-sm text-muted-foreground underline" href="/app/profile">
          Back to care profile
        </Link>
      </p>
    </div>
  );
}
