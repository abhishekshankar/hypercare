import "server-only";
import type { ResourcesConfig } from "aws-amplify";

import { baseUrl, serverEnv } from "../env.server";

const oauthDomain = new URL(serverEnv.COGNITO_DOMAIN).host;

// Must stay in sync with the Cognito app client's `AllowedOAuthScopes`.
// Adding a scope the user pool client doesn't allow makes Cognito reject the
// /oauth2/authorize request with `error=invalid_request&error_description=invalid_scope`,
// which surfaces in our app as `?reason=missing_code` on the error page (Cognito
// redirects back with no `code`, only the `error_*` params).
// `phone` was previously requested but the shared Cognito client only permits
// openid/email/profile, and no code path reads the `phone_number` claim.
const scopes: ("openid" | "email" | "profile")[] = [
  "openid",
  "email",
  "profile",
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

export const OAUTH_SCOPES_STRING = "openid email profile";

export function getRegionForDocs(): string {
  return serverEnv.COGNITO_REGION;
}
