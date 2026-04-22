import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import { isInternalAdmin } from "@/lib/auth/internal-admin";
import { logAdminAudit } from "@/lib/internal/visit-log";

export default async function InternalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const s = await getSession();
  if (s == null) {
    notFound();
  }
  if (!(await isInternalAdmin(s.userId, s.email))) {
    notFound();
  }
  const h = await headers();
  const path = h.get("x-hc-pathname") ?? "/internal";
  await logAdminAudit(s.userId, path);
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="border-b border-zinc-200 bg-white px-4 py-2 text-sm">
        <nav className="mx-auto flex max-w-5xl flex-wrap gap-4" aria-label="Internal">
          <Link className="text-zinc-600 underline-offset-2 hover:underline" href="/internal/metrics">
            Metrics
          </Link>
          <Link
            className="text-zinc-600 underline-offset-2 hover:underline"
            href="/internal/safety-flags"
          >
            Safety flags
          </Link>
          <Link className="text-zinc-600 underline-offset-2 hover:underline" href="/internal/safety">
            Safety FT shadow
          </Link>
          <Link className="text-zinc-600 underline-offset-2 hover:underline" href="/internal/feedback">
            Feedback
          </Link>
        </nav>
      </div>
      <div className="mx-auto max-w-5xl px-4 py-6">{children}</div>
    </div>
  );
}
