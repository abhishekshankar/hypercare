import Link from "next/link";

import { requireSession } from "@/lib/auth/session";
import { maybeLogUserSessionForApp } from "@/lib/internal/visit-log";

export default async function AppSectionLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const s = await requireSession();
  await maybeLogUserSessionForApp(s.userId);
  return (
    <div>
      <nav aria-label="App" className="mb-10 border-t border-border pt-6">
        <ul className="flex flex-wrap gap-6 text-sm text-foreground-muted md:gap-8">
          <li>
            <Link className="font-medium text-foreground no-underline hover:underline" href="/app">
              Home
            </Link>
          </li>
          <li>
            <Link className="text-foreground-muted no-underline hover:text-foreground hover:underline" href="/app/library">
              Library
            </Link>
          </li>
          <li>
            <Link className="text-foreground-muted no-underline hover:text-foreground hover:underline" href="/app/profile">
              Care profile
            </Link>
          </li>
          <li>
            <Link className="text-foreground-muted no-underline hover:text-foreground hover:underline" href="/app/help">
              Help &amp; feedback
            </Link>
          </li>
        </ul>
      </nav>
      {children}
    </div>
  );
}
