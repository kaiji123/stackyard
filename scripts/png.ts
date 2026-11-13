// Minimal PNG codec (no dependencies) for the art scripts and their tests.
// encodePng writes 8-bit RGBA, no interlace. decodePng reads 8-bit RGB/RGBA (colour types 2 and 6),
// non-interlaced, which is what our own art and the shipped media use.
import { deflateSync, inflateSync } from "node:zlib";

export interface Bitmap {
  readonly width: number;
  readonly height: number;
  /** RGBA, width * height * 4. */
  readonly rgba: Uint8Array;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = (CRC_TABLE[(c ^ b) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

export function encodePng(bmp: Bitmap): Uint8Array {
  const { width, height, rgba } = bmp;
  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, width);
  v.setUint32(4, height);
  ihdr.set([8, 6, 0, 0, 0], 8); // 8-bit, RGBA, deflate, adaptive filter, no interlace
  const raw = new Uint8Array(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter: none (deflate handles our flat pixel art well)
    raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (1 + width * 4) + 1);
  }
  const parts = [
    Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", new Uint8Array(0)),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

const paeth = (a: number, b: number, c: number): number => {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

export function decodePng(bytes: Uint8Array): Bitmap {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let p = 8, width = 0, height = 0, type = 0;
  const idat: Uint8Array[] = [];
  while (p < bytes.length) {
    const len = view.getUint32(p);
    const t = String.fromCharCode(...bytes.subarray(p + 4, p + 8));
    const data = bytes.subarray(p + 8, p + 8 + len);
    if (t === "IHDR") {
      width = view.getUint32(p + 8);
      height = view.getUint32(p + 12);
      const depth = bytes[p + 16], interlace = bytes[p + 20];
      type = bytes[p + 17] ?? 0;
      if (depth !== 8 || (type !== 2 && type !== 6) || interlace !== 0) throw new Error(`Unsupported PNG (depth ${depth}, type ${type}, interlace ${interlace})`);
    } else if (t === "IDAT") idat.push(data);
    else if (t === "IEND") break;
    p += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const bpp = type === 6 ? 4 : 3, stride = width * bpp;
  const px = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)] ?? 0;
    for (let x = 0; x < stride; x++) {
      const r = raw[y * (stride + 1) + 1 + x] ?? 0;
      const a = x >= bpp ? px[y * stride + x - bpp] ?? 0 : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] ?? 0 : 0;
      const c = x >= bpp && y > 0 ? px[(y - 1) * stride + x - bpp] ?? 0 : 0;
      px[y * stride + x] = (r + (f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : f === 4 ? paeth(a, b, c) : 0)) & 0xff;
    }
  }
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = px[i * bpp] ?? 0; rgba[i * 4 + 1] = px[i * bpp + 1] ?? 0; rgba[i * 4 + 2] = px[i * bpp + 2] ?? 0;
    rgba[i * 4 + 3] = bpp === 4 ? px[i * bpp + 3] ?? 0 : 255;
  }
  return { width, height, rgba };
}
