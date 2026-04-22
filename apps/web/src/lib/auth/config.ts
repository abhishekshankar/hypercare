import "server-only";
import type { ResourcesConfig } from "aws-amplify";

import { baseUrl, serverEnv } from "../env.server";

const oauthDomain = new URL(serverEnv.COGNITO_DOMAIN).host;

const scopes: ("openid" | "email" | "profile" | "phone")[] = [
  "openid",
  "email",
  "profile",
  "phone",
];

/**
 * Amplify v6–shaped config for the shared Cognito pool. Server OAuth uses raw HTTP to `/oauth2/token` this remains the single source of truth for client-side Amplify if added later.
 */
export const AMPLIFY_AUTH_CONFIG: ResourcesConfig = {
  Auth: {
    Cognito: {
      userPoolId: serverEnv.COGNITO_USER_POOL_ID,
      userPoolClientId: serverEnv.COGNITO_APP_CLIENT_ID,
      loginWith: {
        oauth: {
          domain: oauthDomain,
          scopes,
          redirectSignIn: [`${baseUrl()}/api/auth/callback`],
          redirectSignOut: [serverEnv.AUTH_SIGNOUT_URL],
          responseType: "code",
        },
      },
    },
  },
};

export const OAUTH_SCOPES_STRING = "openid email profile phone";

export function getRegionForDocs(): string {
  return serverEnv.COGNITO_REGION;
}
