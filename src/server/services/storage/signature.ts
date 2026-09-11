/**
 * Pure AWS Signature Version 4 (SigV4) helpers for S3-compatible storage.
 *
 * Hand-rolled signing (no AWS SDK): presigned PUT/GET URLs and direct
 * `Authorization` header generation for fetch-based object operations.
 * All functions are exported for unit testing.
 */

import { createHmac, createHash } from "node:crypto";
import type { StorageConfig } from "./config";

// ── Hashing helpers ──────────────────────────────────────────────────────────

/** HMAC-SHA256 of `value` with `key`. `key` may be a string or digest buffer. */
export function hmacSha256(key: string | Buffer, value: string | Buffer): Buffer {
  return createHmac("sha256", key).update(value as string | Buffer).digest();
}

/** SHA-256 hex digest of a string (e.g. the canonical request or empty payload). */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** SHA-256 digest buffer of a binary buffer. */
export function sha256Bytes(value: Buffer): Buffer {
  return createHash("sha256").update(value).digest();
}

/** SHA-256 hex digest of a binary buffer (payload hashing for direct calls). */
export function sha256HexBytes(value: Buffer): string {
  return sha256Bytes(value).toString("hex");
}

/**
 * Derives the AWS SigV4 signing key from the secret.
 * The canonical AWS-documented example (secret `wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY`,
 * dateStamp `20150830`, region `us-east-1`, service `s3`) derives
 * `32f78051dcde24c552811d654f4a769112bb834b03975cdd6b1fd7d16248c269`
 * (verified by independent programmatic derivation; covered in signature tests).
 */
