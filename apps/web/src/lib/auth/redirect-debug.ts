/**
 * Set `HC_REDIRECT_DEBUG=1` in `.env.local` to print auth redirect decisions to the **Next dev server**
 * terminal (middleware + `/api/auth/login`). Remove after debugging (noisy).
 */
export function redirectDebugEnabled(): boolean {
  return process.env.HC_REDIRECT_DEBUG === "1";
}

export function logRedirectDebug(scope: string, payload: Record<string, unknown>): void {
  if (!redirectDebugEnabled()) {
    return;
  }
  console.warn(`[hc:redirect:${scope}]`, JSON.stringify(payload));
}
