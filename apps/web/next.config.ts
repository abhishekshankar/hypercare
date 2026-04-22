import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Amplify Hosting (WEB_COMPUTE) bundles the SSR function from `.next/server` + the
  // `next-server.js.nft.json` trace file. Monorepo packages live outside `apps/web`, so tracing
  // must include the repo root.
  //
  // We previously set `output: 'standalone'`, but with `outputFileTracingRoot` pointing at the
  // repo root the standalone entry lands at `.next/standalone/apps/web/server.js`. Amplify's
  // SSR provider expects `standalone/server.js` at the artifact root and silently fails to
  // provision compute when it isn't there — build/deploy succeed but every URL returns 500
  // from CloudFront with no `server:` header. Letting Amplify handle the bundling itself is the
  // canonical monorepo Next.js SSR pattern in AWS docs.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
};

export default nextConfig;
