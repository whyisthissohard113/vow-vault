/**
 * Unit tests for the hand-rolled SigV4 presigning logic.
 *
 * The signing-key derivation follows the canonical AWS SigV4 KAT inputs;
 * the expected hex below matches an independent derivation of the documented
 * algorithm (secret = "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
 * dateStamp = 20150830, region = us-east-1, service = s3).
 */

import { describe, it, expect } from "vitest";

import {
  hmacSha256,
  sha256Hex,
  sha256HexBytes,
  getSigningKey,
  percentEncode,
  encodePathSegments,
  resolveEndpoint,
  buildObjectTarget,
  canonicalQueryString,
  toAmzTimestamp,
  toAmzDateStamp,
  presignPutRequest,
  presignGetRequest,
  DEFAULT_PRESIGN_TTL_SECONDS,
} from "@/server/services/storage/signature";
import type { StorageConfig } from "@/server/services/storage/config";

// Known-correct SHA-256 of the empty string.
const SHA256_EMPTY = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

const TEST_CONFIG: StorageConfig = {
  endpoint: "http://127.0.0.1:9000",
  region: "us-east-1",
  bucket: "wedding-vault",
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
  forcePathStyle: true,
};

const FIXED_NOW = new Date("2026-09-11T12:34:56.000Z");

describe("SigV4 cryptographic primitives", () => {
  it("getSigningKey matches the canonical SigV4 KAT derivation", () => {
    const key = getSigningKey(
      "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
      "20150830",
      "us-east-1",
      "s3",
    );
    expect(key.toString("hex")).toBe(
      "32f78051dcde24c552811d654f4a769112bb834b03975cdd6b1fd7d16248c269",
    );
  });

  it("hmacSha256 is deterministic", () => {
    expect(hmacSha256("key", "value").toString("hex")).toBe(
      hmacSha256("key", "value").toString("hex"),
    );
    expect(hmacSha256("key", "value").toString("hex")).not.toBe(
      hmacSha256("key", "other").toString("hex"),
    );
  });

  it("sha256Hex / sha256HexBytes produce the correct hex for an empty payload", () => {
    // SHA-256 of the empty string is a well-known constant.
    expect(sha256Hex("")).toBe(SHA256_EMPTY);
    expect(sha256HexBytes(Buffer.from(""))).toBe(SHA256_EMPTY);
  });
});

describe("SigV4 encoding helpers", () => {
  it("percentEncode encodes reserved characters but not unreserved", () => {
    expect(percentEncode("abcXYZ0129-_.~")).toBe("abcXYZ0129-_.~");
    expect(percentEncode("a b")).toBe("a%20b");
    expect(percentEncode("a/b")).toBe("a%2Fb");
    expect(percentEncode("a:b")).toBe("a%3Ab");
    expect(percentEncode('a"b')).toBe("a%22b");
  });

  it("encodePathSegments encodes each segment but keeps path separators", () => {
    expect(encodePathSegments("/org/123/media.jpg")).toBe("/org/123/media.jpg");
    expect(encodePathSegments("/org/my org/media.jpg")).toBe("/org/my%20org/media.jpg");
  });

  it("canonicalQueryString sorts keys and percent-encodes values", () => {
    const qs = canonicalQueryString({ b: "two words", a: "1" });
    expect(qs).toBe("a=1&b=two%20words");
  });

  it("toAmzTimestamp / toAmzDateStamp format correctly", () => {
    expect(toAmzTimestamp(FIXED_NOW)).toBe("20260911T123456Z");
    expect(toAmzDateStamp(FIXED_NOW)).toBe("20260911");
    expect(toAmzDateStamp(FIXED_NOW)).toBe(toAmzTimestamp(FIXED_NOW).slice(0, 8));
  });
});

