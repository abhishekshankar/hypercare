export type SessionPayload = {
  userId: string;
  cognitoSub: string;
  email: string;
  iat: number;
  exp: number;
};

export type OauthStatePayload = {
  state: string;
  codeVerifier: string;
  /** Post-login same-origin path (e.g. /app/lesson/x). */
  next: string;
  iat: number;
  exp: number;
};