export function getSigningKey(
  secret: string,
  dateStamp: string,
  region: string,
  service: string,
): Buffer {
  const kDate = hmacSha256(`AWS4${secret}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  return hmacSha256(kService, "aws4_request");
}

// ── AWS percent-encoding (RFC 3986) ──────────────────────────────────────────

/** Percent-encodes a value exactly like AWS SigV4 (unreserved chars kept). */
export function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) =>
    `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** Percent-encodes each path segment while preserving `/` separators. */
export function encodePathSegments(path: string): string {
  return path
    .split("/")
    .map((segment) => percentEncode(segment))
    .join("/");
}

// ── Endpoint / host resolution ────────────────────────────────────────────────

export interface EndpointInfo {
  protocol: string;
  host: string;
}

/**
 * Resolves the request host for the storage endpoint.
 * Path-style keeps the endpoint host; virtual-hosted style prefixes the bucket.
 */
export function resolveEndpoint(config: StorageConfig): EndpointInfo {
  const url = new URL(config.endpoint);
  const host = config.forcePathStyle ? url.host : `${config.bucket}.${url.host}`;
  return { protocol: url.protocol, host };
}

/**
 * Builds { base, path } for a given object key.
 * base = protocol://host (without trailing slash), path = canonical URI path
 * with the bucket prefix applied for path-style endpoints.
 */
export function buildObjectTarget(
  config: StorageConfig,
  key: string,
): { base: string; path: string } {
  const { protocol, host } = resolveEndpoint(config);
  const rawPath = config.forcePathStyle ? `/${config.bucket}/${key}` : `/${key}`;
  return { base: `${protocol}//${host}`, path: encodePathSegments(rawPath) };
}

// ── Canonical request building ────────────────────────────────────────────────

/**
 * Canonical query string: keys (and values) percent-encoded and sorted
 * byte-wise. This exact string is used BOTH in the canonical request and in
 * the final presigned URL so they always match.
 */
export function canonicalQueryString(params: Record<string, string>): string {
  return Object.entries(params)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${percentEncode(key)}=${percentEncode(value)}`)
    .join("&");
}

function canonicalHeaders(headers: Record<string, string>): string {
  return Object.keys(headers)
    .sort()
    .map((name) => `${name}:${headers[name].trim().replace(/\s+/g, " ")}\n`)
    .join("");
}

export interface BuildCanonicalRequestInput {
  method: string;
  path: string; // already segment-encoded
  query: Record<string, string>;
  headers: Record<string, string>; // lowercase header names
  signedHeaderNames: readonly string[];
  payloadHash: string; // hex, or "UNSIGNED-PAYLOAD" for presigned URLs
}

export function buildCanonicalRequest(input: BuildCanonicalRequestInput): string {
  const { method, path, headers, signedHeaderNames, payloadHash } = input;
  const query = canonicalQueryString(input.query);
  const headerBlock = canonicalHeaders(headers);
  const signedHeaders = signedHeaderNames.join(";");
  return [method, path, query, headerBlock, signedHeaders, payloadHash].join("\n");
}

export function buildStringToSign(
  timestamp: string,
  dateStamp: string,
  region: string,
  service: string,
  canonicalRequest: string,
): string {
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  return [
    "AWS4-HMAC-SHA256",
    timestamp,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");
}

// ── Shared presigned-URL plumbing ─────────────────────────────────────────────

export const DEFAULT_PRESIGN_TTL_SECONDS = 900; // 15 minutes

export interface PresignInput {
  config: StorageConfig;
  key: string;
  expiresInSeconds?: number;
  now?: Date;
}

export interface PresignPutInput extends PresignInput {
  contentType?: string;
  /** Informational only — a presigned PUT cannot hard-enforce size. */
  sizeBytes?: number;
}

export interface PresignGetInput extends PresignInput {
  responseContentDisposition?: string;
  responseContentType?: string;
}

export interface PresignedResult {
  url: string;
  host: string;
  canonicalPath: string;
}

/**
 * Signs and returns a presigned PUT URL for `key` (query-based SigV4).
 * Only the `host` header is signed, so browsers can attach a Content-Type
 * header without invalidating the signature.
 */
export function presignPutRequest(input: PresignPutInput): string {
  return buildPresignedUrl(input, "PUT");
}

/**
 * Signs and returns a presigned GET URL for `key`.
 * Supports response-content-disposition / response-content-type overrides.
 */
export function presignGetRequest(input: PresignGetInput): string {
  return buildPresignedUrl(input, "GET");
}

function buildPresignedUrl(input: PresignInput, method: string): string {
  const {
    config,
    key,
    expiresInSeconds = DEFAULT_PRESIGN_TTL_SECONDS,
    now = new Date(),
  } = input;

  const { base, path } = buildObjectTarget(config, key);
  const timestamp = toAmzTimestamp(now);
  const dateStamp = timestamp.slice(0, 8);
  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;

  const params: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${config.accessKeyId}/${scope}`,
    "X-Amz-Date": timestamp,
    "X-Amz-Expires": String(expiresInSeconds),
    "X-Amz-SignedHeaders": "host",
  };

  if (method === "GET") {
    const getInput = input as PresignGetInput;
    if (getInput.responseContentDisposition) {
      params["response-content-disposition"] = getInput.responseContentDisposition;
    }
    if (getInput.responseContentType) {
      params["response-content-type"] = getInput.responseContentType;
    }
  }

  const { host } = resolveEndpoint(config);
  const headers = { host };
  const canonicalRequest = buildCanonicalRequest({
    method,
    path,
    query: params,
    headers,
    signedHeaderNames: ["host"],
    payloadHash: "UNSIGNED-PAYLOAD",
  });
  const stringToSign = buildStringToSign(timestamp, dateStamp, config.region, "s3", canonicalRequest);
  const signingKey = getSigningKey(config.secretAccessKey, dateStamp, config.region, "s3");
  const signature = hmacSha256(signingKey, stringToSign).toString("hex");

  const queryString = canonicalQueryString(params);
  const url = `${base}${path}?${queryString}&X-Amz-Signature=${signature}`;

  return url;
}

// ── Direct-request authorization (fetch client) ───────────────────────────────

export interface DirectSignInput {
  config: StorageConfig;
  method: string;
  key: string;
  query?: Record<string, string>;
  body?: Buffer;
  extraHeaders?: Record<string, string>; // e.g. { "content-type": "image/jpeg" }
  now?: Date;
}

export interface DirectSignedRequest {
  headers: Record<string, string>;
}

/**
 * Builds the headers for a directly signed S3 request (Authorization header
 * style). Payload hash is sent as `x-amz-content-sha256` for integrity.
 */
export function signDirectRequest(input: DirectSignInput): DirectSignedRequest {
  const {
    config,
    method,
    key,
    query = {},
    body,
    extraHeaders = {},
    now = new Date(),
  } = input;

  const { path } = buildObjectTarget(config, key);
  const timestamp = toAmzTimestamp(now);
  const dateStamp = timestamp.slice(0, 8);
  const payloadHash = body ? sha256HexBytes(body) : sha256Hex("");
  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;

  const headers: Record<string, string> = {
    host: resolveEndpoint(config).host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": timestamp,
  };
  for (const [name, value] of Object.entries(extraHeaders)) {
    headers[name.toLowerCase()] = value;
  }

  const signedHeaderNames = Object.keys(headers).sort();

  const canonicalRequest = buildCanonicalRequest({
    method,
    path,
    query,
    headers,
    signedHeaderNames,
    payloadHash,
  });
  const stringToSign = buildStringToSign(timestamp, dateStamp, config.region, "s3", canonicalRequest);
  const signingKey = getSigningKey(config.secretAccessKey, dateStamp, config.region, "s3");
  const signature = hmacSha256(signingKey, stringToSign).toString("hex");

  const signedHeaders = signedHeaderNames.join(";");
  return {
    headers: {
      ...headers,
      authorization:
        `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  };
}

// ── Timestamp helpers ─────────────────────────────────────────────────────────

/** Formats a Date as `YYYYMMDDTHHMMSSZ` (UTC, literal Z suffix). */
export function toAmzTimestamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Extracts the `YYYYMMDD` date stamp from an AMZ timestamp. */
export function toAmzDateStamp(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}