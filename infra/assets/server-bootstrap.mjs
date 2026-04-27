// Cold-start wrapper for the OpenNext SSR Lambda. Runs ONCE per Lambda execution
// environment (during the INIT phase), fetches the Aurora admin password from
// Secrets Manager, builds a properly URL-encoded `DATABASE_URL` into
// `process.env`, then re-exports a wrapped OpenNext handler that translates
// ALB request/response payloads to/from the API Gateway v2 format that
// OpenNext's bundled converter expects.
//
// Why DATABASE_URL is built here:
//   - The Aurora master secret contains characters that aren't URL-safe
//     (`[`, `]`, `:`, `+`, `` ` ``, etc.). Stuffing it into a CFN-resolved
//     Lambda env var as a connection string produces invalid URLs and leaks
//     the password into CloudFormation events.
//   - The web app's `env.server.ts` schema requires a single `DATABASE_URL`
//     string. Modifying it to read host/user/pass separately would touch many
//     code paths across packages — keeping the contract here is cheaper.
//
// Why the ALB ↔ APIGWv2 adapter exists:
//   - Lambda Function URLs are blocked at the AWS account level in this
//     account (verified end-to-end). We deploy ALB → Lambda instead.
//   - OpenNext's default request converter (`aws-apigw-v2`) expects
//     `event.requestContext.http.method` etc. ALB sends `event.httpMethod`
//     directly with no `requestContext.http`. Without this adapter, OpenNext
//     throws `Cannot read properties of undefined (reading 'method')` and
//     ALB returns 502 to the client.
//   - On the response side, OpenNext returns `{ cookies: [...], headers, body }`
//     (APIGWv2 format). ALB ignores the `cookies` array — we fold it into
//     `multiValueHeaders["set-cookie"]` so cookies actually round-trip.

import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

import { handler as openNextHandler } from "./index.mjs";

const sm = new SecretsManagerClient({});

async function buildDatabaseUrl() {
  const secretArn = process.env.DB_SECRET_ARN;
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT ?? "5432";
  const dbName = process.env.DB_NAME;
  if (!secretArn || !host || !dbName) {
    throw new Error(
      `Missing required env: DB_SECRET_ARN=${Boolean(secretArn)} DB_HOST=${Boolean(host)} DB_NAME=${Boolean(dbName)}`,
    );
  }
  const { SecretString } = await sm.send(new GetSecretValueCommand({ SecretId: secretArn }));
  if (!SecretString) {
    throw new Error(`Secret ${secretArn} returned empty SecretString`);
  }
  const { username, password } = JSON.parse(SecretString);
  if (!username || !password) {
    throw new Error(`Secret ${secretArn} missing username/password fields`);
  }
  const enc = encodeURIComponent;
  process.env.DATABASE_URL = `postgresql://${enc(username)}:${enc(password)}@${host}:${port}/${dbName}?sslmode=require`;
}

await buildDatabaseUrl();

/**
 * Detect whether an inbound event is from ALB. ALB sets
 * `requestContext.elb.targetGroupArn`; APIGWv2 sets `requestContext.http`.
 * Anything else (direct invoke / health check) is passed straight through.
 */
function isAlbEvent(event) {
  return Boolean(event && event.requestContext && event.requestContext.elb);
}

/**
 * Translate an ALB event to APIGW v2 (HTTP API) format. Preserves enough
 * fields for OpenNext's converter to work; anything OpenNext doesn't read
 * (e.g. `requestContext.routeKey`) is omitted.
 */
