/**
 * Lightweight MP4/MOV metadata parsing.
 *
 * Implements a pure ISO-BMFF (QuickTime) box walker that locates the `moov`
 * movie box and reads the `mvhd` movie-header box to extract the duration in
 * milliseconds. No ffmpeg required — used by the media processing worker for
 * the `video_transcode` (metadata-probe) job.
 *
 * Duration is derived correctly even when the file is large and the top-level
 * `mdat` box precedes `moov` (common for MOV files). WebM/Matroska duration
 * parsing is intentionally not implemented (`parseWebmDuration` returns null).
 */

interface Box {
  type: string;
  headerSize: number;
  size: number;
}

/** Reads a top-level ISO-BMFF box header at `offset`. */
function readBox(buf: Buffer, offset: number, containerEnd: number): Box | null {
  if (offset + 8 > containerEnd) return null;

  let size = buf.readUInt32BE(offset);
  const type = buf.toString("latin1", offset + 4, offset + 8);
  let headerSize = 8;

  if (size === 1) {
    // 64-bit largesize follows the 8-byte header.
    if (offset + 16 > containerEnd) return null;
    size = Number(buf.readBigUInt64BE(offset + 8));
    headerSize = 16;
  } else if (size === 0) {
    // 0 means "to end of container".
    size = containerEnd - offset;
  }

  if (size < headerSize) return null;
  return { type, headerSize, size };
}

/**
 * Parses the duration (ms) of an MP4/MOV file from its `moov`/`mvhd` boxes.
 * Returns null when the buffer is not a recognizable MP4/MOV or lacks mvhd.
 */
export function parseMp4Duration(buf: Buffer): number | null {
  if (!buf || buf.length < 8) return null;

  let offset = 0;
  while (offset + 8 <= buf.length) {
    const box = readBox(buf, offset, buf.length);
    if (!box) return null;

    if (box.type === "moov") {
      return readMvhdDurationFromContainer(buf, offset + box.headerSize, offset + box.size);
    }

    if (box.size < 8) return null;
    offset += box.size;
  }

  return null;
}

/** Walks the children of `moov` looking for `mvhd`. */
function readMvhdDurationFromContainer(buf: Buffer, start: number, end: number): number | null {
  let offset = start;
  while (offset + 8 <= end) {
    const box = readBox(buf, offset, end);
    if (!box) return null;

    if (box.type === "mvhd") {
      return readMvhdDuration(buf, offset + box.headerSize, offset + box.size);
    }

    if (box.size < 8) return null;
    offset += box.size;
  }

  return null;
}

/**
 * Reads the timescale/duration pair from a FullBox `mvhd` (version 0 or 1).
 * Returns duration in milliseconds, or null on any malformed layout.
 */
function readMvhdDuration(buf: Buffer, start: number, end: number): number | null {
  if (end - start < 4) return null;
  const version = buf[start];

  if (version === 0) {
    // version(1) + flags(3) | creation(4) | modification(4) | timescale(4) | duration(4)
    if (end - start < 16 + 4) return null;
    const timescale = buf.readUInt32BE(start + 12);
    const duration = buf.readUInt32BE(start + 16);
    if (!timescale) return null;
    return Math.round((duration / timescale) * 1000);
  }

  if (version === 1) {
    // version(1) + flags(3) | creation(8) | modification(8) | timescale(4) | duration(8)
    if (end - start < 24 + 8) return null;
    const timescale = buf.readUInt32BE(start + 20);
    const duration = Number(buf.readBigUInt64BE(start + 24));
    if (!timescale) return null;
    return Math.round((duration / timescale) * 1000);
  }

  return null;
}

/**
 * WEBM duration extraction is not implemented in this lightweight probe.
 * Always returns null (documented limitation — real HLS/WebM metadata probing
 * requires ffmpeg or a Matroska parser).
 */
export function parseWebmDuration(): number | null {
  return null;
}