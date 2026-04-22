/**
 * 401 on `/api/app/*` — redirect browser to sign-in; see TASK-020 / ADR 0010.
 */
export function redirectToLoginForNextPath(nextPath: string): void {
  const next = nextPath.startsWith("/") ? nextPath : `/${nextPath}`;
  window.location.href = `/api/auth/login?next=${encodeURIComponent(next)}`;
}
