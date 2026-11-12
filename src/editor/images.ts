export interface PreparedImage {
  readonly mime: string;
  readonly data: string;
  readonly w: number;
  readonly h: number;
}

export const MAX_SIDE = 1600;

/** Downscale to MAX_SIDE and recompress (WebP at 0.85, JPEG fallback), returning base64 only. */
export async function prepareImage(file: Blob): Promise<PreparedImage> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * k));
  const h = Math.max(1, Math.round(bmp.height * k));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  let url = canvas.toDataURL("image/webp", 0.85);
  if (!url.startsWith("data:image/webp")) url = canvas.toDataURL("image/jpeg", 0.85);
  const m = /^data:([^;]+);base64,(.*)$/.exec(url);
  if (!m || !m[1] || m[2] === undefined) throw new Error("Could not encode the image");
  return { mime: m[1], data: m[2], w, h };
}
