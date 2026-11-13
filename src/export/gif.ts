// Minimal GIF codec (no dependencies). Used by the drawing tool (animated drawings), the art scripts and the
// media scripts. Pure: no DOM, no Node APIs. Decodes every frame to full RGBA (honouring disposal and transparency), and encodes
// full frames with one global palette, disposal "restore to background" and a transparent index.
// Runs under Node's TypeScript type stripping, and under Vitest.

export interface Frame {
  /** RGBA, width * height * 4. Alpha is 0 or 255 (GIF has no partial transparency). */
  readonly rgba: Uint8Array;
  /** Delay in hundredths of a second. */
  readonly delay: number;
}

export interface Gif {
  readonly width: number;
  readonly height: number;
  readonly frames: readonly Frame[];
}

const at = (a: Uint8Array, i: number): number => {
  const v = a[i];
  if (v === undefined) throw new Error(`GIF data ends early (byte ${i})`);
  return v;
};
const u16 = (a: Uint8Array, i: number): number => at(a, i) | (at(a, i + 1) << 8);

/** Concatenate data sub-blocks starting at `p`. Returns the data and the position after the terminator. */
function subBlocks(b: Uint8Array, p: number): { data: Uint8Array; next: number } {
  const parts: Uint8Array[] = [];
  let len = 0;
  for (let n = at(b, p); n !== 0; n = at(b, p)) {
    parts.push(b.subarray(p + 1, p + 1 + n));
    len += n;
    p += n + 1;
  }
  const data = new Uint8Array(len);
  let o = 0;
  for (const part of parts) { data.set(part, o); o += part.length; }
  return { data, next: p + 1 };
}

/** GIF-flavoured LZW decode into `out` (palette indices). */
function lzwDecode(data: Uint8Array, minSize: number, out: Uint8Array): void {
  const clear = 1 << minSize, eoi = clear + 1;
  const prefix = new Int32Array(4096), suffix = new Uint8Array(4096), length = new Int32Array(4096);
  for (let i = 0; i < clear; i++) { prefix[i] = -1; suffix[i] = i; length[i] = 1; }
  let size = minSize + 1, next = eoi + 1, prev = -1, bitPos = 0, o = 0;
  const stack = new Uint8Array(4096);
  const read = (): number => {
    let code = 0;
    for (let i = 0; i < size; i++, bitPos++) {
      const byte = data[bitPos >> 3];
      if (byte === undefined) return eoi; // tolerate truncated streams
      code |= ((byte >> (bitPos & 7)) & 1) << i;
    }
    return code;
  };
  const firstOf = (code: number): number => {
    let c = code;
    while ((prefix[c] ?? -1) >= 0) c = prefix[c] ?? -1;
    return suffix[c] ?? 0;
  };
  const emit = (code: number): void => {
    let n = 0;
    for (let c = code; c >= 0; c = prefix[c] ?? -1) stack[n++] = suffix[c] ?? 0;
    while (n > 0 && o < out.length) out[o++] = stack[--n] ?? 0;
  };
  for (;;) {
    const code = read();
    if (code === clear) { size = minSize + 1; next = eoi + 1; prev = -1; continue; }
    if (code === eoi) break;
    if (prev < 0) { emit(code); prev = code; continue; }
    const known = code < next;
    if (!known && code !== next) throw new Error("Corrupt LZW stream");
    if (next < 4096) {
      prefix[next] = prev;
      suffix[next] = firstOf(known ? code : prev);
      length[next] = (length[prev] ?? 0) + 1;
      next++;
      if (next >= 1 << size && size < 12) size++;
    }
    emit(code);
    prev = code;
  }
}

