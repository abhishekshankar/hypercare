/**
 * Set before any app modules load so `env.server` validation passes in Vitest.
 * Values are inert test doubles — never use for real auth.
 */
const testEnv = {
  COGNITO_USER_POOL_ID: "ca-central-1_testPoolId",
  COGNITO_APP_CLIENT_ID: "testclientidtestclientidtest1",
  COGNITO_APP_CLIENT_SECRET: "test-secret-at-least-32-bytes-xxxxxxxx",
  COGNITO_DOMAIN: "https://example.auth.ca-central-1.amazoncognito.com",
  COGNITO_REGION: "ca-central-1",
  AUTH_BASE_URL: "http://localhost:3000",
  AUTH_SIGNOUT_URL: "http://localhost:3000",
  SESSION_COOKIE_SECRET: "0123456789abcdef0123456789abcdef",
  DATABASE_URL: "postgres://u:p@127.0.0.1:5432/t",
  NODE_ENV: "test" as const,
};

Object.assign(process.env, testEnv);
