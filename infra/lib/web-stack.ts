/**
 * Alongside web plane: Next.js SSR via OpenNext on container Lambda, fronted
 * by an internet-facing ALB, fronted by CloudFront. Static assets in S3.
 * Image optimization in a separate Lambda (also ALB-targeted).
 *
 * Why this exact shape:
 *   - **Amplify Hosting Compute** silently fails to provision SSR on this
 *     account in two regions, multiple service-role configurations.
 *   - **Lambda Function URLs** are blocked at the account level — verified
 *     end-to-end: even a vanilla function with `AuthType: NONE` and a
 *     `Principal: "*"` permission returns 403 from the gateway, never reaching
 *     Lambda execution. So the canonical OpenNext-on-CDK setup
 *     (CloudFront → FunctionURL via OAC) does not work here.
 *   - **ALB → Lambda integration** uses `lambda:InvokeFunction` (synchronous,
 *     not Function URL), bypassing the Function URL gateway block entirely.
 *     ALB lives in the same VPC so private subnets / security groups stay
 *     simple. CloudFront → ALB with a shared-secret custom header is the
 *     standard CloudFront-to-ALB origin protection pattern (the ALB
 *     equivalent of OAC, which doesn't exist for ALBs).
 *   - **App Runner / ECS Fargate** would also work but require ditching the
 *     Lambda we just built and its cold-start DB-secret wrapper. Re-evaluate
 *     if cold-start latency or per-request cost ever becomes a problem.
 *
 * Build prerequisite: run `pnpm --filter web exec open-next build` before
 * `cdk synth`/`deploy`. The constructor copies the cold-start wrapper +
 * Dockerfile into the OpenNext bundles and trims `.next/cache`.
 *
 * Note on streaming: we use OpenNext's default buffered wrapper because ALB →
 * Lambda integration does NOT support response streaming. The full HTML
 * response is buffered in Lambda memory before returning. Fine for ~99% of
 * pages; if you ever need true streaming for `loading.tsx`-heavy routes,
 * either get AWS Support to lift the Function URL block or move to Fargate.
 *
 * Post-deploy: run `infra/scripts/post-deploy-web.sh` to write the resolved
 * CloudFront URL into the SSR Lambda's `AUTH_BASE_URL` / `AUTH_SIGNOUT_URL`
 * env vars (we can't set them at synth time without a circular dep between
 * the distribution and the Lambda).
 */
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as elbv2Targets from "aws-cdk-lib/aws-elasticloadbalancingv2-targets";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import type { Construct } from "constructs";

const TAG_APP = "alongside";
const TAG_ENV = "dev";

/**
 * Shared secret CloudFront sends to the ALB in `X-Origin-Verify`. The ALB's
 * default listener action returns 403 unless this header matches. Generated
 * once per stack, baked into both CloudFront origins and the ALB listener
 * rule. Rotate by destroying + redeploying the stack (or do a rolling change
 * via `cdk deploy --hotswap` and a new value).
 *
 * 32 random bytes hex-encoded = 64-char secret, enough entropy that brute-
 * forcing it from the public internet is not a real threat.
 */
const ORIGIN_VERIFY_HEADER = "x-origin-verify";

export interface WebStackProps extends cdk.StackProps {
  /** VPC ID from `HypercareData-dev` output `VpcId`. */
  readonly vpcId: string;
  /** Aurora master secret ARN from `HypercareData-dev` output `SecretArn`. */
  readonly dbSecretArn: string;
  /** Aurora cluster writer endpoint from `HypercareData-dev` output `ClusterEndpoint`. */
  readonly dbHost: string;
  /** Aurora port (5432). */
  readonly dbPort: number;
  /** Database name (`hypercare_dev` or `hypercare_prod`). */
  readonly dbName: string;
  /** Cognito user-pool config (from `apps/web/.env.local`). */
  readonly cognito: {
    readonly userPoolId: string;
    readonly appClientId: string;
    readonly appClientSecret: string;
    readonly domain: string;
    readonly region: string;
  };
  /** HMAC for the session cookie (from `apps/web/.env.local`, ≥32B). */
  readonly sessionCookieSecret: string;
  /** Absolute path to `apps/web` (so we can find `.open-next/`). */
  readonly webRoot: string;
}

