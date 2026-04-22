import Link from "next/link";
import { redirect } from "next/navigation";

import { CareProfileEditor } from "@/components/profile/CareProfileEditor";
import { RecentChanges } from "@/components/profile/RecentChanges";
import { ScreenHeader } from "@/components/screen-header";
import { requireSession } from "@/lib/auth/session";
import { greetingForLocalHour } from "@/lib/greeting";
import { loadRecentProfileChanges } from "@/lib/profile/load-recent-changes";
import { loadProfileBundle } from "@/lib/onboarding/status";

type Props = {
  searchParams: Promise<{ saved?: string }>;
};

export default async function ProfilePage({ searchParams }: Props) {
  const session = await requireSession();
  const { profile, user } = await loadProfileBundle(session.userId);
  if (profile == null) {
    redirect("/onboarding/step/1");
  }
  const recent = await loadRecentProfileChanges(session.userId, 5);
  const sp = await searchParams;
  const banner = sp.saved === "1";

  const displayName = user.displayName?.trim() || "there";
  const crName = profile.crFirstName?.trim() || "them";
  const hour = new Date().getHours();
  const greet = greetingForLocalHour(hour);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <p className="text-base text-foreground">
          {greet}, {displayName}.
        </p>
        <p className="text-base text-foreground">Caring for {crName}.</p>
      </div>
      {banner ? (
        <p
          className="rounded-md border border-accent/30 bg-accent/5 px-3 py-2 text-sm text-foreground"
          role="status"
        >
          Saved. Your this week&apos;s focus may shift to match.
        </p>
      ) : null}
      <ScreenHeader
        subHeadline="This is the transparency layer for personalization: what Hypercare is using, and your controls."
        title="Care profile"
      />
      <div>
        <Link
          className="inline-flex rounded-md bg-foreground px-4 py-2.5 text-sm font-medium text-background"
          data-testid="profile-changed-cta"
          href="/app/profile/changed"
        >
          My situation has changed
        </Link>
      </div>
      <CareProfileEditor displayName={user.displayName ?? ""} profile={profile} />
      <section className="space-y-2">
        <h2 className="text-lg font-medium text-foreground">Recent changes</h2>
        <RecentChanges items={recent} />
        <p>
          <Link
            className="text-sm text-muted-foreground underline-offset-2 hover:underline"
            href="/app/profile/history"
          >
            View all
          </Link>
        </p>
      </section>
    </div>
  );
}

export const metadata = { title: "Care profile" };
