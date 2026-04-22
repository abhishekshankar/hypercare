import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Amplify Hosting compute (WEB_COMPUTE) bundles the server from traced output; monorepo
  // packages live outside `apps/web`, so tracing must include the repo root.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
};

export default nextConfig;