export class WebStack extends cdk.Stack {
  public constructor(scope: Construct, id: string, props: WebStackProps) {
    super(scope, id, props);

    cdk.Tags.of(this).add("app", TAG_APP);
    cdk.Tags.of(this).add("env", TAG_ENV);

    const openNextDir = path.join(props.webRoot, ".open-next");
    if (!fs.existsSync(openNextDir)) {
      throw new Error(
        `Missing OpenNext build output at ${openNextDir}. Run \`pnpm --filter web exec open-next build\` from the repo root before \`cdk synth\`.`,
      );
    }

    // Inject our cold-start wrapper + Dockerfile into the SSR bundle, and
    // defensively strip .next/cache (OpenNext doesn't always remove it;
    // ~400MB of webpack cache).
    //
    // We deploy as a container Lambda (not zip) because Next.js standalone
    // with pnpm produces a symlink farm that does not survive zip extraction
    // inside Lambda — Node fails to resolve peer deps like `styled-jsx`
    // through the symlink chain. Container images preserve symlinks.
    const serverBundleDir = path.join(openNextDir, "server-functions", "default");
    const wrapperSrc = path.join(__dirname, "..", "assets", "server-bootstrap.mjs");
    fs.copyFileSync(wrapperSrc, path.join(serverBundleDir, "bootstrap.mjs"));
    fs.copyFileSync(
      path.join(__dirname, "..", "assets", "Dockerfile.server"),
      path.join(serverBundleDir, "Dockerfile"),
    );
    const cacheDir = path.join(serverBundleDir, "apps", "web", ".next", "cache");
    if (fs.existsSync(cacheDir)) {
      fs.rmSync(cacheDir, { recursive: true, force: true });
    }

    const imageBundleDir = path.join(openNextDir, "image-optimization-function");
    fs.copyFileSync(
      path.join(__dirname, "..", "assets", "Dockerfile.image"),
      path.join(imageBundleDir, "Dockerfile"),
    );

    const vpc = ec2.Vpc.fromLookup(this, "Vpc", { vpcId: props.vpcId });
    const dbSecret = secretsmanager.Secret.fromSecretCompleteArn(
      this,
      "DbSecret",
      props.dbSecretArn,
    );

    // Deterministic per-stack secret. cdk.Token can't be used in a custom
    // header value at synth time (CFN string), so we generate at synth time
    // and store as a CFN parameter default → the same value persists across
    // diffs unless explicitly rotated.
    const originVerifyValue = crypto.randomBytes(32).toString("hex");

    // ---- S3 assets bucket ----
    const assetsBucket = new s3.Bucket(this, "Assets", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    }) as s3.IBucket;

    new s3deploy.BucketDeployment(this, "AssetsDeploy", {
      sources: [s3deploy.Source.asset(path.join(openNextDir, "assets"))],
      destinationBucket: assetsBucket,
      destinationKeyPrefix: "_assets",
      prune: true,
      cacheControl: [
        s3deploy.CacheControl.maxAge(cdk.Duration.days(365)),
        s3deploy.CacheControl.immutable(),
      ],
    });

