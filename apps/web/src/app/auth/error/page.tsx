import Link from "next/link";

import { ScreenHeader } from "@/components/screen-header";

type Props = Readonly<{
  searchParams: Promise<{ reason?: string }>;
}>;

export default async function AuthErrorPage({ searchParams }: Props) {
  const { reason } = await searchParams;
  return (
    <>
      <ScreenHeader
        subHeadline={
          reason
            ? `Something went wrong during sign-in (${reason}). Try again, or use Help for crisis resources.`
            : "Something went wrong during sign-in. Try again, or use Help for crisis resources."
        }
        title="Sign-in error"
      />
      <p className="text-muted-foreground">
        The crisis strip above is always available. If the problem continues, return to the app home and
        use sign-in again.
      </p>
      <p className="mt-6">
        <Link
          className="text-sm font-medium text-accent underline-offset-4 hover:underline"
          href="/api/auth/login?next=%2Fapp"
        >
          Try sign-in again
        </Link>
      </p>
      {process.env.NODE_ENV === "development" && reason === "invalid_state" ? (
        <p className="mt-4 text-sm text-muted-foreground">
          <strong className="text-foreground">invalid_state (dev):</strong> the PKCE cookie must be sent on the
          same host Cognito redirects to (see <code className="text-xs">AUTH_BASE_URL</code> / callback URL). If you
          opened <code className="text-xs">127.0.0.1</code> but Cognito uses <code className="text-xs">localhost</code>{" "}
          (or the reverse), the cookie is missing. Use one host consistently—the app should redirect you
          automatically—or clear site cookies and open the URL that matches <code className="text-xs">AUTH_BASE_URL</code>
          .
        </p>
      ) : null}
      {process.env.NODE_ENV === "development" && reason !== "invalid_state" ? (
        <div className="mt-4 space-y-2 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Dev:</strong> In the <code className="text-xs">next dev</code>{" "}
            terminal, look for <code className="text-xs">auth_callback</code> or Postgres messages after a failed
            sign-in.
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-foreground">Connection string:</strong> only the password should be
              percent-encoded if it contains <code className="text-xs">:</code>, <code className="text-xs">@</code>,{" "}
              <code className="text-xs">/</code>, <code className="text-xs">#</code>, <code className="text-xs">%</code>
              , or spaces (e.g. <code className="text-xs">encodeURIComponent(password)</code> in Node).
            </li>
            <li>
              <strong className="text-foreground">Schema:</strong> from the repo root,{" "}
              <code className="text-xs">DATABASE_URL=… pnpm --filter @hypercare/db migrate</code> so the{" "}
              <code className="text-xs">users</code> table (and the rest) exists.
            </li>
          </ul>
          <p>
            More context: <code className="text-xs">docs/auth-runbook.md</code> at the project root.
          </p>
        </div>
      ) : null}
    </>
  );
}