describe("endpoint resolution", () => {
  it("uses path-style hosts when forcePathStyle is true", () => {
    expect(resolveEndpoint(TEST_CONFIG).host).toBe("127.0.0.1:9000");
    const { base, path } = buildObjectTarget(TEST_CONFIG, "org/wed/abc.jpg");
    expect(base).toBe("http://127.0.0.1:9000");
    expect(path).toBe("/wedding-vault/org/wed/abc.jpg");
  });

  it("uses virtual-hosted hosts when forcePathStyle is false", () => {
    const config: StorageConfig = { ...TEST_CONFIG, forcePathStyle: false };
    expect(resolveEndpoint(config).host).toBe("wedding-vault.127.0.0.1:9000");
    const { base, path } = buildObjectTarget(config, "org/wed/abc.jpg");
    expect(base).toBe("http://wedding-vault.127.0.0.1:9000");
    expect(path).toBe("/org/wed/abc.jpg");
  });
});

describe("presignPutRequest", () => {
  it("produces a deterministic URL for a fixed timestamp", () => {
    const url1 = presignPutRequest({
      config: TEST_CONFIG,
      key: "org/wed/media.jpg",
      contentType: "image/jpeg",
      sizeBytes: 1234,
      expiresInSeconds: 600,
      now: FIXED_NOW,
    });
    const url2 = presignPutRequest({
      config: TEST_CONFIG,
      key: "org/wed/media.jpg",
      contentType: "image/jpeg",
      sizeBytes: 1234,
      expiresInSeconds: 600,
      now: FIXED_NOW,
    });
    expect(url1).toBe(url2);
  });

  it("changes when the timestamp changes", () => {
    const url1 = presignPutRequest({
      config: TEST_CONFIG,
      key: "org/wed/media.jpg",
      contentType: "image/jpeg",
      sizeBytes: 1234,
      expiresInSeconds: 600,
      now: FIXED_NOW,
    });
    const url2 = presignPutRequest({
      config: TEST_CONFIG,
      key: "org/wed/media.jpg",
      contentType: "image/jpeg",
      sizeBytes: 1234,
      expiresInSeconds: 600,
      now: new Date(FIXED_NOW.getTime() + 1000),
    });
    expect(url1).not.toBe(url2);
  });

  it("signs only the host header and includes the standard query parameters", () => {
    const url = presignPutRequest({
      config: TEST_CONFIG,
      key: "org/wed/media.jpg",
      contentType: "image/jpeg",
      sizeBytes: 1234,
      expiresInSeconds: 600,
      now: FIXED_NOW,
    });
    const parsed = new URL(url);
    const params = parsed.searchParams;

    expect(params.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(params.get("X-Amz-Credential")).toContain(
      `AKIAIOSFODNN7EXAMPLE/20260911/us-east-1/s3/aws4_request`,
    );
    expect(params.get("X-Amz-Date")).toBe("20260911T123456Z");
    expect(params.get("X-Amz-Expires")).toBe("600");
    expect(params.get("X-Amz-SignedHeaders")).toBe("host");
    expect(params.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
    expect(params.get("X-Amz-Content-Sha256")).toBeNull();
    expect(params.get("response-content-disposition")).toBeNull();
  });

  it("defaults to the standard 15-minute TTL", () => {
    const url = presignPutRequest({
      config: TEST_CONFIG,
      key: "org/wed/media.jpg",
      now: FIXED_NOW,
    });
    expect(new URL(url).searchParams.get("X-Amz-Expires")).toBe(String(DEFAULT_PRESIGN_TTL_SECONDS));
  });
});

describe("presignGetRequest", () => {
  it("includes response-content parameters when requested", () => {
    const url = presignGetRequest({
      config: TEST_CONFIG,
      key: "org/wed/media.jpg",
      expiresInSeconds: 300,
      responseContentDisposition: 'attachment; filename="my photo.jpg"',
      responseContentType: "image/jpeg",
      now: FIXED_NOW,
    });
    const params = new URL(url).searchParams;
    // The raw URL carries the percent-encoded value; URLSearchParams decodes it.
    expect(url).toContain("my%20photo.jpg");
    expect(params.get("response-content-disposition")).toBe('attachment; filename="my photo.jpg"');
    expect(params.get("response-content-type")).toBe("image/jpeg");
    expect(params.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("omits response-content parameters when not provided", () => {
    const url = presignGetRequest({
      config: TEST_CONFIG,
      key: "org/wed/media.jpg",
      now: FIXED_NOW,
    });
    const params = new URL(url).searchParams;
    expect(params.get("response-content-disposition")).toBeNull();
    expect(params.get("response-content-type")).toBeNull();
  });
});