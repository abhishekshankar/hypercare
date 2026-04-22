export type SessionPayload = {
  userId: string;
  cognitoSub: string;
  email: string;
  iat: number;
  exp: number;
  /** Short-lived key for revocation + device list (TASK-032). Omitted in legacy cookies. */
  sid?: string;
};

export type OauthStatePayload = {
  state: string;
  codeVerifier: string;
  /** Post-login same-origin path (e.g. /app/lesson/x). */
  next: string;
  iat: number;
  exp: number;
};
