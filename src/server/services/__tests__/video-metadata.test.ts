/**
 * Unit tests for the lightweight MP4/MOV duration probe.
 */

import { describe, it, expect } from "vitest";
import { parseMp4Duration, parseWebmDuration } from "@/server/services/video-metadata";

/** Builds a top-level MP4 box: `size(4) + type + payload`. */
function box(type: string, payload: Buffer): Buffer {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(8 + payload.length, 0);
  header.write(type, 4, "latin1");
  return Buffer.concat([header, payload]);
}

/** Builds an ISO-BMFF fullbox: `box header + version/flags(4) + fields`. */
function fullBox(type: string, version: number, fields: Buffer): Buffer {
  const header = Buffer.alloc(8);
  const body = Buffer.alloc(4 + fields.length);
  body[0] = version; // version
  body.fill(0, 1, 4); // flags
  fields.copy(body, 4);
  header.writeUInt32BE(body.length + 8, 0);
  header.write(type, 4, "latin1");
  return Buffer.concat([header, body]);
}

describe("parseMp4Duration", () => {
  it("returns null for empty/garbage input", () => {
    expect(parseMp4Duration(Buffer.alloc(0))).toBeNull();
    expect(parseMp4Duration(Buffer.from("not an mp4 at all"))).toBeNull();
  });

  it("returns null when moov/mvhd is absent", () => {
    const ftyp = box("ftyp", Buffer.from("isom\x00\x00\x00\x00isommp42", "latin1"));
    expect(parseMp4Duration(Buffer.concat([ftyp]))).toBeNull();
  });

  it("parses mvhd version 0 duration (timescale 1000, duration 5200 → 5200 ms)", () => {
    const fields = Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x01]), // creation time
      Buffer.from([0x00, 0x00, 0x00, 0x02]), // modification time
      (() => { const b = Buffer.alloc(4); b.writeUInt32BE(1000, 0); return b; })(), // timescale
      (() => { const b = Buffer.alloc(4); b.writeUInt32BE(5200, 0); return b; })(), // duration
    ]);

    const file = Buffer.concat([
      box("ftyp", Buffer.from("isom\x00\x00\x00\x00isommp42", "latin1")),
      box("moov", fullBox("mvhd", 0, fields)),
    ]);

    expect(parseMp4Duration(file)).toBe(5200);
  });

  it("parses mvhd version 1 duration (64-bit) correctly", () => {
    const fields = Buffer.concat([
      Buffer.alloc(8), // creation time (64-bit)
      Buffer.alloc(8), // modification time (64-bit)
      (() => { const b = Buffer.alloc(4); b.writeUInt32BE(600, 0); return b; })(), // timescale
      (() => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(3000), 0); return b; })(), // duration 64-bit
    ]);

    const file = Buffer.concat([
      box("ftyp", Buffer.from("isom\x00\x00\x00\x00isommp42", "latin1")),
      box("moov", fullBox("mvhd", 1, fields)),
    ]);

    // 3000 / 600 * 1000 = 5000 ms
    expect(parseMp4Duration(file)).toBe(5000);
  });

  it("finds moov even when it follows a large mdat box", () => {
    const fields = Buffer.concat([
      Buffer.alloc(4),
      Buffer.alloc(4),
      (() => { const b = Buffer.alloc(4); b.writeUInt32BE(1000, 0); return b; })(),
      (() => { const b = Buffer.alloc(4); b.writeUInt32BE(1500, 0); return b; })(),
    ]);
    const mdat = box("mdat", Buffer.alloc(64));
    const file = Buffer.concat([
      box("ftyp", Buffer.from("isom\x00\x00\x00\x00isommp42", "latin1")),
      mdat,
      box("moov", fullBox("mvhd", 0, fields)),
    ]);

    expect(parseMp4Duration(file)).toBe(1500);
  });
});

describe("parseWebmDuration", () => {
  it("is a documented no-op that returns null", () => {
    expect(parseWebmDuration()).toBeNull();
  });
});