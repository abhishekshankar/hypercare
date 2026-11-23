import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { serverEnv } from "@/lib/env.server";

const SECONDS_1H = 3600;

function s3Client(): S3Client {
  const g = globalThis as unknown as { _hcS3?: S3Client };
  if (g._hcS3) {
    return g._hcS3;
  }
  const c = new S3Client({ region: serverEnv.AWS_REGION ?? "ca-central-1" });
  g._hcS3 = c;
  return c;
}

export async function uploadExportZip(
  key: string,
  body: Uint8Array,
): Promise<void> {
  const bucket = serverEnv.PRIVACY_EXPORT_S3_BUCKET;
  if (bucket == null) {
    throw new Error("privacy_export_s3_unconfigured");
  }
  const client = s3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: Buffer.from(body),
      ContentType: "application/zip",
    }),
  );
}

export async function presignExportDownload(key: string): Promise<string> {
  const bucket = serverEnv.PRIVACY_EXPORT_S3_BUCKET;
  if (bucket == null) {
    throw new Error("privacy_export_s3_unconfigured");
  }
  const client = s3Client();
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: SECONDS_1H },
  );
}
