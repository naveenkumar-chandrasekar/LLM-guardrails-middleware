import { parse as parseYaml } from "yaml";
import type { Policy } from "./types";
import { S3PolicyStorage, type S3StorageOptions } from "./s3-storage";

const DEFAULT_TTL_MS = 60_000; // 60 seconds

interface CacheEntry {
  policy: Policy;
  raw: string;
  cachedAt: number;
}

const cache = new Map<string, CacheEntry>();
let ttlMs = DEFAULT_TTL_MS;

export function setPolicyTTL(ms: number): void {
  ttlMs = ms;
}

function cacheKey(filename: string, s3: S3StorageOptions): string {
  return `${s3.bucket}/${s3.folder ?? ""}/${filename}`;
}

function isExpired(entry: CacheEntry): boolean {
  return Date.now() - entry.cachedAt > ttlMs;
}

function getStorage(s3: S3StorageOptions): S3PolicyStorage {
  return new S3PolicyStorage(s3);
}

export async function loadPolicy(filename = "default.yaml", s3: S3StorageOptions): Promise<Policy> {
  const key = cacheKey(filename, s3);
  const cached = cache.get(key);

  if (cached && !isExpired(cached)) return cached.policy;

  const raw = await getStorage(s3).load(filename);
  const policy = parseYaml(raw) as Policy;
  cache.set(key, { policy, raw, cachedAt: Date.now() });
  return policy;
}

export async function savePolicy(content: string, filename = "default.yaml", s3: S3StorageOptions): Promise<void> {
  parseYaml(content);
  await getStorage(s3).save(filename, content);
  // invalidate cache so next request picks up the new version immediately
  cache.delete(cacheKey(filename, s3));
}

export async function getPolicyRaw(filename = "default.yaml", s3: S3StorageOptions): Promise<string> {
  const key = cacheKey(filename, s3);
  const cached = cache.get(key);
  if (cached && !isExpired(cached)) return cached.raw;

  const raw = await getStorage(s3).load(filename);
  const policy = parseYaml(raw) as Policy;
  cache.set(key, { policy, raw, cachedAt: Date.now() });
  return raw;
}

export async function listPolicies(s3: S3StorageOptions): Promise<string[]> {
  return getStorage(s3).list();
}

export function clearPolicyCache(): void {
  cache.clear();
}

export type { PolicyStorageAdapter } from "./storage";
