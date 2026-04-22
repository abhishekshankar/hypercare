import { redirect } from "next/navigation";

import { ChangedFlow } from "@/app/(authed)/app/profile/changed/ChangedFlow";
import { requireSession } from "@/lib/auth/session";
import { loadProfileBundle } from "@/lib/onboarding/status";

export const metadata = { title: "My situation has changed" };

export default async function ProfileChangedPage() {
  const session = await requireSession();
  const { profile, user } = await loadProfileBundle(session.userId);
  if (profile == null) {
    redirect("/onboarding/step/1");
  }
  return <ChangedFlow displayName={user.displayName ?? ""} profile={profile} />;
}
