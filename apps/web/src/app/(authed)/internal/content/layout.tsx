import { getSessionWithRole } from "@/lib/internal/content-access";

export default async function InternalContentLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const s = await getSessionWithRole();
  if (s == null) {
    return (
      <main className="p-6">
        <h1 className="text-xl font-semibold">Content tools</h1>
        <p className="mt-2 text-neutral-600">You don’t have access to the internal content workspace.</p>
      </main>
    );
  }
  return (
    <div>
      <header className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
        <span className="font-medium">Content workspace</span>
        <span className="text-neutral-500"> — {s.user.email} ({s.user.role})</span>
        <nav className="mt-2 flex flex-wrap gap-3">
          <a className="underline" href="/internal/content">
            Pipeline
          </a>
          <a className="underline" href="/internal/content/briefs">
            Briefs
          </a>
          <a className="underline" href="/internal/content/audit">
            Weekly audit
          </a>
          <a className="underline" href="/app/library">
            Public library
          </a>
        </nav>
      </header>
      {children}
    </div>
  );
}
