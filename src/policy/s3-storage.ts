import path from "path";
import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command, CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import type { PolicyStorageAdapter } from "./storage";

export interface S3StorageOptions {
  bucket: string;
  folder?: string;
  region?: string;
  endpoint?: string;
}

export class S3PolicyStorage implements PolicyStorageAdapter {
  private client: S3Client;
  private bucket: string;
  private folder: string;

  constructor({ bucket, folder = "", region, endpoint }: S3StorageOptions) {
    const isLocalStack = !!endpoint;
    this.client = new S3Client({
      region: region ?? process.env.AWS_REGION ?? "us-east-1",
      ...(endpoint && {
        endpoint,
        forcePathStyle: true,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "test",
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "test",
        },
      }),
    });
    this.bucket = bucket;
    this.folder = folder;
  }

  private key(filename: string): string {
    return this.folder ? `${this.folder}/${filename}` : filename;
  }

  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
  }

  async load(filename: string): Promise<string> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: this.key(filename) })
    );
    if (!res.Body) throw new Error(`Policy not found: ${filename}`);
    return res.Body.transformToString();
  }

  async save(filename: string, content: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.key(filename),
        Body: content,
        ContentType: "text/yaml",
      })
    );
  }

  async list(): Promise<string[]> {
    const res = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: this.folder ? `${this.folder}/` : "",
      })
    );
    return (res.Contents ?? [])
      .map((obj) => path.basename(obj.Key!))
      .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));
  }
}
