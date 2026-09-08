import { inflateSync } from "node:zlib";

interface Chunk {
  type: string;
  data: Buffer;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function readChunks(buf: Buffer): Chunk[] {
  const chunks: Chunk[] = [];
  let offset = 8;
  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);
    chunks.push({ type, data: buf.subarray(offset + 8, offset + 8 + length) });
    offset += 12 + length; // length field + type + data + crc
  }
  return chunks;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/**
 * The fraction of pixels whose alpha exceeds 8, mirroring `scripts/audit-cutouts.py`'s
 * `opaque_share`. Only handles the one format `scripts/cutout.py` ever writes (8-bit,
 * non-interlaced RGBA): anything else comes back as fully opaque, the same "nothing was lifted"
 * signal a real background-only image gives, so a drifted asset fails the check instead of
 * silently skipping it.
 */
export function opaqueShare(buf: Buffer): number {
  if (!buf.subarray(0, 8).equals(PNG_SIGNATURE)) return 1;
  const chunks = readChunks(buf);
  const ihdr = chunks.find((c) => c.type === "IHDR")?.data;
  if (!ihdr) return 1;
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const bitDepth = ihdr[8];
  const colorType = ihdr[9];
  const interlace = ihdr[12];
  if (bitDepth !== 8 || colorType !== 6 || interlace !== 0) return 1;

  const idat = Buffer.concat(chunks.filter((c) => c.type === "IDAT").map((c) => c.data));
  const raw = inflateSync(idat);
  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const out = Buffer.alloc(height * stride);
  let inPos = 0;
  for (let y = 0; y < height; y++) {
    const filterType = raw[inPos]!;
    inPos += 1;
    const rowStart = y * stride;
    for (let x = 0; x < stride; x++) {
      const rawByte = raw[inPos + x]!;
      const a = x >= bytesPerPixel ? out[rowStart + x - bytesPerPixel]! : 0;
      const b = y > 0 ? out[rowStart - stride + x]! : 0;
      const c = x >= bytesPerPixel && y > 0 ? out[rowStart - stride + x - bytesPerPixel]! : 0;
      let value: number;
      switch (filterType) {
        case 0: value = rawByte; break;
        case 1: value = rawByte + a; break;
        case 2: value = rawByte + b; break;
        case 3: value = rawByte + Math.floor((a + b) / 2); break;
        case 4: value = rawByte + paeth(a, b, c); break;
        default: throw new Error(`unknown PNG filter type ${filterType}`);
      }
      out[rowStart + x] = value & 0xff;
    }
    inPos += stride;
  }

  let opaque = 0;
  const totalPixels = width * height;
  for (let i = 0; i < totalPixels; i++) {
    if (out[i * 4 + 3]! > 8) opaque++;
  }
  return opaque / totalPixels;
}
