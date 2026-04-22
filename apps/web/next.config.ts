import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Amplify Hosting (WEB_COMPUTE) bundles the SSR function from `next-server.js.nft.json`,
  // which references deps at `../../../node_modules/.pnpm/...` (repo root). Without standalone
  // those deps live outside the `.next/` artifact and Amplify can't find them — deploy succeeds
  // but no compute is created and CloudFront returns 500. With `output: 'standalone'` Next.js
  // bundles every traced dep into `.next/standalone/`, so the artifact is self-contained.
  //
  // `outputFileTracingRoot` at the repo root is required so workspace packages in `packages/*`
  // get traced. The standalone entry lands at `.next/standalone/apps/web/server.js`; we
  // restructure to `.next/standalone/server.js` in `amplify.yml` postBuild because Amplify's
  // SSR provider expects the entry at the standalone root.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
};

export default nextConfig;