function albEventToApiGwV2(event) {
  const headers = { ...(event.headers || {}) };
  // When the target group has `lambda.multi_value_headers.enabled=true`, ALB
  // sends duplicate-prone headers (notably `cookie`) as `multiValueHeaders`
  // arrays. Merge into the flat map OpenNext's API-GW converter expects.
  const mvhIn = event.multiValueHeaders;
  if (mvhIn) {
    for (const [key, vals] of Object.entries(mvhIn)) {
      if (!Array.isArray(vals) || vals.length === 0) continue;
      const kl = key.toLowerCase();
      if (kl === "cookie") {
        headers[kl] = vals.join("; ");
      } else if (vals.length === 1) {
        headers[kl] = vals[0];
      } else {
        headers[kl] = vals.join(", ");
      }
    }
  }

  // Next.js Server Actions compare `Origin` to `x-forwarded-host` (if set)
  // before `Host` (see `parseHostHeader` in `action-handler.js`). ALB can
  // populate `x-forwarded-host` with the internal ELB DNS while the browser
  // still sends `Origin: https://<distribution>.cloudfront.net` — that
  // mismatch throws `Invalid Server Actions request` (__NEXT_ERROR_CODE E80,
  // digest 1330110331). Strip ELB-style forwarded hosts so the viewer `Host`
  // (forwarded by CloudFront when using `ALL_VIEWER`) is used instead.
  const rawXfh = headers["x-forwarded-host"] ?? headers["X-Forwarded-Host"];
  if (typeof rawXfh === "string") {
    const first = rawXfh.split(",")[0]?.trim() ?? "";
    if (/\.elb\.amazonaws\.com(:\d+)?$/i.test(first)) {
      delete headers["x-forwarded-host"];
      delete headers["X-Forwarded-Host"];
    }
  }

  // ALB can still inject `x-forwarded-host` as its own DNS even when CloudFront
  // forwarded the viewer `Host` (see Lambda logs: digest 1330110331 / E80).
  // If `Host` is the public distribution hostname, force them to match so
  // Next.js Server Action CSRF sees the same host as `Origin`.
  const hostRaw = headers["host"] ?? headers["Host"];
  if (typeof hostRaw === "string") {
    const h = hostRaw.split(",")[0]?.trim() ?? "";
    if (h.endsWith(".cloudfront.net")) {
      headers["x-forwarded-host"] = h;
    }
  }

  // With `lambda.multi_value_headers.enabled=true`, ALB often omits or empties
  // `queryStringParameters` and puts every query key in
  // `multiValueQueryStringParameters` (arrays). If we only read the flat map,
  // OAuth callbacks lose `code` + `state` → `missing_code` and a broken sign-in.
  const queryStringParameters = { ...(event.queryStringParameters || {}) };
  const mvq = event.multiValueQueryStringParameters;
  if (mvq) {
    for (const [k, vals] of Object.entries(mvq)) {
      if (!Array.isArray(vals) || vals.length === 0) continue;
      queryStringParameters[k] = vals.length === 1 ? vals[0] : vals[vals.length - 1];
    }
  }
  const rawQueryString = Object.entries(queryStringParameters)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v ?? "")}`)
    .join("&");

  const cookieHeader = headers.cookie || headers.Cookie;
  const cookies = cookieHeader
    ? cookieHeader.split(";").map((c) => c.trim()).filter(Boolean)
    : [];

  return {
    version: "2.0",
    routeKey: "$default",
    rawPath: event.path || "/",
    rawQueryString,
    cookies,
    headers,
    queryStringParameters,
    requestContext: {
      accountId: "anonymous",
      apiId: "alb",
      domainName: headers.host || "alb.local",
      domainPrefix: "alb",
      http: {
        method: event.httpMethod || "GET",
        path: event.path || "/",
        protocol: "HTTP/1.1",
        sourceIp: headers["x-forwarded-for"]?.split(",")[0]?.trim() || "0.0.0.0",
        userAgent: headers["user-agent"] || "",
      },
      requestId: headers["x-amzn-trace-id"] || "alb-req",
      routeKey: "$default",
      stage: "$default",
      time: new Date().toUTCString(),
      timeEpoch: Date.now(),
    },
    body: event.body || "",
    isBase64Encoded: Boolean(event.isBase64Encoded),
    pathParameters: null,
    stageVariables: null,
  };
}

/**
 * Translate an APIGW v2-shaped response (what OpenNext returns) back to ALB.
 *
 * OpenNext's API-GW v2 converter strips `set-cookie` from `response.headers`
 * and puts full `Set-Cookie` lines in `response.cookies` (string[]).
 *
 * ALB + Lambda target behavior (see `lambda.multi_value_headers.enabled` on
 * the target group in `web-stack.ts`):
 *   - **false (default):** only `headers` is honored; `multiValueHeaders` on
 *     the Lambda response is ignored — so `Set-Cookie` never reaches the
 *     browser if we only populate `multiValueHeaders`.
 *   - **true:** responses should use `multiValueHeaders` with one string per
 *     header value (including `content-type`, `location`, and every
 *     `set-cookie`). Sending everything through `multiValueHeaders` avoids
 *     the "headers ignored" class of bugs described in AWS forums.
 */
function apiGwV2ResponseToAlb(response) {
  const flat = { ...(response.headers || {}) };
  const setCookies = [];
  if (Array.isArray(response.cookies) && response.cookies.length > 0) {
    setCookies.push(...response.cookies.map(String));
  }
  const scFlat = flat["set-cookie"] ?? flat["Set-Cookie"];
  delete flat["set-cookie"];
  delete flat["Set-Cookie"];
  if (scFlat != null) {
    if (Array.isArray(scFlat)) {
      setCookies.push(...scFlat.map(String));
    } else {
      setCookies.push(String(scFlat));
    }
  }

  const multiValueHeaders = {};
  for (const [k, v] of Object.entries(flat)) {
    if (v == null) continue;
    const key = k.toLowerCase();
    if (key === "set-cookie") continue;
    multiValueHeaders[key] = Array.isArray(v) ? v.map(String) : [String(v)];
  }
  if (setCookies.length > 0) {
    multiValueHeaders["set-cookie"] = setCookies;
  }

  return {
    statusCode: response.statusCode || 200,
    statusDescription: `${response.statusCode || 200} OK`,
    headers: {},
    multiValueHeaders,
    body: response.body || "",
    isBase64Encoded: Boolean(response.isBase64Encoded),
  };
}

export const handler = async (event, context) => {
  if (!isAlbEvent(event)) {
    return openNextHandler(event, context);
  }
  const apiGwEvent = albEventToApiGwV2(event);
  const apiGwResponse = await openNextHandler(apiGwEvent, context);
  return apiGwV2ResponseToAlb(apiGwResponse);
};
