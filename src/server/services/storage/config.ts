/**
 * Storage configuration for the S3-compatible object storage abstraction.
 *
 * Env-driven, validated server-side. Never expose the secret access key to
 * clients — presigned URLs carry only a scoped signature.
 */

export interface StorageConfig {
  /** e.g. `http://localhost:9000` (MinIO) or `https://<acct>.r2.cloudflarestorage.com`. */
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** true → path-style `/bucket/key`; false → virtual-hosted `bucket.endpoint`. */
  forcePathStyle: boolean;
}

const REQUIRED_KEYS = [
  "S3_ENDPOINT",
  "S3_REGION",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
] as const;

/**
 * Reads and validates storage config from the environment.
 * Returns null when any required variable is missing (e.g. in tests / local
 * machines without object storage configured).
 */
export function loadStorageConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): StorageConfig | null {
  for (const key of REQUIRED_KEYS) {
    if (!env[key] || env[key]!.trim() === "") {
      return null;
    }
  }

  const forcePathStyle = (env.S3_FORCE_PATH_STYLE ?? "true").toLowerCase() !== "false";

  return {
    endpoint: env.S3_ENDPOINT!,
    region: env.S3_REGION!,
    bucket: env.S3_BUCKET!,
    accessKeyId: env.S3_ACCESS_KEY_ID!,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
    forcePathStyle,
  };
}

/**
 * Returns true when object storage is configured in the current environment.
 */
export function storageEnabled(): boolean {
  return loadStorageConfigFromEnv() !== null;
}

/**
 * Returns the storage config or null (development/tests fall back to memory).
 */
export function tryGetStorageConfig(): StorageConfig | null {
  return loadStorageConfigFromEnv();
}

/**
 * Returns the storage config or throws when missing.
 * Use in server contexts that require real object storage.
 */
export function getStorageConfig(): StorageConfig {
  const config = loadStorageConfigFromEnv();
  if (!config) {
    throw new Error(
      "S3-compatible storage is not configured. Set S3_ENDPOINT, S3_REGION, S3_BUCKET, " +
        "S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY (see .env.example).",
    );
  }
  return config;
}