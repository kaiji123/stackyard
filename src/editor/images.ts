export interface PreparedImage {
  readonly mime: string;
  /** base64 payload only (no "data:" prefix). */
  readonly data: string;
  readonly w: number;
  readonly h: number;
  /** True when the original bytes were kept untouched: small PNG/GIF, almost always pixel art or animation. */
  readonly kept: boolean;
}

export const MAX_SIDE = 1600;
/** PNG and GIF files up to this size are stored exactly as uploaded. */
export const KEEP_MAX_BYTES = 256 * 1024;

/**
 * Keep the original file when it is a small PNG or GIF that already fits the canvas budget.
 * Re-encoding would turn animated GIFs into a still frame and smear hard pixel edges.
 */
export function shouldKeepOriginal(type: string, bytes: number, w: number, h: number): boolean {
  return (type === "image/png" || type === "image/gif") && bytes <= KEEP_MAX_BYTES && Math.max(w, h) <= MAX_SIDE;
}

/** Lossy WebP when the browser can write it, otherwise PNG. Never JPEG: JPEG drops transparency. */
export function reencodeType(webpSupported: boolean): "image/webp" | "image/png" {
  return webpSupported ? "image/webp" : "image/png";
}

function splitDataUrl(url: string): { mime: string; data: string } {
  const m = /^data:([^;,]+);base64,(.*)$/.exec(url);
  if (!m || !m[1] || m[2] === undefined) throw new Error("Could not encode the image");
  return { mime: m[1], data: m[2] };
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

/**
 * Prepare an uploaded picture for storing inside the stack: small PNG/GIF untouched, anything else
 * downscaled to MAX_SIDE and re-encoded (WebP at 0.85, PNG if the browser cannot write WebP).
 */
export async function prepareImage(file: Blob): Promise<PreparedImage> {
  const bmp = await createImageBitmap(file); // first frame only: used for the size
  try {
    if (shouldKeepOriginal(file.type, file.size, bmp.width, bmp.height)) {
      const { data } = splitDataUrl(await readAsDataUrl(file));
      return { mime: file.type, data, w: bmp.width, h: bmp.height, kept: true };
    }
    const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * k));
    const h = Math.max(1, Math.round(bmp.height * k));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available");
    ctx.drawImage(bmp, 0, 0, w, h);
    let url = canvas.toDataURL("image/webp", 0.85);
    if (reencodeType(url.startsWith("data:image/webp")) === "image/png") url = canvas.toDataURL("image/png");
    return { ...splitDataUrl(url), w, h, kept: false };
  } finally {
    bmp.close();
  }
}
