// @vitest-environment node
import { describe, expect, it } from "vitest";
import { exportJWK, generateKeyPair, SignJWT, createLocalJWKSet, jwtVerify } from "jose";

import { assertCognitoIdTokenUse } from "@/lib/auth/jwks";
import { serverEnv } from "@/lib/env.server";

describe("assertCognitoIdTokenUse", () => {
  it("accepts id token with sub", () => {
    const p = { token_use: "id", sub: "abc" };
    assertCognitoIdTokenUse(p);
    expect(p.sub).toBe("abc");
  });

  it("rejects access token and missing sub", () => {
    expect(() => assertCognitoIdTokenUse({ token_use: "access", sub: "x" })).toThrow();
    expect(() => assertCognitoIdTokenUse({ token_use: "id" })).toThrow();
  });
});

describe("jose + local JWK (pattern matches Cognito verify)", () => {
  it("verifies a signed RS256 JWT then applies Cognito id-token checks", async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    const jwk = await exportJWK(publicKey);
    const jwks = createLocalJWKSet({ keys: [jwk] });
    const issuer = `https://cognito-idp.${serverEnv.COGNITO_REGION}.amazonaws.com/${serverEnv.COGNITO_USER_POOL_ID}`;
    const idToken = await new SignJWT({
      token_use: "id",
    })
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setIssuer(issuer)
      .setAudience(serverEnv.COGNITO_APP_CLIENT_ID)
      .setSubject("test-sub-123")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);
    const { payload } = await jwtVerify(idToken, jwks, {
      issuer,
      audience: serverEnv.COGNITO_APP_CLIENT_ID,
    });
    assertCognitoIdTokenUse(payload);
    expect(payload.sub).toBe("test-sub-123");
  });
});
