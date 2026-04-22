export const SESSION_COOKIE_NAME = "hc_session";
export const OAUTH_COOKIE_NAME = "hc_oauth";

/** Default session lifetime (8 hours). */
export const DEFAULT_SESSION_TTL_SEC = 8 * 60 * 60;

/** Short-lived cookie holding PKCE verifier + state. */
export const OAUTH_COOKIE_TTL_SEC = 10 * 60;
