import type { S3StorageOptions } from "./policy/s3-storage";

export function getS3Config(): S3StorageOptions {
  const bucket = process.env.GUARDRAILS_S3_BUCKET;
  if (!bucket) throw new Error("GUARDRAILS_S3_BUCKET environment variable is required");
  return {
    bucket,
    folder: process.env.GUARDRAILS_S3_FOLDER,
    region: process.env.GUARDRAILS_S3_REGION,
    endpoint: process.env.GUARDRAILS_S3_ENDPOINT,
  };
}
