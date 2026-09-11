/**
 * Storage client abstraction for S3-compatible object storage.
 *
 * `S3StorageClient` implements the interface with fetch + hand-rolled SigV4
 * (works with AWS S3, Cloudflare R2, MinIO). `memoryStorageClient()` provides
 * an in-memory fake for tests and local development — the dependency-injection
 * point for the media service.
 */

import { tryGetStorageConfig, type StorageConfig } from "./config";
import {
  buildObjectTarget,
  presignGetRequest,
  presignPutRequest,
  signDirectRequest,
  DEFAULT_PRESIGN_TTL_SECONDS,
} from "./signature";

// ── Interface ─────────────────────────────────────────────────────────────────

export interface PutObjectOptions {
  contentType?: string;
}

export interface ObjectHead {
  size: number;
  contentType?: string | null;
}

export interface StorageClient {
  /** Presigned PUT URL (short TTL, scoped to the exact key). */
  presignPut(options: {
    key: string;
    contentType?: string;
    sizeBytes?: number;
    expiresInSeconds?: number;
  }): string;

  /** Presigned GET URL (short TTL, scoped to the exact key). */
  presignGet(options: {
    key: string;
    expiresInSeconds?: number;
    responseContentDisposition?: string;
    responseContentType?: string;
  }): string;

  /** Server-side object write (used by the worker for generated variants). */
  putObject(key: string, body: Buffer, options?: PutObjectOptions): Promise<{ size: number }>;

  /** Server-side object read (returns the full object as a Buffer). */
  getObject(key: string): Promise<Buffer>;

  /** Server-side object metadata check. */
  headObject(key: string): Promise<ObjectHead>;

  /** Server-side object deletion. */
  deleteObject(key: string): Promise<void>;
}

// ── S3-compatible client (fetch + SigV4) ──────────────────────────────────────

export class S3StorageClient implements StorageClient {
  constructor(private readonly config: StorageConfig) {}

  presignPut(options: {
    key: string;
    contentType?: string;
    sizeBytes?: number;
    expiresInSeconds?: number;
  }): string {
    return presignPutRequest({
      config: this.config,
      key: options.key,
      contentType: options.contentType,
      sizeBytes: options.sizeBytes,
      expiresInSeconds: options.expiresInSeconds ?? DEFAULT_PRESIGN_TTL_SECONDS,
    });
  }

  presignGet(options: {
    key: string;
    expiresInSeconds?: number;
    responseContentDisposition?: string;
    responseContentType?: string;
  }): string {
    return presignGetRequest({
      config: this.config,
      key: options.key,
      expiresInSeconds: options.expiresInSeconds ?? DEFAULT_PRESIGN_TTL_SECONDS,
      responseContentDisposition: options.responseContentDisposition,
      responseContentType: options.responseContentType,
    });
  }

  async putObject(
    key: string,
    body: Buffer,
    options: PutObjectOptions = {},
  ): Promise<{ size: number }> {
    const { headers } = signDirectRequest({
      config: this.config,
      method: "PUT",
      key,
      body,
      extraHeaders: options.contentType ? { "content-type": options.contentType } : {},
    });

    const response = await fetch(this.urlForKey(key), {
      method: "PUT",
      headers,
      body: new Uint8Array(body),
    });

    if (!response.ok) {
      throw new Error(
        `S3 PUT failed for ${key}: ${response.status} ${await safeResponseText(response)}`,
      );
    }
    return { size: body.length };
  }

  async getObject(key: string): Promise<Buffer> {
    const { headers } = signDirectRequest({
      config: this.config,
      method: "GET",
      key,
    });

    const response = await fetch(this.urlForKey(key), { method: "GET", headers });
    if (!response.ok) {
      throw new Error(
        `S3 GET failed for ${key}: ${response.status} ${await safeResponseText(response)}`,
      );
    }
    return Buffer.from(await response.arrayBuffer());
  }

  async headObject(key: string): Promise<ObjectHead> {
    const { headers } = signDirectRequest({
      config: this.config,
      method: "HEAD",
      key,
    });

    const response = await fetch(this.urlForKey(key), { method: "HEAD", headers });
    if (!response.ok) {
      throw new Error(
        `S3 HEAD failed for ${key}: ${response.status} ${await safeResponseText(response)}`,
      );
    }

    const sizeRaw = response.headers.get("content-length");
    return {
      size: sizeRaw ? Number(sizeRaw) : 0,
      contentType: response.headers.get("content-type"),
    };
  }

  async deleteObject(key: string): Promise<void> {
    const { headers } = signDirectRequest({
      config: this.config,
      method: "DELETE",
      key,
    });

    const response = await fetch(this.urlForKey(key), { method: "DELETE", headers });
    if (!response.ok) {
      throw new Error(
        `S3 DELETE failed for ${key}: ${response.status} ${await safeResponseText(response)}`,
      );
    }
  }

  private urlForKey(key: string): string {
    const { base, path } = buildObjectTarget(this.config, key);
    return `${base}${path}`;
  }
}

async function safeResponseText(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, 300);
  } catch {
    return "";
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Returns the configured S3 client, or an in-memory fake when storage is not
 * configured (local development / tests).
 */
export function createStorageClient(): StorageClient {
  const config = tryGetStorageConfig();
  if (!config) {
    return memoryStorageClient();
  }
  return new S3StorageClient(config);
}

// ── In-memory fake (tests / DI injection point) ───────────────────────────────

const MEMORY_URL_PREFIX = "memory://";

/**
 * Builds an in-memory StorageClient. Useful for tests and offline development;
 * presigned URLs are opaque `memory://` references.
 */
export function memoryStorageClient(): StorageClient {
  const objects = new Map<string, Buffer>();

  return {
    presignPut(options) {
      return `${MEMORY_URL_PREFIX}${options.key}`;
    },
    presignGet(options) {
      return `${MEMORY_URL_PREFIX}${options.key}`;
    },
    async putObject(key, body) {
      objects.set(key, body);
      return { size: body.length };
    },
    async getObject(key) {
      const body = objects.get(key);
      if (!body) {
        throw new Error(`Object not found in memory storage: ${key}`);
      }
      return body;
    },
    async headObject(key) {
      const body = objects.get(key);
      if (!body) {
        throw new Error(`Object not found in memory storage: ${key}`);
      }
      return { size: body.length, contentType: null };
    },
    async deleteObject(key) {
      objects.delete(key);
    },
  };
}