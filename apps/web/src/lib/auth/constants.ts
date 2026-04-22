export const SESSION_COOKIE_NAME = "hc_session";
export const OAUTH_COOKIE_NAME = "hc_oauth";

/**
 * `hc_session` — idle window (rolling) and hard cap from first `iat` (ADR 0004, TASK-032).
 * Default for new / refreshed cookies: min(iat + absolute, now + idle).
 */
export const SESSION_IDLE_TTL_SEC = 14 * 24 * 60 * 60;
export const SESSION_ABSOLUTE_MAX_SEC = 90 * 24 * 60 * 60;
/** @deprecated use SESSION_IDLE_TTL_SEC + sliding window; kept for any legacy imports */
export const DEFAULT_SESSION_TTL_SEC = SESSION_IDLE_TTL_SEC;

/** Short-lived cookie holding PKCE verifier + state. */
export const OAUTH_COOKIE_TTL_SEC = 10 * 60;
