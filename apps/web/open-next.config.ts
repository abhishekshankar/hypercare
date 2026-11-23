// OpenNext build config for Alongside web (deployed to Lambda + ALB + CloudFront
// via `infra/lib/web-stack.ts`).
//
// - `default` server function: a single Lambda that handles all SSR routes.
//   Default wrapper (`aws-lambda`, buffered) — ALB → Lambda integration does
//   NOT support response streaming, and Lambda Function URLs are blocked at
//   the account level in this AWS account, so streaming is not an option.
//   The full HTML response is buffered in Lambda memory and returned as one
//   payload, which is fine for ~99% of pages (Alongside doesn't lean heavily
//   on `loading.tsx` streaming).
// - `imageOptimization`: separate Lambda using `sharp` (kept out of the main
//   bundle to keep the SSR Lambda small + cold start fast).
// - `dangerous.disableTagCache` + `disableIncrementalCache`: Alongside doesn't
//   use ISR / on-demand revalidation. Skipping the DynamoDB tag-cache table
//   removes a moving part and one IAM grant we'd otherwise need.

import type { OpenNextConfig } from "@opennextjs/aws/types/open-next";

const config: OpenNextConfig = {
  // Empty `default: {}` is required by OpenNext's schema; with no `override.wrapper`
  // it uses the built-in `aws-lambda` (buffered) wrapper.
  default: {},
  dangerous: {
    disableTagCache: true,
    disableIncrementalCache: true,
  },
};

export default config;
