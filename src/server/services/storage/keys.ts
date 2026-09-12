/**
 * Object-key construction and namespace enforcement.
 *
 * Keys are always server-side generated as
 * `{organizationId}/{weddingId}/{objectPublicId}.{ext}` — never derived from
 * user input. The per-object segment is the OPAQUE public id (not the internal
 * UUID), so presigned URLs that guests receive never reveal internal ids.
 * Variants append the variant type so all renditions stay in the same tenant
 * namespace (defense-in-depth for signed-URL scoping).
 */

import { MediaValidationError } from "@/lib/auth/errors";
import { sanitizeExt } from "./mime";

export interface ObjectKeyInput {
  organizationId: string;
  weddingId: string;
  /** Opaque public object id (media.public_id), never an internal UUID. */
  objectId: string;
  ext: string;
}

export interface VariantObjectKeyInput extends ObjectKeyInput {
  variantType: string;
}

/** Builds the canonical object key for an original upload. */
export function buildObjectKey(input: ObjectKeyInput): string {
  const ext = normalizeExt(input.ext);
  return `${input.organizationId}/${input.weddingId}/${input.objectId}${ext}`;
}

/** Builds the canonical object key for a derived variant (thumbnail/preview/full). */
export function buildVariantObjectKey(input: VariantObjectKeyInput): string {
  const ext = normalizeExt(input.ext);
  return `${input.organizationId}/${input.weddingId}/${input.objectId}.${input.variantType}${ext}`;
}

/**
 * Normalizes a MIME/allowed extension into a leading-dot extension
 * (e.g. `image/jpeg` or `jpg` → `.jpg`).
 */
export function normalizeExt(extOrMime: string): string {
  const trimmed = sanitizeExt(extOrMime);
  return trimmed.startsWith(".") ? trimmed : `.${trimmed}`;
}

/**
 * Defense-in-depth: every storage key used in a presigned URL or worker
 * operation must live under the tenant's namespace.
 */
export function assertKeyInNamespace(key: string, organizationId: string): void {
  const prefix = `${organizationId}/`;
  if (!key.startsWith(prefix)) {
    throw new MediaValidationError(
      `Storage key is outside the tenant namespace: ${key}`,
    );
  }
}