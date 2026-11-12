---
inclusion: always
---
# Tech rules

- TypeScript in `strict` mode with `noUncheckedIndexedAccess`. No `any` in `/core`.
- Vite for the editor build; Vitest + fast-check for tests; Playwright for e2e on exported files.
- **The player has zero runtime dependencies** and must stay under **30 KB min+gzip**.
- **Never** use `eval`, `new Function`, inline event-handler strings, or `innerHTML`/`outerHTML`/
  `insertAdjacentHTML` with user content. User text is set with `textContent` only.
- Actions are plain JSON data interpreted by `src/core/engine.ts`. Never compile them to code.
- The exported HTML must make zero network requests, use no ES module imports, and pass a strict CSP
  (`default-src 'none'`, script allowed only by sha256 hash).
- Stack documents are versioned (`schemaVersion`). Any schema change bumps the version and adds a
  migration in `src/core/migrate.ts`.
- `/core` functions are pure: they never mutate their inputs and return new values.
