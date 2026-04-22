import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IdTokenClaims } from "@/lib/auth/jwks";
import { emailFromClaims, upsertUserFromClaims } from "@/lib/auth/users";

const baseClaims: Pick<IdTokenClaims, "sub" | "iss" | "aud" | "exp" | "iat" | "token_use"> = {
  sub: "a",
  iss: "x",
  aud: "y",
  exp: 1,
  iat: 1,
  token_use: "id",
};

describe("emailFromClaims", () => {
  it("uses email when present", () => {
    expect(
      emailFromClaims({
        ...baseClaims,
        sub: "a",
        email: "a@b.com",
      }),
    ).toBe("a@b.com");
  });

  it("synthesizes a placeholder when email missing", () => {
    expect(
      emailFromClaims({
        ...baseClaims,
        sub: "sub-1",
      }),
    ).toBe("sub-1@users.invalid");
  });
});

describe("upsertUserFromClaims", () => {
  const claims: IdTokenClaims = {
    sub: "cognito-sub-xyz",
    email: "u@example.com",
    token_use: "id",
    iss: "x",
    aud: "y",
    exp: 9_999_999_999,
    iat: 1_700_000_000,
  };

  const returningRow = {
    id: "00000000-0000-0000-0000-000000000001",
    cognitoSub: claims.sub,
    email: claims.email!,
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("insert vs update both return a row (mocked drizzle chain)", async () => {
    const insertChain = {
      values: () => insertChain,
      onConflictDoUpdate: () => insertChain,
      returning: () => Promise.resolve([returningRow]),
    };
    const db = {
      insert: () => insertChain,
      update: () => ({
        set: () => ({
          where: () => Promise.resolve(undefined),
        }),
      }),
    } as never;

    const r = await upsertUserFromClaims(claims, db);
    expect(r).toEqual({
      id: returningRow.id,
      cognitoSub: claims.sub,
      email: claims.email,
    });
  });
});