export function decodeGif(bytes: Uint8Array): Gif {
  const sig = String.fromCharCode(...bytes.subarray(0, 6));
  if (sig !== "GIF87a" && sig !== "GIF89a") throw new Error("Not a GIF");
  const width = u16(bytes, 6), height = u16(bytes, 8), packed = at(bytes, 10);
  let p = 13;
  let global: Uint8Array = new Uint8Array(0);
  if (packed & 0x80) {
    const n = 3 * (1 << ((packed & 7) + 1));
    global = bytes.subarray(p, p + n);
    p += n;
  }
  const canvas = new Uint8Array(width * height * 4); // starts fully transparent
  const frames: Frame[] = [];
  let gce = { disposal: 0, transparent: -1, delay: 0 };
  for (;;) {
    const t = at(bytes, p);
    if (t === 0x3b) break;
    if (t === 0x21) {
      const label = at(bytes, p + 1);
      if (label === 0xf9) {
        const f = at(bytes, p + 3);
        gce = { disposal: (f >> 2) & 7, transparent: f & 1 ? at(bytes, p + 6) : -1, delay: u16(bytes, p + 4) };
      }
      p = subBlocks(bytes, p + 2).next;
      continue;
    }
    if (t !== 0x2c) throw new Error(`Unexpected GIF block 0x${t.toString(16)}`);
    const fx = u16(bytes, p + 1), fy = u16(bytes, p + 3), fw = u16(bytes, p + 5), fh = u16(bytes, p + 7), lp = at(bytes, p + 9);
    p += 10;
    let palette = global;
    if (lp & 0x80) {
      const n = 3 * (1 << ((lp & 7) + 1));
      palette = bytes.subarray(p, p + n);
      p += n;
    }
    const minSize = at(bytes, p);
    const { data, next } = subBlocks(bytes, p + 1);
    p = next;
    const idx = new Uint8Array(fw * fh);
    lzwDecode(data, minSize, idx);

    const before = gce.disposal === 3 ? canvas.slice() : null;
    const rowOrder = (lp & 0x40) ? interlacedRows(fh) : Array.from({ length: fh }, (_, i) => i);
    rowOrder.forEach((row, srcRow) => {
      for (let x = 0; x < fw; x++) {
        const ci = at(idx, srcRow * fw + x);
        if (ci === gce.transparent) continue;
        const cx = fx + x, cy = fy + row;
        if (cx >= width || cy >= height) continue;
        const d = (cy * width + cx) * 4;
        canvas[d] = at(palette, ci * 3); canvas[d + 1] = at(palette, ci * 3 + 1); canvas[d + 2] = at(palette, ci * 3 + 2); canvas[d + 3] = 255;
      }
    });
    frames.push({ rgba: canvas.slice(), delay: gce.delay });

    if (gce.disposal === 2) {
      for (let y = fy; y < Math.min(height, fy + fh); y++) canvas.fill(0, (y * width + fx) * 4, (y * width + Math.min(width, fx + fw)) * 4);
    } else if (gce.disposal === 3 && before) {
      canvas.set(before);
    }
    gce = { disposal: 0, transparent: -1, delay: 0 };
  }
  return { width, height, frames };
}

function interlacedRows(h: number): number[] {
  const rows: number[] = [];
  for (const [start, step] of [[0, 8], [4, 8], [2, 4], [1, 2]] as const) for (let y = start; y < h; y += step) rows.push(y);
  return rows;
}

/** GIF-flavoured LZW encode of palette indices. */
function lzwEncode(pixels: Uint8Array, minSize: number): Uint8Array {
  const out: number[] = [];
  let acc = 0, bits = 0;
  const clear = 1 << minSize, eoi = clear + 1;
  let size = minSize + 1, next = eoi + 1;
  const dict = new Map<number, number>();
  const emit = (code: number): void => {
    acc |= code << bits;
    bits += size;
    while (bits >= 8) { out.push(acc & 0xff); acc >>>= 8; bits -= 8; }
  };
  emit(clear);
  let prefix = at(pixels, 0);
  for (let i = 1; i < pixels.length; i++) {
    const k = at(pixels, i);
    const key = (prefix << 8) | k;
    const found = dict.get(key);
    if (found !== undefined) { prefix = found; continue; }
    emit(prefix);
    if (next === 4096) {
      emit(clear);
      dict.clear();
      next = eoi + 1;
      size = minSize + 1;
    } else {
      if (next >= 1 << size) size++;
      dict.set(key, next++);
    }
    prefix = k;
  }
  emit(prefix);
  emit(eoi);
  if (bits > 0) out.push(acc & 0xff);
  return Uint8Array.from(out);
}

/**
 * Encode full RGBA frames. Pixels with alpha 0 become the transparent index; every frame uses disposal
 * "restore to background", so moving parts never leave trails. Loops forever. At most 255 opaque colours.
 */
