import { DbOfflineDev } from "@/components/db-offline-dev";
import { requireSession } from "@/lib/auth/session";
import { isDatabaseReachable } from "@/lib/db/reachable";
import { serverEnv } from "@/lib/env.server";

export default async function AuthedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireSession();
  const isBuild = process.env.NEXT_PHASE === "phase-production-build";
  if (serverEnv.NODE_ENV === "development" && !isBuild) {
    const ok = await isDatabaseReachable();
    if (!ok) {
      return <DbOfflineDev />;
    }
  }
  return children;
}
