# Design: HTML export and import

- `export/build.ts`: `buildHtml(stack, playerJs)` prunes unused assets, JSON-escapes the data, hashes the player with Web Crypto and writes the CSP. `CONTROL` characters are stripped from `<title>` only.
- `export/import.ts`: string-based extraction of `#stack-data` (works in Node and the browser); `migrate` then `validateStack`.
- `player/entry.ts` is the only code bundled into the file (Vite IIFE, `dist-player/player.js`). It imports `core/migrate`, `core/validate`, `core/engine`, but NOT the fonts, which are added to the HTML by the exporter. Size is ~3 KB gzip.
- `player/fonts.ts` imports the `@fontsource` woff2 files with `?inline`.
- Asset URLs are only built from `image/*` mimes and base64 payloads that match strict patterns; CSP allows `img-src data:` only.

## Bugs found by property tests
- NUL in a title became U+FFFD in `<title>` (HTML parsers rewrite it). Fixed by stripping control characters from `<title>`.
- jsdom's missing `matchMedia` showed the player must not assume browser APIs. Fixed with a feature check.
