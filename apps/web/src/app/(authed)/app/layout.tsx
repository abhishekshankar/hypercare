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
      <nav
        aria-label="App"
        className="mb-8 border-b border-border pb-3 text-sm"
      >
        <ul className="flex flex-wrap gap-4 text-muted-foreground">
          <li>
            <Link className="hover:text-foreground" href="/app">
              Home
            </Link>
          </li>
          <li>
            <Link className="hover:text-foreground" href="/app/library">
              Library
            </Link>
          </li>
          <li>
            <Link className="hover:text-foreground" href="/app/profile">
              Care profile
            </Link>
          </li>
          <li>
            <Link className="hover:text-foreground" href="/app/help">
              Help &amp; feedback
            </Link>
          </li>
        </ul>
      </nav>
      {children}
    </div>
  );
}