export function encodeGif(gif: Gif): Uint8Array {
  const { width, height, frames } = gif;
  if (frames.length === 0) throw new Error("No frames");
  const colours = new Map<number, number>(); // rgb -> palette index (0 is transparent)
  for (const f of frames) {
    for (let i = 0; i < f.rgba.length; i += 4) {
      if (at(f.rgba, i + 3) === 0) continue;
      const rgb = (at(f.rgba, i) << 16) | (at(f.rgba, i + 1) << 8) | at(f.rgba, i + 2);
      if (!colours.has(rgb)) {
        if (colours.size >= 255) throw new Error("More than 255 colours");
        colours.set(rgb, colours.size + 1);
      }
    }
  }
  let bitsPerIndex = 1;
  while (1 << bitsPerIndex < colours.size + 1) bitsPerIndex++;
  const tableSize = 1 << bitsPerIndex;
  const minSize = Math.max(2, bitsPerIndex);

  const out: number[] = [];
  const push16 = (v: number): void => { out.push(v & 0xff, (v >> 8) & 0xff); };
  out.push(...Array.from("GIF89a", (c) => c.charCodeAt(0)));
  push16(width); push16(height);
  out.push(0x80 | ((bitsPerIndex - 1) << 4) | (bitsPerIndex - 1), 0, 0);
  const table = new Array<number>(tableSize * 3).fill(0);
  for (const [rgb, i] of colours) { table[i * 3] = rgb >> 16; table[i * 3 + 1] = (rgb >> 8) & 0xff; table[i * 3 + 2] = rgb & 0xff; }
  out.push(...table);
  out.push(0x21, 0xff, 0x0b, ...Array.from("NETSCAPE2.0", (c) => c.charCodeAt(0)), 0x03, 0x01, 0x00, 0x00, 0x00);

  for (const f of frames) {
    out.push(0x21, 0xf9, 0x04, (2 << 2) | 1);
    push16(f.delay);
    out.push(0, 0);
    out.push(0x2c); push16(0); push16(0); push16(width); push16(height); out.push(0);
    const idx = new Uint8Array(width * height);
    for (let i = 0; i < idx.length; i++) {
      const d = i * 4;
      idx[i] = at(f.rgba, d + 3) === 0 ? 0 : colours.get((at(f.rgba, d) << 16) | (at(f.rgba, d + 1) << 8) | at(f.rgba, d + 2)) ?? 0;
    }
    const data = lzwEncode(idx, minSize);
    out.push(minSize);
    for (let i = 0; i < data.length; i += 255) {
      const chunk = data.subarray(i, i + 255);
      out.push(chunk.length, ...chunk);
    }
    out.push(0);
  }
  out.push(0x3b);
  return Uint8Array.from(out);
}

/**
 * Make the background transparent. The key colour defaults to the top-left pixel of the first frame.
 * - "connected" (default): only key-colour pixels connected to the image border, so dark details of the
 *   same colour inside the artwork survive.
 * - "all": every key-colour pixel, for art where that colour is only ever background (e.g. gaps between
 *   flame pixels, which "connected" would leave as dark specks).
 */
export function clearBackground(gif: Gif, opts: { key?: readonly [number, number, number]; mode?: "connected" | "all" } = {}): Gif {
  const key = opts.key;
  const mode = opts.mode ?? "connected";
  const { width, height } = gif;
  const first = gif.frames[0];
  if (!first) return gif;
  const [kr, kg, kb] = key ?? [at(first.rgba, 0), at(first.rgba, 1), at(first.rgba, 2)];
  const frames = gif.frames.map((f) => {
    const rgba = f.rgba.slice();
    const isKey = (i: number): boolean => {
      const d = i * 4;
      return at(rgba, d + 3) === 255 && at(rgba, d) === kr && at(rgba, d + 1) === kg && at(rgba, d + 2) === kb;
    };
    const queue: number[] = [];
    const seen = new Uint8Array(width * height);
    const visit = (i: number): void => { if (!seen[i] && isKey(i)) { seen[i] = 1; queue.push(i); } };
    if (mode === "all") {
      for (let i = 0; i < width * height; i++) visit(i);
    } else {
      for (let x = 0; x < width; x++) { visit(x); visit((height - 1) * width + x); }
      for (let y = 0; y < height; y++) { visit(y * width); visit(y * width + width - 1); }
    }
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q] ?? 0;
      rgba.fill(0, i * 4, i * 4 + 4); // canonical transparent pixel, same as a decoded one
      const x = i % width, y = (i - x) / width;
      if (x > 0) visit(i - 1);
      if (x < width - 1) visit(i + 1);
      if (y > 0) visit(i - width);
      if (y < height - 1) visit(i + width);
    }
    return { rgba, delay: f.delay };
  });
  return { width, height, frames };
}
