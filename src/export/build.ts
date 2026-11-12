import { FONT_CSS } from "../player/fonts";
import { PLAYER_CSS } from "../player/style";
import type { Stack } from "../core/types";

/** JSON for a <script type="application/json"> block. Escapes everything that could end the block. */
export function escapeJson(json: string): string {
  return json
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/** Control characters are mangled by HTML parsers (NUL becomes U+FFFD), so keep them out of <title>. */
const CONTROL = /[\u0000-\u001f\u007f\u2028\u2029]/g;

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Remove assets no image object references, so exports stay small. */
export function pruneAssets(stack: Stack): Stack {
  const used = new Set(stack.cards.flatMap((c) => c.objects.flatMap((o) => (o.kind === "image" ? [o.asset] : []))));
  const assets = Object.fromEntries(Object.entries(stack.assets).filter(([id]) => used.has(id)));
  return { ...stack, assets };
}

export async function sha256Base64(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  let bin = "";
  for (const b of new Uint8Array(digest)) bin += String.fromCharCode(b);
  return btoa(bin);
}

/**
 * Build the single self-contained HTML file. The exported file is also the save file: the
 * importer reads #stack-data back out. No network, no module imports, strict CSP with a script hash.
 */
export async function buildHtml(stack: Stack, playerJs: string): Promise<string> {
  const hash = await sha256Base64(playerJs);
  const csp = [
    "default-src 'none'",
    "img-src data:",
    "media-src data:",
    "style-src 'unsafe-inline'",
    "font-src data:",
    `script-src 'sha256-${hash}'`,
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");
  const data = escapeJson(JSON.stringify(pruneAssets(stack)));
  return `<!doctype html>
<html lang="en"><head>
<!-- Made with Stackyard (MIT License). Embedded fonts Silkscreen and VT323: SIL Open Font License 1.1. -->
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<title>${escapeHtml(stack.title.replace(CONTROL, " "))}</title>
<style>html,body{margin:0;height:100%;background:#1b1426;overscroll-behavior:none;-webkit-tap-highlight-color:transparent}${FONT_CSS}${PLAYER_CSS}</style>
</head><body>
<div id="stack"></div>
<script type="application/json" id="stack-data">${data}</script>
<script>${playerJs}</script>
</body></html>
`;
}
