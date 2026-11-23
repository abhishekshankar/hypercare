import Link from "next/link";

/**
 * Shown from `(authed)/layout` when `NODE_ENV === "development"` and Postgres is unreachable.
 */
export function DbOfflineDev() {
  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-16 text-foreground">
      <h1 className="font-serif text-2xl font-normal tracking-tight">Can&apos;t reach the database</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Your app is pointed at Postgres (usually <code className="rounded bg-muted px-1">127.0.0.1:15432</code>{" "}
        through the SSM tunnel). If the tunnel isn&apos;t running, every signed-in page that loads
        profile or onboarding data will fail with a connection error.
      </p>
      <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
        <li>
          In a separate terminal, from the repo root, run:{" "}
          <code className="whitespace-pre-wrap rounded bg-muted px-2 py-1 text-xs text-foreground">
            ./scripts/db-tunnel.sh
          </code>
        </li>
        <li>Keep it running while you use the app locally.</li>
        <li>Refresh this page.</li>
      </ol>
      <p className="text-sm text-muted-foreground">
        See{" "}
        <Link className="text-accent underline-offset-2 hover:underline" href="/help">
          Help
        </Link>{" "}
        and <code className="text-xs">docs/infra-runbook.md</code> for the full data stack.
      </p>
    </div>
  );
}
