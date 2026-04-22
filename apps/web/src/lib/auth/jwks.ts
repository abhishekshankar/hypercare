import "server-only";
import { createRemoteJWKSet, type JWTPayload, jwtVerify } from "jose";

import { cognitoIssuer, cognitoJwksUrl, serverEnv } from "../env.server";

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

export function getCognitoRemoteJwks() {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(cognitoJwksUrl()));
  }
  return jwks;
}

export type IdTokenClaims = JWTPayload & {
  sub: string;
  email?: string;
  token_use?: string;
  aud?: string;
};

export function assertCognitoIdTokenUse(payload: JWTPayload): asserts payload is IdTokenClaims {
  if (payload.token_use !== "id") {
    throw new Error("invalid_id_token: token_use");
  }
  if (typeof payload.sub !== "string") {
    throw new Error("invalid_id_token: sub");
  }
}

/**
 * Verifies a Cognito ID token against the pool JWKS. Enforces `iss`, `aud` (app client id), and Cognito `token_use` / `sub`.
 */
export async function verifyCognitoIdToken(idToken: string): Promise<IdTokenClaims> {
  const jwk = getCognitoRemoteJwks();
  const { payload } = await jwtVerify(idToken, jwk, {
    issuer: cognitoIssuer(),
    audience: serverEnv.COGNITO_APP_CLIENT_ID,
  });
  assertCognitoIdTokenUse(payload);
  return payload;
}