    // ---- SSR Lambda (container image) ----
    const serverFn = new lambda.DockerImageFunction(this, "ServerFn", {
      architecture: lambda.Architecture.ARM_64,
      memorySize: 1024,
      // ALB times out target responses at 60s by default (configurable); keep
      // Lambda at 30s so misbehaving requests fail fast. Bump if any SSR
      // route legitimately takes longer.
      timeout: cdk.Duration.seconds(30),
      vpc,
      // PRIVATE_WITH_EGRESS: gets a private IP inside vpc-0f2dad90b0f678105 so
      // the Aurora SG's "allow VPC CIDR on 5432" rule lets it through, and
      // routes outbound through the NAT GW for Cognito + Secrets Manager.
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      code: lambda.DockerImageCode.fromImageAsset(serverBundleDir, {
        platform: cdk.aws_ecr_assets.Platform.LINUX_ARM64,
      }),
      logRetention: logs.RetentionDays.ONE_WEEK,
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        // --- Cognito ---
        COGNITO_USER_POOL_ID: props.cognito.userPoolId,
        COGNITO_APP_CLIENT_ID: props.cognito.appClientId,
        COGNITO_APP_CLIENT_SECRET: props.cognito.appClientSecret,
        COGNITO_DOMAIN: props.cognito.domain,
        COGNITO_REGION: props.cognito.region,
        // --- Auth URLs (overwritten post-deploy by post-deploy-web.sh) ---
        AUTH_BASE_URL: "https://placeholder.invalid",
        AUTH_SIGNOUT_URL: "https://placeholder.invalid",
        // --- Session ---
        SESSION_COOKIE_SECRET: props.sessionCookieSecret,
        // --- Database (DATABASE_URL is built at cold-start by bootstrap.mjs) ---
        DB_SECRET_ARN: dbSecret.secretArn,
        DB_HOST: props.dbHost,
        DB_PORT: String(props.dbPort),
        DB_NAME: props.dbName,
        // --- Misc ---
        NODE_ENV: "production",
        NEXT_TELEMETRY_DISABLED: "1",
      },
    });
    dbSecret.grantRead(serverFn);

    // ---- Image optimization Lambda (container image) ----
    const imageFn = new lambda.DockerImageFunction(this, "ImageFn", {
      architecture: lambda.Architecture.ARM_64,
      memorySize: 1536,
      timeout: cdk.Duration.seconds(25),
      code: lambda.DockerImageCode.fromImageAsset(imageBundleDir, {
        platform: cdk.aws_ecr_assets.Platform.LINUX_ARM64,
      }),
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: {
        BUCKET_NAME: assetsBucket.bucketName,
        BUCKET_KEY_PREFIX: "_assets",
      },
    });
    assetsBucket.grantRead(imageFn);

    // ---- ALB (internet-facing, public subnets in 2 AZs) ----
    const albSg = new ec2.SecurityGroup(this, "AlbSg", {
      vpc,
      description: "Allow inbound from CloudFront over HTTPS/HTTP",
      allowAllOutbound: true,
    });
    // CloudFront uses an enormous, unstable list of egress IPs — easiest
    // to allow 0.0.0.0/0 on the listener port and rely on the X-Origin-Verify
    // header for actual access control. Port 80 only; CloudFront → origin
    // can be HTTP since CloudFront terminates TLS at the edge for users.
    // (HTTPS origin would require an ACM cert + a Route53 domain on the ALB,
    // which we don't have yet for *.cloudfront.net. Add when we attach a
    // custom domain to CloudFront.)
    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "CloudFront to ALB HTTP");

    const alb = new elbv2.ApplicationLoadBalancer(this, "Alb", {
      vpc,
      internetFacing: true,
      securityGroup: albSg,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      idleTimeout: cdk.Duration.seconds(60),
    });

    // Lambda targets — ALB invokes via `lambda:InvokeFunction` (NOT Function
    // URL), which is unaffected by the account-level Function URL block.
    const serverTarget = new elbv2Targets.LambdaTarget(serverFn);
    const imageTarget = new elbv2Targets.LambdaTarget(imageFn);

    const serverTg = new elbv2.ApplicationTargetGroup(this, "ServerTg", {
      targets: [serverTarget],
      targetType: elbv2.TargetType.LAMBDA,
      // Required for OpenNext: it returns `Set-Cookie` in the API Gateway v2
      // `cookies` array (not in `headers`). Our bootstrap maps those into
      // `multiValueHeaders["set-cookie"]`. With the default
      // `lambda.multi_value_headers.enabled=false`, ALB **drops** response
      // `multiValueHeaders` entirely — browsers never see PKCE/session cookies
      // → `invalid_state` after Cognito login.
      multiValueHeadersEnabled: true,
      // ALB's Lambda health check is a synchronous invoke with a special
      // payload; OpenNext's handler returns 200 for `/` so health checks pass.
      healthCheck: {
        enabled: true,
        path: "/",
        interval: cdk.Duration.seconds(60),
        timeout: cdk.Duration.seconds(15),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
        // Accept any 2xx/3xx as healthy; the home page may redirect to /onboarding.
        healthyHttpCodes: "200-399",
      },
    });

    const imageTg = new elbv2.ApplicationTargetGroup(this, "ImageTg", {
      targets: [imageTarget],
      targetType: elbv2.TargetType.LAMBDA,
      multiValueHeadersEnabled: true,
      healthCheck: { enabled: false }, // image opt has no health endpoint
    });

    // HTTP listener on :80. Default action is "deny unless verified".
    const listener = alb.addListener("HttpListener", {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      open: false, // we set ingress explicitly via albSg above
      defaultAction: elbv2.ListenerAction.fixedResponse(403, {
        contentType: "text/plain",
        messageBody: "Forbidden — direct ALB access not allowed.",
      }),
    });

    // Listener rules: forward to Lambda only when the X-Origin-Verify header
    // matches the per-stack secret. CloudFront sets this header on every
    // origin request. Without it, the ALB returns 403 (the default action).
    listener.addAction("ImageRoute", {
      priority: 10,
      conditions: [
        elbv2.ListenerCondition.httpHeader(ORIGIN_VERIFY_HEADER, [originVerifyValue]),
        elbv2.ListenerCondition.pathPatterns(["/_next/image*"]),
      ],
      action: elbv2.ListenerAction.forward([imageTg]),
    });

    listener.addAction("ServerRoute", {
      priority: 20,
      conditions: [
        elbv2.ListenerCondition.httpHeader(ORIGIN_VERIFY_HEADER, [originVerifyValue]),
      ],
      action: elbv2.ListenerAction.forward([serverTg]),
    });

    // ---- CloudFront distribution ----
    const albOrigin = new origins.LoadBalancerV2Origin(alb, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
      httpPort: 80,
      // Inject the shared secret on every origin request so the ALB lets us
      // through. CloudFront keeps custom origin headers private from viewers.
      customHeaders: {
        "X-Origin-Verify": originVerifyValue,
      },
      // Reasonable defaults for a Next.js app behind ALB:
      readTimeout: cdk.Duration.seconds(30),
      keepaliveTimeout: cdk.Duration.seconds(5),
    });

    const s3Origin = origins.S3BucketOrigin.withOriginAccessControl(assetsBucket, {
      originPath: "/_assets",
    });

    // Forward the viewer **Host** to the ALB origin (managed policy
    // `ALL_VIEWER`). If we used `ALL_VIEWER_EXCEPT_HOST_HEADER`, CloudFront
    // would rewrite `Host` to the ALB DNS; ALB/Lambda then sees
    // `x-forwarded-host` as the internal hostname while the browser still
    // sends `Origin: https://<distribution>.cloudfront.net` on Server Action
    // POSTs — Next.js rejects that mismatch ("Invalid Server Actions request",
    // digest 1330110331). Keeping the viewer hostname preserves the public URL
    // the app was loaded from.
    const serverOriginRequestPolicy = cloudfront.OriginRequestPolicy.ALL_VIEWER;

    const distribution = new cloudfront.Distribution(this, "Cdn", {
      comment: "Alongside web (Next.js SSR via OpenNext on ALB+Lambda)",
      defaultBehavior: {
        origin: albOrigin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: serverOriginRequestPolicy,
        compress: true,
      },
      additionalBehaviors: {
        // /_next/image* → ALB → image optimization Lambda
        "_next/image*": {
          origin: albOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          originRequestPolicy: serverOriginRequestPolicy,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          compress: true,
        },
        // /_next/data/* → ALB → SSR Lambda (page data for client-side nav)
        "_next/data/*": {
          origin: albOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: serverOriginRequestPolicy,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          compress: true,
        },
        // /_next/* → S3 (chunks, css, fonts, all content-hashed)
        "_next/*": {
          origin: s3Origin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          compress: true,
        },
        BUILD_ID: {
          origin: s3Origin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        },
        "favicon.ico": {
          origin: s3Origin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
        "*.svg": {
          origin: s3Origin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    new cdk.CfnOutput(this, "CloudFrontUrl", {
      value: `https://${distribution.distributionDomainName}`,
      description: "Public app URL (use this in Cognito callback + sign-out)",
    });
    new cdk.CfnOutput(this, "CloudFrontDistributionId", {
      value: distribution.distributionId,
    });
    new cdk.CfnOutput(this, "AlbDnsName", {
      value: alb.loadBalancerDnsName,
      description: "ALB DNS (origin for CloudFront; not directly invokable without X-Origin-Verify header)",
    });
    new cdk.CfnOutput(this, "ServerFunctionName", {
      value: serverFn.functionName,
      description: "Used by post-deploy script to set AUTH_BASE_URL/AUTH_SIGNOUT_URL",
    });
    new cdk.CfnOutput(this, "ImageFunctionName", { value: imageFn.functionName });
    new cdk.CfnOutput(this, "AssetsBucketName", { value: assetsBucket.bucketName });
  }
}
